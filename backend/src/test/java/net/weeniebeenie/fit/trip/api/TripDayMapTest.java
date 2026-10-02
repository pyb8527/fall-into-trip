package net.weeniebeenie.fit.trip.api;

import net.weeniebeenie.fit.trip.api.TripMapController.DayRoute;
import net.weeniebeenie.fit.trip.api.TripMapController.OneDay;
import net.weeniebeenie.fit.trip.application.StaticMapService.Point;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 달력에서 누른 날의 동선을 고르는 일.
 *
 * <p>재는 것은 둘입니다. <b>그 날의 곳들을 맞게 집는가</b>, 그리고 <b>여행
 * 전체 그림이 그 날에 쓰는 색을 맞게 세는가.</b>
 *
 * <p>색이 어긋나면 눈에 바로 걸립니다 — 달력에서 누른 날은 파랑인데 여행을
 * 열어 보면 그 날이 초록이라, 같은 날이 다른 날로 읽힙니다. 전체 그림은
 * 곳이 없는 날을 아예 걷어 내고 색을 돌리므로(StaticMapService 의
 * {@code thinDays}), 여기서도 빈 날을 세지 않아야 같아집니다.
 */
class TripDayMapTest {

    private static final LocalDate D1 = LocalDate.of(2026, 10, 8);
    private static final LocalDate D2 = LocalDate.of(2026, 10, 9);
    private static final LocalDate D3 = LocalDate.of(2026, 10, 10);

    private static DayRoute day(LocalDate iso, double... lats) {
        List<Point> points = new java.util.ArrayList<>();
        for (double lat : lats) {
            points.add(new Point(lat, 135.5));
        }
        return new DayRoute(iso, points);
    }

    @Test
    @DisplayName("누른 날의 곳들만 집는다")
    void picksThatDay() {
        OneDay one = TripMapController.onlyOn(
                List.of(day(D1, 34.1, 34.2), day(D2, 34.7, 34.8, 34.9)), D2);

        assertEquals(3, one.points().size());
        assertEquals(34.7, one.points().get(0).lat());
    }

    @Test
    @DisplayName("몇째 날인지가 색이 된다")
    void colorFollowsOrder() {
        List<DayRoute> trip = List.of(day(D1, 34.1), day(D2, 34.2), day(D3, 34.3));

        assertEquals(0, TripMapController.onlyOn(trip, D1).color());
        assertEquals(1, TripMapController.onlyOn(trip, D2).color());
        assertEquals(2, TripMapController.onlyOn(trip, D3).color());
    }

    @Test
    @DisplayName("곳이 없는 날은 색을 한 칸 먹지 않는다")
    void emptyDayTakesNoColor() {
        /* 이것이 이 묶음의 핵심입니다. 전체 그림이 빈 날을 걷어 내므로
           셋째 날의 색은 세 번째가 아니라 두 번째입니다. */
        List<DayRoute> trip = List.of(day(D1, 34.1), day(D2), day(D3, 34.3));

        assertEquals(1, TripMapController.onlyOn(trip, D3).color());
    }

    @Test
    @DisplayName("곳이 하나뿐인 날도 그린다")
    void onePlaceStillDraws() {
        /* 선은 못 그려도 핀 하나는 「이날 여기」를 말합니다. */
        OneDay one = TripMapController.onlyOn(List.of(day(D1, 34.1)), D1);

        assertEquals(1, one.points().size());
    }

    @Test
    @DisplayName("빈 날을 누르면 그릴 것이 없다")
    void emptyDayDrawsNothing() {
        assertNull(TripMapController.onlyOn(List.of(day(D1, 34.1), day(D2)), D2));
    }

    @Test
    @DisplayName("그 여행에 없는 날짜면 그릴 것이 없다")
    void unknownDateDrawsNothing() {
        assertNull(TripMapController.onlyOn(List.of(day(D1, 34.1)), D3));
    }

    @Test
    @DisplayName("날짜를 안 정한 날은 날짜로 찾히지 않는다")
    void undatedDayIsUnreachable() {
        /* 날짜 없는 날은 달력에 올라가지 않습니다. 그 날의 곳들이 다른 날을
           누를 때 끼어들면 안 됩니다. */
        assertNull(TripMapController.onlyOn(List.of(day(null, 34.1)), D1));
    }

    @Test
    @DisplayName("같은 날짜가 둘이면 곳이 있는 첫 번째를 그린다")
    void firstDatedDayWins() {
        OneDay one = TripMapController.onlyOn(List.of(day(D1), day(D1, 34.5)), D1);

        assertEquals(34.5, one.points().get(0).lat());
        assertEquals(0, one.color());
    }
}
