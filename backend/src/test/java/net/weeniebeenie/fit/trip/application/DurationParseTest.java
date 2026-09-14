package net.weeniebeenie.fit.trip.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static net.weeniebeenie.fit.trip.application.RouteService.seconds;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 구글이 준 소요시간을 읽는 자리.
 *
 * <p>여기가 <b>조용히 수단을 지우고 있었습니다.</b> 구글의 {@code Duration}
 * 은 프로토버프 JSON 규칙을 따라 소수점이 붙어 옵니다. 그것을
 * {@code Integer.parseInt} 로 읽으면 터지고 0초가 되는데,
 * {@code compare} 가 {@code seconds() > 0} 으로 거르므로 그 수단이 목록에서
 * 사라졌습니다.
 *
 * <p><b>로그도 안 남습니다.</b> 경로는 멀쩡히 왔고 우리가 못 읽은 것뿐이라,
 * "경로가 비었습니다" 도 "경로를 받지 못했습니다" 도 안 찍힙니다. 그래서
 * 구글맵에는 나오는 대중교통이 우리 앱에서만 없었습니다.
 */
class DurationParseTest {

    @Test
    @DisplayName("소수점이 붙어 와도 읽는다")
    void fractional() {
        /* 이것이 이 묶음의 이유입니다. 전에는 전부 0 이었습니다. */
        assertEquals(2346, seconds("2345.500s"));
        assertEquals(2345, seconds("2345.400s"));
        assertEquals(600, seconds("600.000s"));
        assertEquals(3, seconds("3.000000001s"));
    }

    @Test
    @DisplayName("정수로 와도 그대로 읽는다")
    void whole() {
        assertEquals(2345, seconds("2345s"));
        assertEquals(600, seconds("600"));
    }

    @Test
    @DisplayName("못 읽는 것은 0")
    void unreadable() {
        /* 0 은 "못 읽었다" 는 뜻입니다. 실제로 0초 걸리는 구간은 없습니다. */
        assertEquals(0, seconds(null));
        assertEquals(0, seconds(""));
        assertEquals(0, seconds("   "));
        assertEquals(0, seconds("한참s"));
        assertEquals(0, seconds("s"));
    }

    @Test
    @DisplayName("음수는 0으로 둔다")
    void negative() {
        assertEquals(0, seconds("-10s"));
    }

    @Test
    @DisplayName("나리타에서 닛포리까지가 사라지지 않는다")
    void narita() {
        /* 스카이라이너 41분. 소수점이 붙어 오면 전에는 0 이 됐고, compare 가
           seconds() > 0 으로 걸러서 대중교통이 통째로 빠졌습니다. */
        int got = seconds("2460.000s");
        assertTrue(got > 0, "0 이면 이 수단이 화면에서 사라집니다");
        assertEquals(41, got / 60);
    }
}
