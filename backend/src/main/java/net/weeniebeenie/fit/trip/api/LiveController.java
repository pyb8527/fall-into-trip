package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.LiveService;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 자유시간에 서로를 찾는 것들 — 임시 핀과 실시간 위치.
 *
 * <p>좌표는 모두 <b>본문</b>으로 받습니다. 쿼리스트링은 nginx 접근 기록과
 * 브라우저 방문 기록에 그대로 남는데, 사람이 지금 어디 있는지는 거기 남길
 * 값이 아닙니다.
 *
 * <p>동행자만 볼 수 있습니다. 게시판이나 공유 링크로는 나가지 않습니다.
 */
@RestController
@RequiredArgsConstructor
public class LiveController {

    private final LiveService live;

    /* --------------------------------------------------------- 임시 핀 */

    @GetMapping("/api/trips/{tripId}/pins")
    public Map<String, Object> pins(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        return Map.of("pins", live.pinsOf(me, tripId));
    }

    @PostMapping("/api/trips/{tripId}/pins")
    public Map<String, Object> drop(@CurrentUser AuthPrincipal me,
                                    @PathVariable String tripId,
                                    @RequestBody PinRequest req) {
        var pin = live.drop(me, tripId,
                req == null ? null : req.lat(),
                req == null ? null : req.lng(),
                req == null ? null : req.label());
        return Map.of("id", pin.getId());
    }

    @DeleteMapping("/api/pins/{pinId}")
    public Map<String, Object> pull(@CurrentUser AuthPrincipal me, @PathVariable String pinId) {
        live.pull(me, pinId);
        return Map.of("ok", true);
    }

    /* ------------------------------------------------------- 실시간 위치 */

    /**
     * 지금 자리를 알립니다.
     *
     * <p>보낼 때마다 기한이 다시 셉니다. 그만두려면 아래 DELETE 를 부르거나
     * 그냥 두면 몇 시간 뒤 스스로 꺼집니다.
     */
    @PutMapping("/api/trips/{tripId}/location")
    public Map<String, Object> share(@CurrentUser AuthPrincipal me,
                                     @PathVariable String tripId,
                                     @RequestBody WhereRequest req) {
        live.share(me, tripId,
                req == null ? null : req.lat(),
                req == null ? null : req.lng(),
                req == null ? null : req.accuracy());
        return Map.of("ok", true);
    }

    @DeleteMapping("/api/trips/{tripId}/location")
    public Map<String, Object> stop(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        live.stop(me, tripId);
        return Map.of("ok", true);
    }

    /** 지금 켜 둔 동행자들과, 내가 켜 두었는지. */
    @GetMapping("/api/trips/{tripId}/locations")
    public Map<String, Object> where(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("people", live.whereEveryone(me, tripId));
        out.put("sharing", live.sharing(me, tripId));
        return out;
    }

    public record PinRequest(Double lat, Double lng, String label) {
    }

    public record WhereRequest(Double lat, Double lng, Double accuracy) {
    }
}
