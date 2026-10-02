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
        String meId = me == null ? null : me.id();
        List<TipService.Card> cards = tips.listOf(placeId, meId);

        /* 읽었다고 표시합니다. 남긴 사람에게 "쓰였다" 고 말해 주려는 것이고,
           이 목록에는 아무 영향이 없습니다.

           실패해도 목록은 그대로 돌려줍니다. 세는 일 때문에 읽는 일이
           막히면 앞뒤가 바뀝니다 — PlaceService.announce 가 같은 자리에서
           같은 판단을 합니다. */
        try {
            tips.countViews(placeId, meId);
        } catch (RuntimeException ignored) {
            /* 세기만 못 했습니다. 볼 것은 이미 손에 있습니다. */
        }
        /*
          우리 평점을 같이 냅니다.

          <p>판 하나가 둘을 함께 그립니다 — 머리에 「★ 4.6 · 우리 11명」,
          아래에 한 줄들. 길을 둘로 나누면 판이 두 번 묻고, 그 둘이 서로
          다른 순간의 값일 수 있습니다.

          <p>아직 아무도 별을 안 줬으면 비워 보냅니다. 0 을 보내면 화면이
          별 0개를 그럴듯하게 그립니다.
        */
        var stars = tips.starsOf(List.of(placeId)).get(placeId);
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("tips", cards);
        out.put("stars", stars);
        return out;
    }

    /** 여러 장소의 팁 수를 한 번에. 목록에서 "팁 3" 을 띄우는 데 씁니다. */
    @PostMapping("/api/tips/counts")
    public Map<String, Object> counts(@RequestBody CountsRequest req) {
        List<String> ids = req == null || req.placeIds() == null ? List.of() : req.placeIds();
        /*
          별점도 같이 냅니다.

          <p>장소 목록은 팁 수와 별점을 늘 함께 보여 줍니다. 길을 둘로
          나누면 화면이 두 번 묻고, 그 둘이 서로 다른 순간의 값일 수
          있습니다.
        */
        return Map.of("counts", tips.countsOf(ids), "stars", tips.starsOf(ids));
    }

    @PostMapping("/api/places/{placeId}/tips")
    public Map<String, Object> add(@CurrentUser AuthPrincipal me,
                                   @PathVariable String placeId,
                                   @RequestBody TipRequest req) {
        var tip = tips.add(me, placeId,
                req == null ? null : req.text(),
                req == null ? null : req.stars());
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

    /**
     * 남기는 것 — 한 줄과 별점.
     *
     * <p>둘 중 하나만 보내도 됩니다. 옛 이름({@code TextRequest})에서 바꿨습니다 —
     * 이제 글만 받는 것이 아닙니다.
     */
    public record TipRequest(String text, Integer stars) {
    }

    public record ReasonRequest(String reason) {
    }
}
