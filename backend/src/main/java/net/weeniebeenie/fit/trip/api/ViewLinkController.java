package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.ViewLinkService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 로그인 없이 보는 일정 링크. 규칙은 {@link ViewLinkService}.
 *
 * <p>링크 모양은 {@code /view/{열쇠}} — 화면이 그 열쇠로
 * {@code GET /api/view/{열쇠}} 를 부릅니다.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ViewLinkController {

    private final ViewLinkService links;

    @GetMapping("/trips/{id}/view-link")
    public ViewLinkService.State state(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return links.stateOf(me, id);
    }

    @PostMapping("/trips/{id}/view-link")
    public Map<String, Object> issue(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return Map.of("path", "/view/" + links.issue(me, id));
    }

    @DeleteMapping("/trips/{id}/view-link")
    public Map<String, Object> revoke(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        links.revoke(me, id);
        return Map.of("ok", true);
    }

    /** 로그인 없이. 중간에서 담아 두지 않게 합니다 — 끊어도 옛 일정이 나가면 안 됩니다. */
    @GetMapping("/view/{token}")
    public ResponseEntity<ViewLinkService.Shown> show(@PathVariable String token) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(links.show(token));
    }
}
