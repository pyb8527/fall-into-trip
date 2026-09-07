package net.weeniebeenie.fit.shared.error;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

/**
 * 오류 응답을 {"error": "..."} 한 가지 모양으로 통일합니다.
 * 프론트가 메시지를 그대로 띄울 수 있도록 사람이 읽는 문장으로 내려보냅니다.
 */
@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> onApi(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> onInvalid(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .findFirst()
                .orElse("입력값이 올바르지 않습니다.");
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> onDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "권한이 없습니다."));
    }

    /**
     * 내가 화면을 열어 둔 사이에 다른 사람이 먼저 저장했습니다.
     *
     * 조용히 덮어쓰면 앞사람이 쓴 내용이 흔적 없이 사라지므로, 되돌리고
     * 다시 불러오라고 알려 줍니다.
     */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> onConflict() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "다른 사람이 먼저 고쳤습니다. 새로 불러온 뒤 다시 저장해 주세요.",
                             "code", "STALE"));
    }

    /** 없는 주소. 이걸 500 으로 뭉뚱그리면 진짜 오류를 찾기 어려워집니다. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> onNoRoute() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "없는 주소입니다."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> onBadMethod() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(Map.of("error", "허용되지 않은 방식입니다."));
    }

    /** 예상 못 한 오류는 속을 드러내지 않고 로그에만 남깁니다. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> onOther(Exception e, HttpServletRequest req) {
        log.error("[500] {} {}", req.getMethod(), req.getRequestURI(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "서버 오류가 발생했습니다."));
    }
}
