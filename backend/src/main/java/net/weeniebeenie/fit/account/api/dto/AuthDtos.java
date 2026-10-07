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
            @Email(message = "이메일 형식이 올바르지 않아요.")
            String email,

            @NotBlank(message = "비밀번호를 넣어 주세요.")
            String password) {
    }

    public record RegisterRequest(
            @NotBlank(message = "이메일을 넣어 주세요.")
            @Email(message = "이메일 형식이 올바르지 않아요.")
            String email,

            @NotBlank(message = "이름을 넣어 주세요.")
            @Size(max = 80, message = "이름이 너무 길어요.")
            String name,

            @NotBlank(message = "비밀번호를 넣어 주세요.")
            String password,

            Boolean over14,
            Boolean terms,
            Boolean privacy) {

        /** 셋 다 켰는가. 하나라도 빠지면 가입을 받지 않습니다 — {@link AgreeRequest} 와 같은 규칙. */
        public boolean agreedAll() {
            return Boolean.TRUE.equals(over14) && Boolean.TRUE.equals(terms) && Boolean.TRUE.equals(privacy);
        }
    }

    /**
     * 약관 · 개인정보 수집 · 이용 동의.
     *
     * <p>세 칸을 하나로 뭉치지 않습니다. 법이 「만 14세 이상인지」와 「약관」과
     * 「개인정보 수집 · 이용」을 따로 묻게 하고(개인정보 보호법 제22조), 화면도
     * 칸을 셋으로 그립니다. 하나로 받으면 화면이 「모두 동의」 한 칸만 보내도
     * 통과하게 됩니다.
     *
     * <p>{@code @AssertTrue} 를 안 겁니다. 그러면 빠진 칸마다 다른 문구가 나가는데,
     * 어느 칸이 빠졌든 할 말은 하나입니다.
     */
    public record AgreeRequest(Boolean over14, Boolean terms, Boolean privacy) {

        public boolean agreedAll() {
            return Boolean.TRUE.equals(over14) && Boolean.TRUE.equals(terms) && Boolean.TRUE.equals(privacy);
        }
    }

    public record SetupRequest(
            @NotBlank(message = "이메일을 넣어 주세요.")
            @Email(message = "이메일 형식이 올바르지 않아요.")
            String email,

            @NotBlank(message = "이름을 넣어 주세요.")
            @Size(max = 80, message = "이름이 너무 길어요.")
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

    /**
     * @param mark    지도에서 나를 가리킬 그림의 짧은 이름("rabbit")
     * @param photoId 프로필 얼굴 사진. 비어 있으면 {@code mark} 가 그 자리에
     *                섭니다. <b>{@code mark} 와 함께 옵니다</b> — 사진은
     *                프로필에, 표식은 지도 핀에 쓰이는 다른 값입니다
     *                (16픽셀로 줄인 얼굴 사진은 누구인지 안 보입니다).
     *                고치는 자리는 {@code PATCH /api/me/profile} 하나입니다
     * @param needsConsent 지금 판의 약관 · 처리방침에 아직 동의하지 않았는지
     *                ({@link User#needsConsent}). 켜져 있으면 화면이 다른 것을
     *                안 보여 주고 동의 화면부터 띄웁니다. 세션을 내주는 모든
     *                자리(로그인 · 가입 · 소셜 · 재발급 · /me)가 이 꼴을 쓰므로
     *                어느 길로 들어와도 같은 판단을 받습니다
     */
    public record UserView(String id, String email, String name, String role,
                           String mark, String photoId, boolean disabled, Instant createdAt,
                           Instant lastLoginAt, boolean needsConsent) {

        public static UserView of(User u) {
            return new UserView(u.getId(), u.getEmail(), u.getName(), u.getRole().name(),
                    u.getMark(), u.getPhotoId(), u.isDisabled(), u.getCreatedAt(),
                    u.getLastLoginAt(), u.needsConsent());
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
    /** @param kakao 카카오 로그인을 켰는지. 켰으면 화면이 카카오 단추를 그립니다 */
    public record AuthStateResponse(boolean setupNeeded, String googleClientId, boolean kakao) {
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
