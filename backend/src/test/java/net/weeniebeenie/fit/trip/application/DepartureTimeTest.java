package net.weeniebeenie.fit.trip.application;

import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.Place;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 대중교통을 언제 타는 것으로 묻는가.
 *
 * <p>전에는 안 보냈습니다. 그러면 구글이 <b>지금</b>으로 잡습니다. 그래서
 * 11월 일정을 새벽에 짜면 그 시각에 안 다니는 노선이 전부 "그런 길 없음"
 * 으로 왔고, 걷기와 차는 시각표가 없어 멀쩡히 나오니 <b>대중교통만 빠진
 * 것처럼</b> 보였습니다.
 *
 * <p>구글 키가 없어도 이 셈은 잽니다. 실제로 노선이 나오는지는 키를 넣고
 * 사람이 봐야 아는 일이고, 여기서 보는 것은 <b>무엇을 물어보는가</b>입니다.
 */
class DepartureTimeTest {

    /** 지금으로부터 며칠 뒤의 날. 구글이 받는 창 안에 두려고 상대로 잡습니다. */
    private static Day dayAfter(long days) {
        return day(LocalDate.now(ZoneOffset.UTC).plusDays(days));
    }

    private static Day day(LocalDate iso) {
        return Day.builder().tripId("t1").sort(0).label("첫째 날").iso(iso).build();
    }

    /** 오사카쯤(동경 135도). 15로 나누면 +9 로 떨어집니다. */
    private static Place at(String time) {
        return place(time, 135.5);
    }

    private static Place place(String time, double lng) {
        Place p = Place.builder().name("어딘가").lat(34.7).lng(lng).build();
        set(p, "time", time);
        return p;
    }

    /** {@code time} 은 빌더에 없어 여기서만 손으로 넣습니다. */
    private static void set(Object target, String name, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(name);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    @DisplayName("적어 둔 시각을 그 날짜에 붙여 묻는다")
    void usesWrittenTime() {
        Instant when = RouteService.departureFor(dayAfter(30), at("12:30"));
        assertNotNull(when);
        /* 동경 135도는 +9. 12:30 현지가 03:30 UTC 입니다. */
        assertEquals(3, when.atZone(ZoneOffset.UTC).getHour());
        assertEquals(30, when.atZone(ZoneOffset.UTC).getMinute());
    }

    @Test
    @DisplayName("자유롭게 적은 것은 시각으로 안 읽는다")
    void freeTextIsNotAClock() {
        /* "점심때쯤" 은 실제로 쓰이는 말입니다. 숫자로 읽으려 들지 않고
           낮(09:00)으로 둡니다 — 집 규칙이 자유 글자를 숫자로 읽지 말라고
           합니다. */
        Instant when = RouteService.departureFor(dayAfter(30), at("점심때쯤"));
        assertNotNull(when);
        assertEquals(0, when.atZone(ZoneOffset.UTC).getHour(), "09:00 현지 = 00:00 UTC");
    }

    @Test
    @DisplayName("시각을 안 적었으면 낮으로 둔다")
    void noTimeMeansDaytime() {
        Instant when = RouteService.departureFor(dayAfter(30), at(null));
        assertNotNull(when);
        assertEquals(0, when.atZone(ZoneOffset.UTC).getHour());
    }

    @Test
    @DisplayName("시간대를 경도로 어림한다")
    void offsetFromLongitude() {
        /* 같은 09:00 이라도 어디냐에 따라 다른 순간입니다. 이것이 없으면
           서울 시계로 파리 지하철을 묻게 됩니다. */
        Instant osaka = RouteService.departureFor(dayAfter(30), place("09:00", 135.5));
        Instant london = RouteService.departureFor(dayAfter(30), place("09:00", 0.0));
        assertNotNull(osaka);
        assertNotNull(london);
        assertEquals(9 * 3600, london.getEpochSecond() - osaka.getEpochSecond(),
                "런던이 아홉 시간 늦게 아침을 맞습니다");
    }

    @Test
    @DisplayName("구글이 안 받는 날짜는 아예 안 보낸다")
    void outsideGooglesWindow() {
        /* 보내면 요청 자체가 거절돼서 그 구간이 통째로 사라집니다. 안 보내면
           지금처럼 현재 시각으로 계산되고, 그건 원래 하던 대로입니다. */
        assertNull(RouteService.departureFor(dayAfter(200), at("12:30")), "너무 먼 뒷날");
        assertNull(RouteService.departureFor(dayAfter(-60), at("12:30")), "너무 먼 지난날");
    }

    @Test
    @DisplayName("날짜를 안 정한 여행은 물을 시각이 없다")
    void noDate() {
        assertNull(RouteService.departureFor(day(null), at("12:30")));
        assertNull(RouteService.departureFor(null, at("12:30")));
    }

    @Test
    @DisplayName("창 안에 있으면 반드시 보낸다")
    void insideWindow() {
        /* 경계 바로 안쪽. 여기서 null 이 나오면 거의 모든 여행이 예전처럼
           "지금" 으로 계산됩니다 — 고친 것이 아무 일도 안 하는 셈입니다. */
        assertNotNull(RouteService.departureFor(dayAfter(90), at("12:30")));
        assertNotNull(RouteService.departureFor(dayAfter(1), at("12:30")));
    }
}
