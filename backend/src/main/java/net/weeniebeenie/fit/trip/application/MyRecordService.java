package net.weeniebeenie.fit.trip.application;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.trip.domain.Trip;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * 마이페이지가 묻는 것 — 내가 남긴 리뷰, 아직 안 남긴 곳, 다녀온 곳.
 *
 * <h3>장소 이름은 구글에 안 묻습니다</h3>
 *
 * <p>리뷰(place_tips)는 <b>구글 장소 번호</b>에 달려 이름을 모릅니다. 이름을
 * 구글에 물으면 리뷰 열한 개에 열한 번입니다. 그런데 그 번호는 내 일정의
 * 장소(places.place_id)에도 들어 있고, 거기에는 이름이 적혀 있습니다. 같은
 * 번호로 이어 붙이면 한 번에 끝납니다. 일정에도 보석함에도 없는 곳(남의 일정
 * 에서 남긴 리뷰)만 이름이 비고, 그때는 화면이 「이름 모르는 곳」으로 둡니다.
 *
 * <h3>다녀온 곳은 「일정에 넣었던 곳」입니다</h3>
 *
 * <p>도장(다녀옴 표시)은 뺐습니다(docs/groups/verdict.md). 남은 길은 <b>끝난
 * 여행의 장소</b>이고, 일정에 넣었지만 안 간 곳도 섞입니다. 화면이 그것을
 * 「일정에 넣었던 곳」이라고 밝힙니다(plan-review Q10).
 *
 * <p>도시·나라 이름은 안 셉니다. 좌표만으로는 안 나오고, 바꾸려면 또 바깥
 * 지명 서비스를 불러야 합니다.
 *
 * <h3>세는 여행은 내가 볼 수 있는 여행</h3>
 *
 * <p>내가 만든 것과 내가 든 모임 것입니다. 모임 여행을 같이 짜고 같이 다녀온
 * 사람에게 그 곳들은 「내가 다녀온 곳」입니다.
 */
@Service
@RequiredArgsConstructor
public class MyRecordService {

    /** 안 남긴 곳 목록의 길이. 다 늘어놓으면 숙제 목록이 됩니다. */
    private static final int UNREVIEWED = 10;

    /** 지도에 찍는 핀 수의 끝. 몇 년치가 쌓이면 지도가 점으로 뒤덮입니다. */
    private static final int PINS = 300;

    private final EntityManager em;
    private final TripAccessPolicy access;

    @Transactional(readOnly = true)
    public Reviews reviewsOf(AuthPrincipal me) {
        /* 번호를 함께 냅니다. 「내가 남긴 것」 칸에서 그 자리에서 고치고
           지우려면 무엇을 고치는지 가리킬 것이 있어야 합니다 —
           /api/tips/{tipId} 가 받는 것이 이 번호입니다. 장소 번호로는 안
           됩니다: 같은 곳에 하루 세 번까지 남길 수 있어 한 장소에 여러
           줄이 있을 수 있습니다(TipService.MAX_PER_DAY). */
        List<Object[]> rows = em.createQuery("""
                        SELECT t.placeId, t.stars, t.text, t.createdAt, t.id, t.editedAt
                        FROM PlaceTip t
                        WHERE t.userId = :me AND t.hidden = false
                        ORDER BY t.createdAt DESC
                        """, Object[].class)
                .setParameter("me", me.id())
                .getResultList();

        Set<String> placeIds = new HashSet<>();
        rows.forEach(r -> placeIds.add((String) r[0]));
        Map<String, String> names = namesOf(placeIds);

        List<Review> reviews = rows.stream()
                .map(r -> new Review((String) r[4], (String) r[0], names.get((String) r[0]),
                        (Integer) r[1], (String) r[2], (Instant) r[3], (Instant) r[5]))
                .toList();

        /* 다녀온 곳 중 리뷰 안 남긴 곳 — 최근 여행 것부터. */
        List<Visited> unreviewed = new ArrayList<>();
        Set<String> seen = new HashSet<>(placeIds);
        for (Object[] p : endedPlaces(me)) {
            String pid = (String) p[0];
            if (pid == null || !seen.add(pid)) {
                continue;
            }
            unreviewed.add(new Visited(pid, (String) p[1], (Double) p[2], (Double) p[3], (String) p[4]));
            if (unreviewed.size() >= UNREVIEWED) {
                break;
            }
        }
        return new Reviews(reviews, unreviewed);
    }

