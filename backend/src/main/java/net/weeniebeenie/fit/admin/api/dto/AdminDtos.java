package net.weeniebeenie.fit.admin.api.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.support.audit.AuditLog;
import org.springframework.data.domain.Page;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * 운영 화면에 내려보낼 모양.
 *
 * 계정을 다루는 화면이라 특히 조심합니다. 비밀번호 해시는 어떤 경로로도
 * 나가지 않습니다.
 */
public final class AdminDtos {

    private AdminDtos() {
    }

    /* ------------------------------------------------------------ 요청 */

    public record RoleRequest(
            @NotNull(message = "역할을 지정해 주세요.")
            Role role) {
    }

    public record DisabledRequest(
            @NotNull(message = "잠금 여부를 지정해 주세요.")
            Boolean disabled) {
    }

    /**
     * 운영자가 비밀번호를 대신 바꿔 줍니다.
     *
     * 현재 비밀번호를 묻지 않으므로, 이 길은 계정을 통째로 가져갈 수 있는
     * 통로입니다. 그래서 호출 즉시 그 계정의 모든 세션을 끊고 감사 로그에
     * 반드시 남깁니다.
     */
    public record PasswordResetRequest(
            @NotBlank(message = "새 비밀번호를 입력해 주세요.")
            String password) {
    }

    /* ------------------------------------------------------------ 응답 */

    /** 목록 한 줄. 여행 수·세션 수는 운영자가 계정을 지우기 전에 확인합니다. */
    public record AdminUserView(String id, String email, String name, String role,
                                boolean disabled, Instant createdAt, Instant lastLoginAt,
                                long ownedTrips, long activeSessions) {

        public static AdminUserView of(User u, long ownedTrips, long activeSessions) {
            return new AdminUserView(u.getId(), u.getEmail(), u.getName(), u.getRole().name(),
                    u.isDisabled(), u.getCreatedAt(), u.getLastLoginAt(), ownedTrips, activeSessions);
        }
    }

    /**
     * 감사 로그 한 줄.
     *
     * userId 만 내려보내면 화면에서 사람을 알아볼 수 없고, 그렇다고 이름을
     * 로그에 박아 두면 개명했을 때 과거 기록이 틀어집니다. 그래서 저장은
     * id 로 하고 내보낼 때 이름을 붙입니다. 지워진 계정이면 이름은 null 입니다.
     */
    public record AuditView(Long id, Instant at, String userId, String userName,
                            String action, String target, Object detail) {

        public static AuditView of(AuditLog a, String userName, ObjectMapper mapper) {
            return new AuditView(a.getId(), a.getAt(), a.getUserId(), userName,
                    a.getAction(), a.getTarget(), json(a.getDetail(), mapper));
        }
    }

    /** 목록 응답의 공통 껍데기. 프론트가 페이지 이동을 그릴 수 있을 만큼만 담습니다. */
    public record PageView<T>(List<T> items, int page, int size, long total, int totalPages) {

        public static <E, T> PageView<T> of(Page<E> page, Function<E, T> mapper) {
            return new PageView<>(page.getContent().stream().map(mapper).toList(),
                    page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
        }
    }

    /** 운영 첫 화면의 요약 숫자. */
    public record StatsView(long users, long admins, long disabledUsers,
                            long trips, long places, long expenses,
                            long auditLast24h, Map<String, Long> topActions) {
    }

    private static Object json(String raw, ObjectMapper mapper) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return mapper.readValue(raw, Object.class);
        } catch (Exception e) {
            /* 로그를 보여 주다가 화면 전체를 못 그리게 되면 곤란합니다. */
            return null;
        }
    }
}
