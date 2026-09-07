package net.weeniebeenie.fit.shared.error;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** 사용자에게 그대로 보여 줄 수 있는 오류. 메시지는 한국어로 씁니다. */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    /** 내가 본 사이에 다른 사람이 먼저 고쳤을 때. */
    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }

    public static ApiException tooMany(String message) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, message);
    }
}
