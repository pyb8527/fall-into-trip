package net.weeniebeenie.fit.tip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.tip.application.TipService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 장소에 달린 한 줄 팁.
 *
 * <p>읽는 것은 로그인 없이도 됩니다. 남기거나 신고할 때만 로그인을 부릅니다 —
 * 누가 남겼는지 세야 하고, 한 사람이 도배하지 못하게 막아야 합니다.
 *
 * <p>주소가 여행이 아니라 구글 장소 번호입니다. 같은 가게를 넣어 둔 사람이면
 * 누구든 같은 팁을 봅니다.
 */
@RestController
@RequiredArgsConstructor
public class TipController {

    private final TipService tips;

    @GetMapping("/api/places/{placeId}/tips")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me, @PathVariable String placeId) {
        return Map.of("tips", tips.listOf(placeId, me == null ? null : me.id()));
    }

    /** 여러 장소의 팁 수를 한 번에. 목록에서 "팁 3" 을 띄우는 데 씁니다. */
    @PostMapping("/api/tips/counts")
    public Map<String, Object> counts(@RequestBody CountsRequest req) {
        List<String> ids = req == null || req.placeIds() == null ? List.of() : req.placeIds();
        return Map.of("counts", tips.countsOf(ids));
    }

    @PostMapping("/api/places/{placeId}/tips")
    public Map<String, Object> add(@CurrentUser AuthPrincipal me,
                                   @PathVariable String placeId,
                                   @RequestBody TextRequest req) {
        var tip = tips.add(me, placeId, req == null ? null : req.text());
        return Map.of("tip", tips.cardOf(tip, me.id()));
    }

    @DeleteMapping("/api/tips/{tipId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me, @PathVariable String tipId) {
        tips.remove(me, tipId);
        return Map.of("ok", true);
    }

    @PostMapping("/api/tips/{tipId}/report")
    public Map<String, Object> report(@CurrentUser AuthPrincipal me,
                                      @PathVariable String tipId,
                                      @RequestBody(required = false) ReasonRequest req) {
        tips.report(me, tipId, req == null ? null : req.reason());
        return Map.of("ok", true);
    }

    public record CountsRequest(List<String> placeIds) {
    }

    public record TextRequest(String text) {
    }

    public record ReasonRequest(String reason) {
    }
}
