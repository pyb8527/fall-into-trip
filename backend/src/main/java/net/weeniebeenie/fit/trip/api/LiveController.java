package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.application.LiveService;
import org.springframework.beans.factory.annotation.Value;
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
 *
 * <h3>꺼 둘 수 있습니다(fit.live-sharing.enabled)</h3>
 *
 * <p>위치를 서버로 받아 동행자에게 보이는 일은 위치정보법상 위치기반서비스사업
 * 신고 대상입니다. 신고를 마치기 전에는 이 둘(위치 알리기 · 깃발)을 끄고
 * 냅니다 — 기본값이 꺼짐입니다. 꺼져 있으면 받는 요청은 거절하고, 보는
 * 요청에는 빈 목록과 {@code enabled: false} 를 돌려 화면이 단추를 숨기게
 * 합니다. 지도에 내 위치를 보이는 것과 「지금 여기」는 폰 안에서만 위치를
 * 쓰므로 이 설정과 상관없습니다.
 */
@RestController
@RequiredArgsConstructor
public class LiveController {

    private final LiveService live;

    @Value("${fit.live-sharing.enabled:false}")
    private boolean enabled;

    private void requireEnabled() {
        if (!enabled) {
            throw ApiException.forbidden("지금은 위치 알리기와 깃발을 쓸 수 없어요.");
        }
    }

    /* --------------------------------------------------------- 임시 핀 */

    @GetMapping("/api/trips/{tripId}/pins")
    public Map<String, Object> pins(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        if (!enabled) {
            return Map.of("pins", java.util.List.of(), "enabled", false);
        }
        return Map.of("pins", live.pinsOf(me, tripId), "enabled", true);
    }

    @PostMapping("/api/trips/{tripId}/pins")
    public Map<String, Object> drop(@CurrentUser AuthPrincipal me,
                                    @PathVariable String tripId,
                                    @RequestBody PinRequest req) {
        requireEnabled();
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
        requireEnabled();
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
        if (!enabled) {
            out.put("people", java.util.List.of());
            out.put("sharing", false);
            out.put("enabled", false);
            return out;
        }
        out.put("people", live.whereEveryone(me, tripId));
        out.put("sharing", live.sharing(me, tripId));
        out.put("enabled", true);
        return out;
    }

    public record PinRequest(Double lat, Double lng, String label) {
    }

    public record WhereRequest(Double lat, Double lng, Double accuracy) {
    }
}