    @Transactional(readOnly = true)
    public Footprint footprintOf(AuthPrincipal me) {
        /* 여행 수는 장소가 없는 끝난 여행도 셉니다 — 다녀온 것은 다녀온 것입니다. */
        Map<String, LocalDate> ended = endedTrips(me);
        List<Object[]> rows = placesOf(ended);
        Set<String> spots = new LinkedHashSet<>();
        List<Pin> pins = new ArrayList<>();
        for (Object[] r : rows) {
            /* 같은 곳을 두 번 갔으면 한 곳입니다. 구글 번호가 없으면 좌표로 가립니다. */
            String key = r[0] != null ? (String) r[0]
                    : String.format(Locale.ROOT, "%.4f,%.4f", (Double) r[2], (Double) r[3]);
            if (spots.add(key) && pins.size() < PINS) {
                pins.add(new Pin((String) r[1], (Double) r[2], (Double) r[3]));
            }
        }
        return new Footprint(spots.size(), ended.size(), pins);
    }

    /**
     * 끝난 여행의 장소들 — 최근 여행이 앞.
     *
     * @return [placeId, name, lat, lng, icon, tripId]
     */
    private List<Object[]> endedPlaces(AuthPrincipal me) {
        return placesOf(endedTrips(me));
    }

    /** 내가 볼 수 있는 여행 중 끝난 것 → 그 마지막 날. */
    private Map<String, LocalDate> endedTrips(AuthPrincipal me) {
        List<String> tripIds = access.tripsOf(me.id()).stream().map(Trip::getId).toList();
        if (tripIds.isEmpty()) {
            return Map.of();
        }
        /* 여행이 끝났는가 — 마지막 날이 오늘보다 앞. 날마다 묻지 않고 한 번에 셉니다. */
        List<Object[]> lastDays = em.createQuery("""
                        SELECT d.tripId, MAX(d.iso)
                        FROM Day d
                        WHERE d.tripId IN :ids
                        GROUP BY d.tripId
                        """, Object[].class)
                .setParameter("ids", tripIds)
                .getResultList();
        LocalDate today = LocalDate.now();
        Map<String, LocalDate> ended = new HashMap<>();
        for (Object[] r : lastDays) {
            if (r[1] != null && ((LocalDate) r[1]).isBefore(today)) {
                ended.put((String) r[0], (LocalDate) r[1]);
            }
        }
        return ended;
    }

    /** @return [placeId, name, lat, lng, icon, tripId] — 최근 여행이 앞 */
    private List<Object[]> placesOf(Map<String, LocalDate> ended) {
        if (ended.isEmpty()) {
            return List.of();
        }
        List<Object[]> rows = em.createQuery("""
                        SELECT p.placeId, p.name, p.lat, p.lng, p.icon, d.tripId
                        FROM Place p, Day d
                        WHERE p.dayId = d.id AND d.tripId IN :ids
                        """, Object[].class)
                .setParameter("ids", ended.keySet())
                .getResultList();
        List<Object[]> out = new ArrayList<>(rows);
        out.sort(Comparator.comparing((Object[] r) -> ended.get((String) r[5])).reversed());
        return out;
    }

    /** 구글 장소 번호 → 이름. 일정의 장소에서 먼저, 없으면 보석함에서. */
    private Map<String, String> namesOf(Collection<String> placeIds) {
        Map<String, String> out = new HashMap<>();
        if (placeIds.isEmpty()) {
            return out;
        }
        for (Object[] r : em.createQuery("""
                        SELECT p.placeId, p.name FROM Place p WHERE p.placeId IN :ids
                        """, Object[].class)
                .setParameter("ids", placeIds)
                .getResultList()) {
            out.putIfAbsent((String) r[0], (String) r[1]);
        }
        for (Object[] r : em.createQuery("""
                        SELECT s.placeId, s.name FROM SavedPlace s WHERE s.placeId IN :ids
                        """, Object[].class)
                .setParameter("ids", placeIds)
                .getResultList()) {
            out.putIfAbsent((String) r[0], (String) r[1]);
        }
        return out;
    }

    /**
     * @param id       그 한 줄의 번호. 고치고 지울 때 가리킵니다
     *                 ({@code /api/tips/{tipId}})
     * @param name     일정·보석함 어디에도 없는 곳이면 비어 있습니다
     * @param editedAt 고친 때. 비어 있으면 안 고친 것입니다
     */
    public record Review(String id, String placeId, String name, Integer stars, String text,
                         Instant at, Instant editedAt) {
    }

    public record Visited(String placeId, String name, Double lat, Double lng, String icon) {
    }

    public record Reviews(List<Review> reviews, List<Visited> unreviewed) {
    }

    public record Pin(String name, Double lat, Double lng) {
    }

    /**
     * @param places 일정에 넣었던 곳(겹치면 하나)
     * @param trips  끝난 여행 수
     */
    public record Footprint(int places, int trips, List<Pin> pins) {
    }
}
