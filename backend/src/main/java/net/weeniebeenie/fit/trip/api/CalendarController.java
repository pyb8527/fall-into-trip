package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.CalendarService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 캘린더 구독.
 *
 * <p>주소는 {@code /api/cal/{열쇠}.ics} 입니다. {@code /api} 아래에 두어야
 * nginx 가 이 서버로 넘깁니다. 규칙은 {@link CalendarService}.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CalendarController {

    private final CalendarService calendar;

    /** 켜 두었는지. 열쇠 원문은 다시 안 보여 줍니다 — 해시만 있습니다. */
    @GetMapping("/me/calendar")
    public Map<String, Object> state(@CurrentUser AuthPrincipal me) {
        return Map.of("on", calendar.isOn(me.id()));
    }

    /** 새 주소를 만듭니다. 옛 주소는 죽습니다. 원문은 이 응답에서만 나갑니다. */
    @PostMapping("/me/calendar")
    public Map<String, Object> issue(@CurrentUser AuthPrincipal me) {
        return Map.of("path", "/api/cal/" + calendar.issue(me.id()) + ".ics");
    }

    @DeleteMapping("/me/calendar")
    public Map<String, Object> revoke(@CurrentUser AuthPrincipal me) {
        calendar.revoke(me.id());
        return Map.of("ok", true);
    }

    /**
     * 폰 캘린더가 읽어 가는 자리. 로그인 없이, 주소 속 열쇠로.
     *
     * <p>캐시하지 말라고 적습니다. 중간에 누가 들고 있으면 열쇠를 바꿔도 옛
     * 일정이 그 자리에서 계속 나갑니다.
     */
    @GetMapping(value = "/cal/{token}.ics")
    public ResponseEntity<String> ics(@PathVariable String token) {
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "calendar", java.nio.charset.StandardCharsets.UTF_8))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(calendar.ics(token));
    }
}
