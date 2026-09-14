package net.weeniebeenie.fit.account.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import net.weeniebeenie.fit.account.domain.User;

import java.time.Instant;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "이메일을 넣어 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email,

            @NotBlank(message = "비밀번호를 넣어 주세요.")
            String password) {
    }

    public record RegisterRequest(
            @NotBlank(message = "이메일을 넣어 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email,

            @NotBlank(message = "이름을 넣어 주세요.")
            @Size(max = 80, message = "이름이 너무 깁니다.")
            String name,

            @NotBlank(message = "비밀번호를 넣어 주세요.")
            String password) {
    }

    public record SetupRequest(
            @NotBlank(message = "이메일을 넣어 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email,

            @NotBlank(message = "이름을 넣어 주세요.")
            @Size(max = 80, message = "이름이 너무 깁니다.")
            String name,

            @NotBlank(message = "비밀번호를 넣어 주세요.")
            String password,

            @NotBlank(message = "설치 토큰을 넣어 주세요.")
            String token) {
    }

    public record PasswordChangeRequest(
            @NotBlank(message = "현재 비밀번호를 넣어 주세요.")
            String current,

            @NotBlank(message = "새 비밀번호를 넣어 주세요.")
            String next) {
    }

    /** 액세스 토큰은 여기로만 나갑니다. 프론트는 메모리에 들고 있습니다. */
    public record TokenResponse(String accessToken, long expiresIn, UserView user) {
    }

    public record UserView(String id, String email, String name, String role,
                           String mark, boolean disabled, Instant createdAt,
                           Instant lastLoginAt) {

        public static UserView of(User u) {
            return new UserView(u.getId(), u.getEmail(), u.getName(), u.getRole().name(),
                    u.getMark(), u.isDisabled(), u.getCreatedAt(), u.getLastLoginAt());
        }
    }

    /** 지도에서 나를 가리킬 그림. 빈 문자열은 "안 쓰겠다" 입니다. */
    public record MarkRequest(String mark) {
    }

    /** 로그인 전에 화면이 무엇을 띄울지 정할 때 씁니다. */
    /**
     * 화면이 뜰 때 서버에 묻는 것.
     *
     * @param googleClientId 구글 로그인이 켜져 있으면 그 클라이언트 ID.
     *                       꺼져 있으면 비어 있고, 그때는 단추를 안 냅니다.
     *                       <b>빌드에 박지 않고 여기로 내려보냅니다</b> —
     *                       박아 두면 값을 바꿀 때마다 웹을 다시 구워야
     *                       하고, 그러면 .env 와 번들이 서로 어긋난 채로
     *                       도는 날이 옵니다. 비밀이 아니라 브라우저에
     *                       나가도 되는 값입니다.
     */
    public record AuthStateResponse(boolean setupNeeded, String googleClientId) {
    }

    /**
     * 남이 준 로그인 토큰.
     *
     * <p>{@code @Valid} 를 안 겁니다. 비어 있을 때의 문구를 여기서 만들면
     * "무엇이 비었는지" 를 알려 주게 되는데, 토큰이 틀린 까닭은 뭉뚱그리는
     * 것이 이 자리의 규칙입니다({@code SocialTokens}).
     */
    public record SocialRequest(String credential) {
    }
}
