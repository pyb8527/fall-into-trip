package net.weeniebeenie.fit.trip.application;

import net.weeniebeenie.fit.trip.application.RouteService.Mode;
import net.weeniebeenie.fit.trip.application.RouteService.Option;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 말이 안 되는 걷기.
 *
 * <p>나리타 공항에서 닛포리까지 <b>걸어서 14시간</b>이 나왔습니다. 구글이
 * 대중교통을 안 줬고, 남은 것이 걷기와 차였고, 걷기는 요금이 없어서 "싼 쪽"
 * 추천으로까지 올라갔습니다.
 *
 * <p>그렇다고 시간만 보고 자르면 <b>산길처럼 걷는 것이 곧 목적</b>인 자리를
 * 지웁니다. 그래서 훨씬 나은 대안이 있을 때만 뺍니다.
 */
class SillyWalkTest {

    private static Option walk(int minutes) {
        return new Option(Mode.WALK, minutes * 60, minutes * 80, null, null);
    }

    private static Option drive(int minutes) {
        return new Option(Mode.DRIVE, minutes * 60, minutes * 800, null, null);
    }

    private static Option transit(int minutes) {
        return new Option(Mode.TRANSIT, minutes * 60, minutes * 600, null, null);
    }

    private static List<Option> box(Option... given) {
        return new ArrayList<>(List.of(given));
    }

    private static boolean hasWalk(List<Option> options) {
        return options.stream().anyMatch(o -> o.mode() == Mode.WALK);
    }

    @Test
    @DisplayName("나리타에서 닛포리까지 걸어가라고 하지 않는다")
    void narita() {
        /* 이것이 이 묶음의 이유입니다. 걸어서 14시간, 차로 1시간. */
        List<Option> options = box(walk(14 * 60), drive(60));
        RouteService.dropSillyWalk(options);
        assertFalse(hasWalk(options), "걸어서 14시간은 고를 것이 아닙니다");
        assertEquals(1, options.size());
    }

    @Test
    @DisplayName("30분 걷기는 그대로 둔다")
    void shortWalkStays() {
        /* 5분이면 갈 길을 30분 걷는 사람이 있습니다. 돈을 아끼려고도 하고
           그냥 걷고 싶어서도 합니다. 여섯 배가 나도 건드리지 않습니다. */
        List<Option> options = box(walk(30), drive(5));
        RouteService.dropSillyWalk(options);
        assertTrue(hasWalk(options));
    }

    @Test
    @DisplayName("걷는 것 말고 길이 없으면 몇 시간이 걸려도 둔다")
    void onlyWayStays() {
        /* 산길이나 둘레길. 그때는 그것이 유일한 답입니다. */
        List<Option> options = box(walk(4 * 60));
        RouteService.dropSillyWalk(options);
        assertTrue(hasWalk(options), "대안이 없으면 그것이 답입니다");
    }

    @Test
    @DisplayName("대안이 조금 빠른 정도면 둔다")
    void slightlyFasterKeepsWalk() {
        /* 두 시간 걷기 vs 한 시간 대중교통. 두 배라 세 배에 못 미칩니다.
           걷고 싶은 사람이 고를 만합니다. */
        List<Option> options = box(walk(120), transit(60));
        RouteService.dropSillyWalk(options);
        assertTrue(hasWalk(options));
    }

    @Test
    @DisplayName("대중교통이 있으면 그것과 견준다")
    void comparesAgainstTheFastestAlternative() {
        /* 차가 느려도 대중교통이 빠르면 그쪽이 기준입니다. */
        List<Option> options = box(walk(10 * 60), drive(9 * 60), transit(40));
        RouteService.dropSillyWalk(options);
        assertFalse(hasWalk(options));
        assertEquals(2, options.size());
    }

    @Test
    @DisplayName("걷기가 아예 없으면 아무 일도 안 한다")
    void noWalk() {
        List<Option> options = box(drive(60), transit(40));
        RouteService.dropSillyWalk(options);
        assertEquals(2, options.size());
    }

    @Test
    @DisplayName("뺀 뒤에는 싼 쪽 추천도 걷기가 아니다")
    void cheapestIsNotAFourteenHourWalk() {
        /* 진짜 고장은 여기였습니다. 걷기는 요금이 없어 0원으로 세는데,
           그래서 14시간 걷기가 1시간 택시보다 "싸다" 고 뽑혔습니다. */
        List<Option> options = box(walk(14 * 60), drive(60));
        RouteService.dropSillyWalk(options);
        assertEquals(Mode.DRIVE, RouteService.cheapestOf(options));
        assertEquals(Mode.DRIVE, RouteService.fastestOf(options));
    }
}
