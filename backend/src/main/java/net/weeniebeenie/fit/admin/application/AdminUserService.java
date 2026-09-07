package net.weeniebeenie.fit.admin.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.application.AuthService;
import net.weeniebeenie.fit.account.application.RefreshTokenService;
import net.weeniebeenie.fit.account.domain.RefreshTokenRepository;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.AdminUserView;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.TripRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 운영자의 계정 관리.
 *
 * <p>여기서 하는 일은 전부 남의 계정을 건드리는 일입니다. 그래서 두 가지를
 * 지킵니다.
 *
 * <ul>
 *   <li><b>스스로를 잠그지 못하게</b> — 자기 권한을 낮추거나 자기 계정을
 *       잠그면 아무도 운영 화면에 들어갈 수 없게 됩니다. 마지막 운영자
 *       한 명도 같은 이유로 지킵니다.</li>
 *   <li><b>흔적을 남기게</b> — 계정을 잠그고 비밀번호를 바꾸는 일은 전부
 *       감사 로그에 남습니다.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository users;
    private final TripRepository trips;
    private final RefreshTokenRepository refreshTokens;
    private final RefreshTokenService sessions;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final AdminGuard guard;

    /* ------------------------------------------------------------ 조회 */

    @Transactional(readOnly = true)
    public Page<AdminUserView> search(AuthPrincipal me, String query, Role role,
                                      Boolean disabled, Pageable pageable) {
        guard.requireAdmin(me);

        String q = (query == null || query.isBlank())
                ? null
                : "%" + query.trim().toLowerCase() + "%";

        Page<User> page = users.search(q, role, disabled, pageable);
        List<String> ids = page.getContent().stream().map(User::getId).toList();
        Map<String, Long> owned = countMap(ids, trips.countByOwnerIds(ids));
        Map<String, Long> active = countMap(ids,
                refreshTokens.countActiveByUserIds(ids, Instant.now()));

        return page.map(u -> AdminUserView.of(u,
                owned.getOrDefault(u.getId(), 0L),
                active.getOrDefault(u.getId(), 0L)));
    }

    @Transactional(readOnly = true)
    public AdminUserView detail(AuthPrincipal me, String userId) {
        guard.requireAdmin(me);
        return view(find(userId));
    }

    /* ------------------------------------------------------------ 변경 */

    @Transactional
    public AdminUserView changeRole(AuthPrincipal me, String userId, Role role) {
        User actor = guard.requireAdmin(me);
        User target = find(userId);

        if (target.getRole() == role) {
            return view(target);
        }
        if (role != Role.ADMIN) {
            /* 스스로 내려오면 되돌릴 사람이 없습니다. 다른 운영자에게 부탁해야 합니다. */
            if (target.getId().equals(actor.getId())) {
                throw ApiException.badRequest(
                        "자기 권한은 스스로 낮출 수 없습니다. 다른 운영자에게 요청해 주세요.");
            }
            requireNotLastAdmin(target, "마지막 운영자의 권한은 낮출 수 없습니다.");
        }

        Role before = target.getRole();
        target.setRole(role);
        /* 토큰 안의 role 은 이미 나가 있습니다. 다시 로그인하게 해서 새 권한으로 맞춥니다. */
        sessions.revokeAllOf(target.getId());

        audit.log(actor.getId(), "admin.user.role", target.getId(),
                Map.of("from", before.name(), "to", role.name(), "email", target.getEmail()));
        return view(target);
    }

    @Transactional
    public AdminUserView setDisabled(AuthPrincipal me, String userId, boolean disabled) {
        User actor = guard.requireAdmin(me);
        User target = find(userId);

        if (target.isDisabled() == disabled) {
            return view(target);
        }
        if (disabled) {
            if (target.getId().equals(actor.getId())) {
                throw ApiException.badRequest("자기 계정은 스스로 잠글 수 없습니다.");
            }
            requireNotLastAdmin(target, "마지막 운영자의 계정은 잠글 수 없습니다.");
        }

        target.setDisabled(disabled);
        if (disabled) {
            /* 잠갔는데 이미 열려 있는 세션이 그대로면 잠근 것이 아닙니다. */
            sessions.revokeAllOf(target.getId());
        }

        audit.log(actor.getId(), disabled ? "admin.user.lock" : "admin.user.unlock",
                target.getId(), Map.of("email", target.getEmail()));
        return view(target);
    }

    /**
     * 비밀번호를 대신 바꿔 줍니다.
     *
     * 현재 비밀번호를 묻지 않는 길이라 그 자체로 계정을 넘겨받는 통로입니다.
     * 반드시 감사 로그에 남기고, 그 계정의 세션을 전부 끊습니다.
     */
    @Transactional
    public void resetPassword(AuthPrincipal me, String userId, String password) {
        User actor = guard.requireAdmin(me);
        User target = find(userId);
        AuthService.validatePassword(password);

        target.setPasswordHash(encoder.encode(password));
        sessions.revokeAllOf(target.getId());

        audit.log(actor.getId(), "admin.user.password", target.getId(),
                Map.of("email", target.getEmail()));
    }

    /** 도난이 의심될 때 그 계정을 모든 기기에서 내보냅니다. */
    @Transactional
    public int forceLogout(AuthPrincipal me, String userId) {
        User actor = guard.requireAdmin(me);
        User target = find(userId);

        int revoked = sessions.revokeAllOf(target.getId());
        audit.log(actor.getId(), "admin.user.logout", target.getId(),
                Map.of("email", target.getEmail(), "revoked", revoked));
        return revoked;
    }

    /**
     * 계정을 지웁니다.
     *
     * <p>여행·지출·장소 기록이 그 사람을 가리키고 있으면 지울 수 없습니다.
     * 억지로 지우면 누가 냈는지 모르는 지출 같은 것이 남아 정산이 무너집니다.
     * 그럴 때는 지우지 말고 잠그라고 안내합니다.
     */
    @Transactional
    public void delete(AuthPrincipal me, String userId) {
        User actor = guard.requireAdmin(me);
        User target = find(userId);

        if (target.getId().equals(actor.getId())) {
            throw ApiException.badRequest("자기 계정은 스스로 지울 수 없습니다.");
        }
        requireNotLastAdmin(target, "마지막 운영자의 계정은 지울 수 없습니다.");

        long owned = trips.countByOwnerId(target.getId());
        if (owned > 0) {
            throw ApiException.conflict("이 계정이 여행 " + owned
                    + "개의 주인입니다. 여행을 넘기거나 지운 뒤에 다시 시도하거나, 계정을 잠가 주세요.");
        }

        String email = target.getEmail();
        sessions.revokeAllOf(target.getId());
        try {
            users.delete(target);
            users.flush();
        } catch (DataIntegrityViolationException e) {
            /* 지출·장소 기록처럼 아직 이 사람을 가리키는 것이 남아 있습니다. */
            throw ApiException.conflict("이 계정이 남긴 기록이 있어 지울 수 없습니다. 계정을 잠가 주세요.");
        }

        audit.log(actor.getId(), "admin.user.delete", target.getId(), Map.of("email", email));
    }

    /* ------------------------------------------------------------ 도우미 */

    private User find(String userId) {
        return users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("없는 계정입니다."));
    }

    private AdminUserView view(User user) {
        return AdminUserView.of(user,
                trips.countByOwnerId(user.getId()),
                refreshTokens.countActive(user.getId(), Instant.now()));
    }

    /** 지금 살아 있는 운영자가 이 사람뿐이면 손대지 못하게 합니다. */
    private void requireNotLastAdmin(User target, String message) {
        if (target.getRole() != Role.ADMIN || target.isDisabled()) {
            return;
        }
        if (users.countByRoleAndDisabledFalse(Role.ADMIN) <= 1) {
            throw ApiException.badRequest(message);
        }
    }

    private static Map<String, Long> countMap(Collection<String> ids, List<Object[]> rows) {
        Map<String, Long> map = new HashMap<>();
        if (ids.isEmpty()) {
            return map;
        }
        for (Object[] row : rows) {
            map.put((String) row[0], ((Number) row[1]).longValue());
        }
        return map;
    }
}
