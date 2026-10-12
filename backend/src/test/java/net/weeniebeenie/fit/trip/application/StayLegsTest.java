package net.weeniebeenie.fit.trip.application;

import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.Place;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 숙소를 그날 동선의 앞뒤에 — 어느 구간을 묻는가.
 *
 * <p>하루를 펼치면 장소와 장소 사이에 이동 시간이 붙는데, 숙소는 그 줄에
 * 없었습니다. 「호텔에서 첫 곳까지」 와 「마지막 곳에서 호텔까지」 를 이제
 * 함께 묻습니다.
 *
 * <p>확인용 서버에는 구글 키가 없어 {@code /route/compare} 가 400 으로
 * 끊깁니다. 그래서 <b>어느 두 곳을 묻는가</b>는 여기서 구글 없이 잽니다 —
 * {@link DepartureTimeTest} 가 같은 이유로 그렇게 섰습니다. 실제로 몇 분이
 * 나오는지는 키를 넣고 사람이 봐야 압니다.
 */
class StayLegsTest {

    /** 오사카 난바쯤. 장소들은 여기서 수백 미터씩 떨어뜨립니다. */
    private static final double LAT = 34.6650;
    private static final double LNG = 135.5010;

    private static Day day(int sort) {
        return Day.builder().tripId("t1").sort(sort).label((sort + 1) + "일째").build();
    }

    private static Day stayAt(Day day, String name, Double lat, Double lng) {
        day.setStayName(name);
        day.setStayLat(lat);
        day.setStayLng(lng);
        return day;
    }

    private static Place place(String name, double lat, double lng) {
        return Place.builder().name(name).lat(lat).lng(lng).build();
    }

