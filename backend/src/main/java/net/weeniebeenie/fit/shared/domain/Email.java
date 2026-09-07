package net.weeniebeenie.fit.shared.domain;

import net.weeniebeenie.fit.shared.error.ApiException;

import java.util.regex.Pattern;

/**
 * 이메일 주소.
 *
 * 대소문자를 가리지 않도록 소문자로 맞춰 둡니다. DB 인덱스도 lower(email) 로
 * 걸려 있어, 여기서 한 번 정규화해 두면 조회와 중복 검사가 어긋나지 않습니다.
 */
public record Email(String value) {

    private static final Pattern SHAPE =
            Pattern.compile("^[^@\\s]+@[^@\\s.]+(\\.[^@\\s.]+)+$");
    private static final int MAX = 190;

    public Email {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest("이메일을 입력해 주세요.");
        }
        value = value.trim().toLowerCase();
        if (value.length() > MAX) {
            throw ApiException.badRequest("이메일이 너무 깁니다.");
        }
        if (!SHAPE.matcher(value).matches()) {
            throw ApiException.badRequest("이메일 형식이 올바르지 않습니다.");
        }
    }

    public static Email of(String raw) {
        return new Email(raw);
    }

    @Override
    public String toString() {
        return value;
    }
}
