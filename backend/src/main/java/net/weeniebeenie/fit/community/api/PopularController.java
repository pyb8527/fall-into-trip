package net.weeniebeenie.fit.community.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.community.domain.PopularRepository;
import net.weeniebeenie.fit.trip.domain.PlaceKind;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 어디가 많이 가고, 어디를 많이 넣는지.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>처음 온 사람에게 빈 화면을 보여 주고 "첫 여행을 만들어 보세요" 라고만
 * 하면, 무엇을 만들어야 할지가 그대로 숙제로 남습니다. 남들이 어디를 갔는지
 * 보이면 거기서 시작할 수 있습니다.
 *
 * <p>이미 올라온 글에서 세는 것이라 따로 채워 둘 것이 없습니다. 글이 없으면
 * 목록도 비고, 그때는 화면이 다른 말을 합니다.
 *
 * <h3>로그인 없이 열립니다</h3>
 *
 * <p>이미 공개된 글을 세는 것이라 새로 드러나는 것이 없습니다. 둘러보기가
 * 그렇듯 가입하기 전에 볼 수 있어야 가입할 이유가 생깁니다.
 */
@RestController
@RequiredArgsConstructor
public class PopularController {

    /**
     * 한 번에 내려 주는 개수.
     *
     * <p>순위는 훑어보는 것이라 열을 넘으면 아무도 안 봅니다. 홈에서는 그중
     * 앞의 몇만 잘라 씁니다.
     */
    private static final int LIMIT = 10;

    private final PopularRepository popular;

    @GetMapping("/api/popular/regions")
    public Map<String, Object> regions() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] r : popular.regions(LIMIT)) {
            out.add(Map.of(
                    "region", (String) r[0],
                    "posts", num(r[1]),
                    "likes", num(r[2]),
                    "views", num(r[3])));
        }
        return Map.of("regions", out);
    }

    /**
     * @param kind 갈래로 거를 때. 모르는 이름은 안 거른 것으로 봅니다 —
     *             화면에서 넘어온 값을 그대로 쿼리에 넣지 않습니다.
     */
    @GetMapping("/api/popular/places")
    public Map<String, Object> places(@RequestParam(required = false) String kind) {
        String clean = PlaceKind.clean(kind);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] r : popular.places(clean, LIMIT)) {
            Map<String, Object> one = new java.util.LinkedHashMap<>();
            one.put("key", r[0]);
            one.put("name", r[1]);
            one.put("icon", r[2]);
            one.put("lat", r[3] == null ? null : ((Number) r[3]).doubleValue());
            one.put("lng", r[4] == null ? null : ((Number) r[4]).doubleValue());
            one.put("placeId", r[5]);
            one.put("posts", num(r[6]));
            one.put("likes", num(r[7]));
            out.add(one);
        }
        return Map.of("places", out, "kind", clean == null ? "" : clean);
    }

    /** 글에 실제로 쓰인 갈래만. 누를 수 있는 것과 없는 것을 가릅니다. */
    @GetMapping("/api/popular/kinds")
    public Map<String, Object> kinds() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] r : popular.kinds()) {
            String icon = (String) r[0];
            if (PlaceKind.clean(icon) == null) {
                /* 예전에 올린 글에 모르는 이름이 들어 있을 수 있습니다.
                   화면에는 그릴 그림이 없으므로 내보내지 않습니다. */
                continue;
            }
            out.add(Map.of("kind", icon, "places", num(r[1])));
        }
        return Map.of("kinds", out);
    }

    private static long num(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
    }
}