    /** 위도로 0.01 이 1.1km 남짓 — 서로 100m 문턱보다 넉넉히 떨어집니다. */
    private static List<Place> places(int n) {
        List<Place> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            out.add(place("곳" + (i + 1), LAT + 0.01 * (i + 1), LNG));
        }
        return out;
    }

    @Test
    @DisplayName("둘째 날 아침은 첫째 날 숙소에서 나선다 — 그날 숙소가 아니다")
    void morningIsLastNight() {
        /* 체크아웃하고 옮기는 날입니다. 그날 숙소에서 나서게 하면 아직
           들어가지도 않은 호텔에서 출발합니다. */
        Day first = stayAt(day(0), "난바 호텔", LAT, LNG);
        Day second = stayAt(day(1), "교토 료칸", 35.0, 135.76);
        Day third = day(2);

        RouteService.StayEnds ends = RouteService.stayEnds(List.of(first, second, third), second);

        assertNotNull(ends.morning());
        assertEquals("난바 호텔", ends.morning().getName());
        assertEquals(LAT, ends.morning().getLat());
        assertNotNull(ends.evening());
        assertEquals("교토 료칸", ends.evening().getName());
    }

    @Test
    @DisplayName("첫째 날은 아침 구간이 없다")
    void firstDayHasNoMorning() {
        Day first = stayAt(day(0), "난바 호텔", LAT, LNG);
        Day second = day(1);

        RouteService.StayEnds ends = RouteService.stayEnds(List.of(first, second), first);

        assertNull(ends.morning(), "앞 날이 없습니다");
        assertNotNull(ends.evening(), "그날 밤 숙소로는 돌아갑니다");
    }

    @Test
    @DisplayName("앞 날에 숙소 이름만 있고 좌표가 없으면 아침 구간이 없다")
    void nameOnlyIsNotAnEnd() {
        /* 이름만으로는 구글에 물을 수 없습니다. */
        Day first = stayAt(day(0), "어딘가 게스트하우스", null, null);
        Day second = day(1);

        RouteService.StayEnds ends = RouteService.stayEnds(List.of(first, second), second);
        RouteService.Planned plan = RouteService.legsOf(places(3), ends, 24);

        assertNull(ends.morning());
        assertNull(plan.morning());
        assertEquals(2, plan.between().size());
    }

    @Test
    @DisplayName("마지막 날은 숙소가 적혀 있어도 저녁 구간이 없다")
    void lastDayIgnoresItsStay() {
        /* 「이후 날들도 같은 곳」 으로 채우면 공항 가는 날에도 숙소가
           적힙니다. 체크아웃한 호텔로 돌아가는 구간을 묻지 않습니다. */
        Day first = stayAt(day(0), "난바 호텔", LAT, LNG);
        Day last = stayAt(day(1), "난바 호텔", LAT, LNG);

        RouteService.StayEnds ends = RouteService.stayEnds(List.of(first, last), last);
        RouteService.Planned plan = RouteService.legsOf(places(3), ends, 24);

        assertNotNull(plan.morning(), "아침은 어젯밤 숙소에서");
        assertNull(ends.evening());
        assertNull(plan.evening());
    }

    @Test
    @DisplayName("그날 숙소가 없으면 저녁 구간이 없다 — 집에 가는 마지막 날")
    void lastDayHasNoEvening() {
        Day first = stayAt(day(0), "난바 호텔", LAT, LNG);
        Day last = day(1);

        RouteService.StayEnds ends = RouteService.stayEnds(List.of(first, last), last);
        RouteService.Planned plan = RouteService.legsOf(places(3), ends, 24);

        assertNotNull(plan.morning(), "아침은 어젯밤 숙소에서");
        assertNull(plan.evening());
        assertFalse(plan.trimmed());
    }

    @Test
    @DisplayName("숙소가 첫 곳과 100m 안이면 그 구간은 묻지 않는다")
    void staySameAsFirstPlace() {
        /* 숙소 칸이 생기기 전부터 숙소를 장소로도 넣어 온 사람입니다.
           「호텔에서 호텔까지 0분」 을 세 수단으로 사 올 까닭이 없습니다. */
        Day first = stayAt(day(0), "난바 호텔", LAT, LNG);
        Day second = stayAt(day(1), "난바 호텔", LAT, LNG);
        List<Place> list = new ArrayList<>();
        list.add(place("난바 호텔(장소로도 넣음)", LAT + 0.0003, LNG)); // 30m 남짓
        list.addAll(places(2));
        list.add(place("난바 호텔(돌아옴)", LAT, LNG + 0.0005));      // 45m 남짓

        RouteService.Planned plan = RouteService.legsOf(list,
                RouteService.stayEnds(List.of(first, second), second), 24);

        assertNull(plan.morning(), "숙소 = 첫 곳");
        assertNull(plan.evening(), "마지막 곳 = 숙소");
        assertEquals(3, plan.between().size(), "장소 사이는 그대로");
    }

    @Test
    @DisplayName("장소가 하나뿐인 날도 아침과 저녁 구간이 나온다")
    void onePlaceStillHasStayLegs() {
        /* 전에는 장소가 둘 미만이면 아무것도 안 물었습니다. 「호텔에서 그
           한 곳까지」 도 묻는 값입니다. */
        Day first = stayAt(day(0), "난바 호텔", LAT, LNG);
        Day second = stayAt(day(1), "우메다 호텔", 34.7025, 135.4959);
        Day third = day(2);
        List<Place> one = List.of(place("오사카성", 34.6873, 135.5262));

        RouteService.Planned plan = RouteService.legsOf(one,
                RouteService.stayEnds(List.of(first, second, third), second), 24);

        assertTrue(plan.between().isEmpty());
        assertNotNull(plan.morning());
        assertEquals("난바 호텔", plan.morning().from().getName());
        assertSame(one.get(0), plan.morning().to());
        assertNotNull(plan.evening());
        assertSame(one.get(0), plan.evening().from());
        assertEquals("우메다 호텔", plan.evening().to().getName());
    }

    @Test
    @DisplayName("장소 25곳이면 아침 1 + 사이 23 — 저녁은 빠지고 잘렸다고 말한다")
    void stayLegsShareTheLimit() {
        /* 한도 24 는 요금 울타리입니다. 숙소 구간도 그 안에서 셉니다.
           아침이 먼저 자리를 잡고, 장소 사이가 잘렸으면 저녁은 붙이지
           않습니다 — 마지막 곳 위로 빈 구간이 생긴 채 호텔까지만 나오면
           그 빈칸이 어디서 왔는지 알 수 없습니다. */
        Day first = stayAt(day(0), "난바 호텔", LAT, LNG);
        Day second = stayAt(day(1), "우메다 호텔", 34.7025, 135.4959);
        List<Place> list = places(25);

        RouteService.Planned plan = RouteService.legsOf(list,
                RouteService.stayEnds(List.of(first, second), second), 24);

        assertNotNull(plan.morning());
        assertEquals(23, plan.between().size());
        assertSame(list.get(22), plan.between().get(22).from());
        assertNull(plan.evening());
        assertTrue(plan.trimmed());
    }
}
