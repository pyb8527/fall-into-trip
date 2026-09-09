package net.weeniebeenie.fit.account.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.JwtProvider;
import net.weeniebeenie.fit.shared.domain.Email;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

/**
 * 가입·로그인·비밀번호.
 *
 * <p>누구나 가입해서 자기 여행을 만듭니다. 동행자는 주인이 초대 링크를 보내
 * 부릅니다. 운영자(ADMIN)는 계정을 살피는 자리로만 두고, 최초 한 명만 설치
 * 토큰으로 만듭니다.
 *
 * <p>토큰은 두 가지입니다. 액세스 토큰은 짧게 두고 응답 본문으로만 주며
 * 프론트는 메모리에 들고 있습니다. 리프레시 토큰은 HttpOnly 쿠키로만 오가므로
 * 스크립트가 읽을 수 없습니다.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    public static final int PASSWORD_MIN = 8;
    public static final int PASSWORD_MAX = 200;
    private static final int NAME_MAX = 80;

    private final UserRepository users;
    private final RefreshTokenService refreshTokens;
    private final LoginAttemptService attempts;
    private final JwtProvider jwt;
    private final PasswordEncoder encoder;
    private final AuditService audit;

    @Value("${fit.setup-token:}")
    private String setupToken;

    /** 운영자가 아직 없으면 최초 설치 화면을 띄울 수 있습니다. */
    @Transactional(readOnly = true)
    public boolean setupNeeded() {
        return users.countByRoleAndDisabledFalse(Role.ADMIN) == 0;
    }

    /** 누구나 가입합니다. */
    @Transactional
    public User register(String email, String name, String password) {
        String normalized = Email.of(email).value();
        String cleanName = requireName(name);
        validatePassword(password);

        if (users.existsByEmail(normalized)) {
            /* 이미 있다고 그대로 알려 주면 어떤 주소가 가입돼 있는지 확인하는
               통로가 됩니다. 다만 가입 화면에서는 안내가 없으면 막막하므로,
               여기서는 알려 주되 로그인 쪽은 계속 뭉뚱그립니다. */
            throw ApiException.badRequest("이미 가입된 이메일입니다.");
        }

        User user = users.save(User.builder()
                .email(normalized)
                .name(cleanName)
                .passwordHash(encoder.encode(password))
                .role(Role.MEMBER)
                .build());

        audit.log(user.getId(), "user.register", user.getId(), Map.of("email", normalized));
        return user;
    }

    /**
     * 최초 운영자를 만듭니다.
     *
     * 운영자가 이미 있으면 거부합니다. 설치 토큰은 서버에만 두는 값으로,
     * 배포 직후 아무나 운영자를 선점하는 것을 막습니다.
     */
    @Transactional
    public User setup(String email, String name, String password, String token) {
        if (!setupNeeded()) {
            throw ApiException.forbidden("이미 설정이 끝났습니다.");
        }
        if (setupToken == null || setupToken.isBlank()) {
            throw ApiException.badRequest("서버에 설치 토큰이 설정되어 있지 않습니다.");
        }
        if (!setupToken.equals(token)) {
            throw ApiException.forbidden("설치 토큰이 올바르지 않습니다.");
        }
        String normalized = Email.of(email).value();
        String cleanName = requireName(name);
        validatePassword(password);

        /* 이미 회원으로 가입해 둔 사람을 운영자로 올릴 수도 있습니다. */
        User admin = users.findByEmail(normalized)
                .map(existing -> {
                    existing.setRole(Role.ADMIN);
                    return existing;
                })
                .orElseGet(() -> users.save(User.builder()
                        .email(normalized)
                        .name(cleanName)
                        .passwordHash(encoder.encode(password))
                        .role(Role.ADMIN)
                        .build()));

        audit.log(admin.getId(), "admin.setup", admin.getId(), Map.of("email", normalized));
        return admin;
    }

    /**
     * 로그인.
     *
     * 계정이 없을 때와 비밀번호가 틀렸을 때의 응답을 같게 두어, 어떤 이메일이
     * 가입돼 있는지 알아내지 못하게 합니다.
     */
    @Transactional
    public User login(String email, String password, String ip) {
        String key = (email == null ? "" : email.toLowerCase()) + "|" + ip;
        attempts.checkAllowed(key);

        String normalized;
        try {
            normalized = Email.of(email).value();
        } catch (ApiException e) {
            attempts.recordFailure(key);
            throw ApiException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        User user = users.findByEmail(normalized).orElse(null);
        boolean ok = user != null
                && !user.isDisabled()
                && encoder.matches(password == null ? "" : password, user.getPasswordHash());
        if (!ok) {
            attempts.recordFailure(key);
            throw ApiException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        attempts.reset(key);
        user.setLastLoginAt(Instant.now());
        audit.log(user.getId(), "login", user.getId());
        return user;
    }

    @Transactional
    public void changePassword(String userId, String current, String next) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요합니다."));
        if (!encoder.matches(current == null ? "" : current, user.getPasswordHash())) {
            throw ApiException.badRequest("현재 비밀번호가 올바르지 않습니다.");
        }
        validatePassword(next);
        user.setPasswordHash(encoder.encode(next));
        /* 다른 기기는 모두 내보냅니다. 지금 기기는 호출한 쪽에서 새 토큰을 받습니다. */
        refreshTokens.revokeAllOf(userId);
        audit.log(userId, "password.change", userId);
    }

    public String issueAccessToken(User user) {
        return jwt.issue(user);
    }

    private static String requireName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) {
            throw ApiException.badRequest("이름을 넣어 주세요.");
        }
        if (name.length() > NAME_MAX) {
            throw ApiException.badRequest("이름이 너무 깁니다.");
        }
        return name;
    }

    public static void validatePassword(String password) {
        if (password == null || password.length() < PASSWORD_MIN || password.length() > PASSWORD_MAX) {
            throw ApiException.badRequest("비밀번호는 " + PASSWORD_MIN + "자 이상이어야 합니다.");
        }
    }
}
