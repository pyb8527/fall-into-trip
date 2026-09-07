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
            @NotBlank(message = "이메일을 입력해 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email,

            @NotBlank(message = "비밀번호를 입력해 주세요.")
            String password) {
    }

    public record RegisterRequest(
            @NotBlank(message = "이메일을 입력해 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email,

            @NotBlank(message = "이름을 입력해 주세요.")
            @Size(max = 80, message = "이름이 너무 깁니다.")
            String name,

            @NotBlank(message = "비밀번호를 입력해 주세요.")
            String password) {
    }

    public record SetupRequest(
            @NotBlank(message = "이메일을 입력해 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email,

            @NotBlank(message = "이름을 입력해 주세요.")
            @Size(max = 80, message = "이름이 너무 깁니다.")
            String name,

            @NotBlank(message = "비밀번호를 입력해 주세요.")
            String password,

            @NotBlank(message = "설치 토큰을 입력해 주세요.")
            String token) {
    }

    public record PasswordChangeRequest(
            @NotBlank(message = "현재 비밀번호를 입력해 주세요.")
            String current,

            @NotBlank(message = "새 비밀번호를 입력해 주세요.")
            String next) {
    }

    /** 액세스 토큰은 여기로만 나갑니다. 프론트는 메모리에 들고 있습니다. */
    public record TokenResponse(String accessToken, long expiresIn, UserView user) {
    }

    public record UserView(String id, String email, String name, String role,
                           boolean disabled, Instant createdAt, Instant lastLoginAt) {

        public static UserView of(User u) {
            return new UserView(u.getId(), u.getEmail(), u.getName(), u.getRole().name(),
                    u.isDisabled(), u.getCreatedAt(), u.getLastLoginAt());
        }
    }

    /** 로그인 전에 화면이 무엇을 띄울지 정할 때 씁니다. */
    public record AuthStateResponse(boolean setupNeeded) {
    }
}
