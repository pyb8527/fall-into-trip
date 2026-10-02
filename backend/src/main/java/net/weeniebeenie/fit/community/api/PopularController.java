package net.weeniebeenie.fit.community.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.community.application.Near;
import net.weeniebeenie.fit.community.application.PostService;
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
 *
 * <h3>자리를 주면 「지금 내 근처」가 됩니다</h3>
 *
 * <p>같은 목록을 내 좌표로 다시 세운 것입니다({@code near}). 화면을 하나 더
 * 만들지 않았습니다 — 세는 법도 감춘 글을 빼는 규칙도 같고, 다른 것은
 * <b>무엇을 앞에 세우는가</b> 하나뿐입니다.
 *
 * <p>좌표는 주소에 실려 옵니다. 접근 기록에 남는 값이라 꺼림칙한 자리인데,
 * 그림 주소({@code /api/maps/spot})가 이미 같은 일을 하고 있어 여기만 본문
 * 으로 받는 것은 뜻이 없습니다. 대신 로그인과 묶이지 않습니다 — 누가 거기
 * 있었는지는 안 남습니다.
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
     * @param kind   갈래로 거를 때. 모르는 이름은 안 거른 것으로 봅니다 —
     *               화면에서 넘어온 값을 그대로 쿼리에 넣지 않습니다.
     * @param region 지역으로 거를 때. 같은 규칙입니다. 갈래만으로 거르면
     *               "카페" 를 눌렀을 때 도쿄와 제주가 한 목록에 섞여 나오는데,
     *               정작 보는 사람은 대개 갈 곳을 하나 정해 두고 봅니다
     * @param near   지금 내 자리("37.5665,126.9780"). 주면 <b>가까운 순</b>
     *               으로 세우고 {@code Near.RADIUS_M} 안쪽만 냅니다. 못 읽는
     *               값은 안 준 것으로 봅니다 — 갈래·지역과 같은 규칙입니다
     */
    @GetMapping("/api/popular/places")
    public Map<String, Object> places(@RequestParam(required = false) String kind,
                                      @RequestParam(required = false) String region,
                                      @RequestParam(required = false) String near) {
        String clean = PlaceKind.clean(kind);
        String where = known(region);
        Near at = Near.parse(near);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] r : popular.places(clean, where,
                at.lat(), at.lng(), at.south(), at.north(), at.west(), at.east(),
                Near.RADIUS_M, LIMIT)) {
            Map<String, Object> one = new java.util.LinkedHashMap<>();
            one.put("key", r[0]);
            one.put("name", r[1]);
            one.put("icon", r[2]);
            one.put("lat", r[3] == null ? null : ((Number) r[3]).doubleValue());
            one.put("lng", r[4] == null ? null : ((Number) r[4]).doubleValue());
            one.put("placeId", r[5]);
            one.put("posts", num(r[6]));
            one.put("likes", num(r[7]));
            /* 미터 단위 정수입니다. 추천 판이 이미 그 이름과 단위로 받고
               있어서({@code RecommendService.Card.distanceM}) 화면이 거리를
               적는 함수를 그대로 씁니다 — 한쪽만 소수로 내면 같은 말을 두
               가지로 적게 됩니다. */
            one.put("distanceM", r[8] == null ? null : Math.round(((Number) r[8]).doubleValue()));
            out.add(one);
        }
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("places", out);
        body.put("kind", clean == null ? "" : clean);
        body.put("region", where == null ? "" : where);
        /*
          자리를 <b>실제로 썼는지</b>를 함께 내려 줍니다.

          <p>화면이 보낸 값이 못 읽히면 목록은 인기순으로 내려가는데, 그때
          화면이 제목을 「지금 내 근처」로 적어 두면 가깝지도 않은 목록에
          그 제목이 붙습니다. 보낸 쪽이 아니라 <b>센 쪽</b>이 말해야 합니다.
        */
        body.put("near", at.given());
        /* 「30km 안쪽에는 없어요」를 화면이 적을 수 있게 거리도 함께 냅니다.
           두 곳에 적어 두면 서버만 고쳤을 때 화면이 옛 숫자를 말합니다. */
        body.put("radiusM", Near.RADIUS_M);
        return body;
    }

    /**
     * 아는 지역인지.
     *
     * <p>PostService 가 글을 올릴 때 쓰는 것과 같은 목록입니다. 화면에서
     * 넘어온 값을 그대로 쿼리에 넣지 않습니다 — 모르는 이름은 안 거른
     * 것으로 봅니다.
     */
    private static String known(String region) {
        return region != null && PostService.REGIONS.contains(region) ? region : null;
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
