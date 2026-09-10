package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Coordinates;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 말로 묻고 갈 곳을 받습니다.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>지금은 갈 곳의 <b>이름을 알아야</b> 넣을 수 있습니다. "난바 파크스" 는
 * 넣을 수 있지만 "비 올 때 갈 만한 실내" 는 적을 데가 없습니다. 그것은
 * 블로그를 뒤져 이름을 알아낸 다음에야 FIT 으로 돌아오는 일이라, 정작
 * 계획을 세우는 시간의 대부분이 앱 밖에서 흐릅니다.
 *
 * <h3>모델이 없어도 됩니다</h3>
 *
 * <p>구글의 문장 검색은 그런 말을 이미 상당히 잘 먹습니다. 우리가 보태야 할
 * 것은 <b>맥락</b> 입니다 — 구글은 이 사람이 지금 어느 여행의 며칠째를 짜는
 * 중인지 모릅니다. 그래서 서울에서 짜는 오사카 일정에 서울 카페가 올라옵니다.
 *
 * <p>세 가지를 덧댑니다.
 *
 * <ul>
 *   <li><b>어디쯤인가</b> — 일정에 이미 꽂힌 핀들의 한가운데. 여행에 지역
 *       칸을 새로 만들지 않습니다. 핀이 이미 그 답이고, 사람이 한 번 더 적게
 *       하는 것은 손해입니다.</li>
 *   <li><b>언제인가</b> — 그 날짜에 문을 여는지. "추천받아서 갔더니 휴무" 는
 *       추천을 안 하느니만 못합니다.</li>
 *   <li><b>이미 있는가</b> — 일정·후보·보석함 어딘가에 이미 있는 곳이라는
 *       표시. 없으면 같은 곳을 또 담게 되고, 서버가 조용히 무시하면 눌러도
 *       아무 일도 안 일어난 것처럼 보입니다.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class RecommendService {

    /**
     * 여행의 한가운데에서 이만큼 언저리를 봅니다(미터).
     *
     * <p>울타리가 아니라 기울기입니다 — 이 밖의 곳도 나올 수 있고, 나와야
     * 합니다. 근교의 온천처럼 일부러 멀리 나가는 곳이 있습니다.
     */
    private static final int NEAR = 20_000;

    /** 그날 문을 여는지까지 물어볼 곳의 수. 하나마다 구글을 한 번 더 부릅니다. */
    private static final int ASK_HOURS_FOR = 6;

    private final TripAccessPolicy access;
    private final DayRepository days;
    private final PlaceRepository places;
    private final TripCandidateRepository candidates;
    private final SavedPlaceRepository saved;
    private final PlaceSearchService search;
    private final PlaceInfoService info;

    /**
     * @param dayId 없어도 됩니다. 있으면 그 날짜로 영업 여부를 봅니다.
     * @param here  없어도 됩니다. 있으면 여행의 한가운데보다 이쪽을 먼저 봅니다.
     */
    @Transactional(readOnly = true)
    public Result recommend(AuthPrincipal me, String tripId, String query,
                            String dayId, Double hereLat, Double hereLng) {
        return recommend(me, tripId, query, dayId, hereLat, hereLng, null);
    }

    /**
     * @param tripId 없어도 됩니다. 보석함에서 물을 때는 매인 여행이 없습니다 —
     *               그때는 담아 둔 곳들의 한가운데를 봅니다.
     * @param intent 기기 안의 모델이 문장을 미리 쪼개 온 것. 없어도 됩니다 —
     *               없으면 문장을 그대로 구글에 넘깁니다.
     */
    @Transactional(readOnly = true)
    public Result recommend(AuthPrincipal me, String tripId, String query,
                            String dayId, Double hereLat, Double hereLng, Intent intent) {
        boolean inTrip = tripId != null && !tripId.isBlank();
        if (inTrip) {
            access.requireCanRead(tripId, me.id());
        }

        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            throw ApiException.badRequest("무엇을 찾는지 한 줄 적어 주세요.");
        }
        if (q.length() > 200) {
            throw ApiException.badRequest("너무 깁니다. 한 문장으로 줄여 주세요.");
        }

        List<Place> mine = inTrip ? places.findAllOfTrip(tripId) : List.of();

        /*
          어디쯤인가.

          지금 서 있는 자리가 있으면 그쪽이 먼저입니다 — 길 위에서 묻는 것은
          대개 "지금 여기 근처" 라는 뜻입니다.

          없으면 여행에 꽂힌 핀들의 한가운데를 보고, 그것도 없으면(보석함에서
          물었거나 텅 빈 여행이면) 담아 둔 곳들의 한가운데를 봅니다. 담아 둔
          것에도 그 사람이 어디를 다니는지가 담겨 있습니다.
         */
        Coordinates around = hereLat != null && hereLng != null
                ? Coordinates.of(hereLat, hereLng)
                : middleOf(mine);
        List<SavedPlace> box = saved.findAllByUserIdOrderByCreatedAtDesc(me.id());
        if (around == null) {
            around = middleOfSaved(box);
        }

        LocalDate on = null;
        if (dayId != null && !dayId.isBlank()) {
            if (!inTrip) {
                throw ApiException.badRequest("여행 없이 날짜만 고를 수는 없습니다.");
            }
            Day day = days.findById(dayId)
                    .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
            if (!day.getTripId().equals(tripId)) {
                throw ApiException.badRequest("이 여행의 날짜가 아닙니다.");
            }
            on = day.getIso();
        }

        List<PlaceSearchService.Found> found = search.search(
                queryOf(q, intent),
                around == null ? null : around.lat(),
                around == null ? null : around.lng(),
                around == null ? null : NEAR);

        Map<String, String> had = alreadyHave(box, inTrip ? tripId : null, mine);

        List<Card> cards = new ArrayList<>();
        for (PlaceSearchService.Found f : found) {
            Boolean open = null;
            /* 그날 문을 여는지는 장소마다 한 번씩 더 물어야 알 수 있습니다.
               날짜를 정해 놓고 물었을 때만 그 값을 치릅니다. */
            if (on != null && cards.size() < ASK_HOURS_FOR && f.placeId() != null) {
                PlaceInfoService.Info got = info.about(f.placeId(), on);
                if (got != null) {
                    open = !got.closedOnDay() && !got.permanentlyClosed();
                }
            }

            Integer away = around == null ? null
                    : (int) Math.round(around.metersTo(new Coordinates(f.lat(), f.lng())));

            cards.add(new Card(f.name(), f.address(), f.lat(), f.lng(), f.placeId(), f.icon(),
                    f.rating(), f.ratingCount(), open, away,
                    f.placeId() == null ? null : had.get(f.placeId())));
        }

        return new Result(cards, noteFor(cards, around));
    }

    /**
     * 기기가 쪼개 온 것을 검색어로 다시 엮습니다.
     *
     * <p><b>그대로 믿지 않습니다.</b> 기기에서 온 값은 사람이 고칠 수 있는
     * 값입니다. 검증 없이 구글로 흘려보내면 우리 사용량으로 남의 질의를
     * 대신 태우게 됩니다. 갈래는 아는 이름인지 보고, 나머지는 길이를 자릅니다.
     *
     * <p>쪼갠 것이 하나도 쓸 만하지 않으면 원래 문장을 그대로 씁니다. 모델이
     * 헛소리를 해도 사람이 보는 것은 조금 덜 맞는 추천이지 오류 화면이
     * 아닙니다.
     */
    static String queryOf(String plain, Intent intent) {
        if (intent == null) {
            return plain;
        }

        List<String> words = new ArrayList<>();
        String where = trimTo(intent.locationQuery(), 60);
        if (where != null) {
            words.add(where);
        }
        String keyword = trimTo(intent.keyword(), 60);
        if (keyword != null) {
            words.add(keyword);
        }
        /* 갈래는 아는 이름일 때만 씁니다. clean() 이 모르는 것은 비워
           돌려줍니다. */
        String kind = PlaceKind.clean(intent.category());
        if (kind != null) {
            words.add(WORD_FOR.getOrDefault(kind, kind));
        }

        String built = String.join(" ", words).trim();
        return built.isEmpty() ? plain : built;
    }

    private static String trimTo(String raw, int max) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim();
        if (value.isEmpty()) {
            return null;
        }
        return value.length() > max ? value.substring(0, max) : value;
    }

    /**
     * 갈래 이름을 검색어로.
     *
     * <p>구글에 "cafe" 라고 묻는 것보다 "카페" 라고 묻는 편이 한국어 결과에
     * 가깝습니다. 갈래 이름은 우리 안에서만 쓰는 말입니다.
     */
    private static final Map<String, String> WORD_FOR = Map.ofEntries(
            Map.entry("food", "맛집"),
            Map.entry("cafe", "카페"),
            Map.entry("ramen", "라멘"),
            Map.entry("sushi", "초밥"),
            Map.entry("meat", "고깃집"),
            Map.entry("dessert", "디저트"),
            Map.entry("bar", "술집"),
            Map.entry("shop", "쇼핑"),
            Map.entry("sight", "명소"),
            Map.entry("nature", "자연 경관"),
            Map.entry("onsen", "온천"),
            Map.entry("stay", "숙소"),
            Map.entry("move", "역"),
            Map.entry("park", "놀이공원"),
            Map.entry("art", "미술관"),
            Map.entry("show", "공연"));

    /**
     * 문장을 쪼갠 것.
     *
     * <p>기기 안의 모델이 만듭니다. 서버는 만들지 않습니다 — 그러려면 서버가
     * 사람의 문장을 밖으로 내보내야 하는데, "혼자 조용히 있고 싶은 곳" 은
     * 우리 서버도 남의 서버도 알 필요가 없습니다.
     */
    public record Intent(String locationQuery, String category, String keyword) {
    }

    /**
     * 일정에 꽂힌 핀들의 한가운데.
     *
     * <p>평균으로 셉니다. 여행 하나는 대개 한 도시 안이라 이것으로 충분합니다.
     * 도쿄와 오사카를 한 여행에 담으면 그 사이 어딘가가 나오는데, 그때는
     * 날짜를 골라 묻거나 지금 자리를 넘기면 됩니다.
     *
     * <p>좌표를 직접 넣은 곳도 셉니다 — 구글 번호가 없을 뿐 자리는 자리입니다.
     */
    private static Coordinates middleOf(List<Place> places) {
        if (places.isEmpty()) {
            return null;
        }
        double lat = places.stream().mapToDouble(Place::getLat).average().orElse(0);
        double lng = places.stream().mapToDouble(Place::getLng).average().orElse(0);
        return new Coordinates(lat, lng);
    }

    /**
     * 보석함에 담아 둔 곳들의 한가운데.
     *
     * <p>여행에 매이지 않은 자리(보석함)에서 물을 때 씁니다. 담아 둔 것에도
     * 그 사람이 어디를 다니는지가 담겨 있습니다 — 오사카를 스무 곳 담아 둔
     * 사람에게 서울 카페를 내놓을 이유가 없습니다.
     *
     * <p>최근 것 열 곳만 셉니다. 몇 년치를 다 세면 예전에 다녀온 동네가
     * 지금 짜는 것을 끌어당깁니다.
     */
    private static Coordinates middleOfSaved(List<SavedPlace> box) {
        List<SavedPlace> recent = box.size() > 10 ? box.subList(0, 10) : box;
        if (recent.isEmpty()) {
            return null;
        }
        double lat = recent.stream().mapToDouble(SavedPlace::getLat).average().orElse(0);
        double lng = recent.stream().mapToDouble(SavedPlace::getLng).average().orElse(0);
        return new Coordinates(lat, lng);
    }

    /**
     * 이미 어딘가에 담아 둔 곳들.
     *
     * <p>구글 번호로 봅니다. 이름은 사람마다 다르게 적고, 좌표는 같은 건물
     * 안에서도 조금씩 다릅니다.
     *
     * <p>먼저 담은 자리가 이깁니다 — 일정에 이미 들어 있으면 보석함에도
     * 있더라도 "일정에 있음" 이 더 알아야 할 말입니다.
     */
    private Map<String, String> alreadyHave(List<SavedPlace> box, String tripId, List<Place> mine) {
        Map<String, String> out = new HashMap<>();

        box.forEach(s -> {
            if (s.getPlaceId() != null) {
                out.put(s.getPlaceId(), "saved");
            }
        });
        if (tripId != null) {
            candidates.findAllByTripIdOrderByCreatedAtAsc(tripId).forEach(c -> {
                if (c.getPlaceId() != null) {
                    out.put(c.getPlaceId(), "candidate");
                }
            });
        }
        mine.forEach(p -> {
            if (p.getPlaceId() != null) {
                out.put(p.getPlaceId(), "trip");
            }
        });
        return out;
    }

    /**
     * 결과가 왜 이런지 한 줄.
     *
     * <p>빈 목록이나 엉뚱한 목록을 아무 말 없이 내놓으면 무엇이 잘못됐는지
     * 모릅니다. 특히 여행이 텅 비어 있어 어디를 봐야 할지 모를 때는 그것이
     * 이유입니다.
     */
    private static String noteFor(List<Card> cards, Coordinates around) {
        if (cards.isEmpty()) {
            return around == null
                    ? "찾은 곳이 없습니다. 지역 이름을 함께 넣어 보세요 — \"오사카 조용한 카페\"."
                    : "찾은 곳이 없습니다. 조금 다르게 물어보세요.";
        }
        if (around == null) {
            return "어디쯤인지 몰라 넓게 찾았습니다. 지역 이름을 함께 넣으면 더 가까운 곳이 나옵니다.";
        }
        return null;
    }

    /**
     * 추천 카드 하나.
     *
     * @param openOnDay  고른 날에 문을 여는지. 날짜를 안 골랐으면 비어 있습니다.
     * @param distanceM  여행의 한가운데(또는 지금 자리)에서 얼마나 떨어졌는지.
     * @param already    이미 담아 둔 자리 — trip · candidate · saved. 없으면 비어 있습니다.
     */
    public record Card(String name, String address, double lat, double lng, String placeId,
                       String icon, Double rating, Integer ratingCount,
                       Boolean openOnDay, Integer distanceM, String already) {
    }

    public record Result(List<Card> places, String note) {
    }
}
