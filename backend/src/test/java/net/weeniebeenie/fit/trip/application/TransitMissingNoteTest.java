package net.weeniebeenie.fit.trip.application;

import net.weeniebeenie.fit.trip.domain.Place;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 대중교통이 하나도 없을 때 말해 줄 것인가.
 *
 * <p>구글은 일본에 대중교통 길찾기를 <b>API 로 주지 않습니다.</b> 걷기·자전거·
 * 차는 주고 대중교통만 안 줍니다. 오류가 아니라 빈 답이 옵니다.
 *
 * <p>그동안 우리는 그것을 조용히 지웠습니다. 그래서 쓰는 사람은 앱이 고장 난
 * 줄 알았습니다 — 구글 지도에는 나오는 스카이라이너가 여기만 없으니까요.
 *
 * <p>다만 구간 하나가 비는 것은 흔합니다. 몇백 미터에 전철이 없는 것은 맞는
 * 답이라, 그것까지 "이 지역은 대중교통이 없다" 로 읽으면 안 됩니다.
 */
class TransitMissingNoteTest {

    private static Place at(double lat, double lng) {
        return Place.builder().name("어딘가").lat(lat).lng(lng).build();
    }

    /** 로그에 찍힌 좌표 그대로. */
    private static final Place NARITA = at(35.770178, 140.3843215);
    private static final Place NIPPORI = at(35.7281578, 139.7706414);
    private static final Place UENO = at(35.6905894, 139.7684302);

    @Test
    @DisplayName("나리타에서 닛포리는 전철을 탈 만한 거리다")
    void narita() {
        assertTrue(RouteService.farApart(NARITA, NIPPORI), "55km");
    }

    @Test
    @DisplayName("도쿄 안 4km도 전철을 탈 만한 거리다")
    void withinTokyo() {
        /* 이것이 결정적이었습니다. 55km 만 비었으면 거리 탓이라고 볼 수
           있었는데, 도쿄 한복판 4km 도 똑같이 비어 있었습니다. */
        assertTrue(RouteService.farApart(NIPPORI, UENO), "4.2km");
    }

    @Test
    @DisplayName("몇백 미터는 전철을 탈 거리가 아니다")
    void tooClose() {
        assertFalse(RouteService.farApart(UENO, at(35.6821886, 139.7686315)), "0.9km");
        assertFalse(RouteService.farApart(at(35.6795336, 139.7654445),
                at(35.6800519, 139.7678455)), "0.3km");
    }

    @Test
    @DisplayName("탈 만한 구간이 있는데 하나도 안 나오면 말해 준다")
    void saysWhenNoneAtAll() {
        String note = RouteService.noteFor(3, 0);
        assertNotNull(note);
        assertTrue(note.contains("구글"), note);
    }

    @Test
    @DisplayName("하나라도 나왔으면 말하지 않는다")
    void silentWhenSomeWork() {
        /* 그 지역에 대중교통 안내가 있다는 뜻입니다. 한 구간이 비는 것은
           그냥 그 구간 사정입니다. */
        assertNull(RouteService.noteFor(3, 1));
    }

    @Test
    @DisplayName("짧은 구간만 있는 하루에는 말하지 않는다")
    void silentWhenEverythingIsClose() {
        /* 걸어 다니는 하루입니다. 전철이 안 나오는 것이 맞는 답이라,
           "이 지역은 대중교통이 없다" 로 읽으면 틀립니다. */
        assertNull(RouteService.noteFor(0, 0));
    }
}
