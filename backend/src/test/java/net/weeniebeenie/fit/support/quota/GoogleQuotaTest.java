package net.weeniebeenie.fit.support.quota;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static net.weeniebeenie.fit.support.quota.GoogleQuotaFilter.callsOf;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 구글로 나가는 길목의 문턱.
 *
 * <p>여기가 틀리면 두 가지로 잘못됩니다. 값을 너무 낮게 잡으면 문턱이 뜻대로
 * 안 서서 청구서로 배우게 되고, 상관없는 자리에 값을 매기면 멀쩡한 화면이
 * 막힙니다. 둘 다 조용히 일어나므로 시험으로 붙잡아 둡니다.
 */
class GoogleQuotaTest {

    @Test
    @DisplayName("구글과 상관없는 자리는 세지 않는다")
    void freePaths() {
        assertEquals(0, callsOf("GET", "/api/trips"));
        assertEquals(0, callsOf("GET", "/api/trip"));
        assertEquals(0, callsOf("POST", "/api/places"));
        assertEquals(0, callsOf("POST", "/api/places/reorder"));
        assertEquals(0, callsOf("GET", "/api/saved"));
        assertEquals(0, callsOf("POST", "/api/auth/login"));
        /* 동선 정리는 직선거리로 잽니다. 구글을 부르지 않습니다. */
        assertEquals(0, callsOf("GET", "/api/places/tidy"));
    }

    @Test
    @DisplayName("무거운 자리는 그만큼 세게 센다")
    void weighted() {
        /* 검색 하나 + 그날 문 여는지 여섯. */
        assertEquals(7, callsOf("POST", "/api/recommend"));
        assertEquals(7, callsOf("POST", "/api/trips/abc/recommend"));
        /* 그 날의 장소마다 하나씩, 열둘까지. */
        assertEquals(12, callsOf("GET", "/api/days/abc/places-info"));
        /* 걷기·대중교통·택시를 각각 물어봅니다. */
        assertEquals(3, callsOf("GET", "/api/days/abc/route/compare"));
    }

    @Test
    @DisplayName("가벼운 자리는 한 번")
    void single() {
        assertEquals(1, callsOf("GET", "/api/places/search"));
        assertEquals(1, callsOf("GET", "/api/places/ChIJabc/info"));
        assertEquals(1, callsOf("GET", "/api/days/abc/route"));
        assertEquals(1, callsOf("POST", "/api/places/abc/route"));
        assertEquals(1, callsOf("GET", "/api/posts/abc/map"));
    }

    @Test
    @DisplayName("추천은 보내는 것만 센다")
    void onlyPost() {
        /* 같은 주소로 GET 이 올 일은 없지만, 온다 해도 구글을 부르지
           않습니다. 있지도 않은 값을 세면 안 됩니다. */
        assertEquals(0, callsOf("GET", "/api/recommend"));
    }

    @Test
    @DisplayName("한도를 넘으면 막고, 그 전까지는 통과시킨다")
    void stopsAtTheLimit() {
        GoogleQuota quota = new GoogleQuota();

        /* 한 시간에 150. 열두 번짜리를 열두 번 부르면 144 로 아직 남습니다. */
        for (int i = 0; i < 12; i++) {
            assertTrue(quota.spend("u:1", 12), "아직 남아 있어야 합니다 (" + i + ")");
        }
        /* 여기서 156 이 되어 넘어갑니다. */
        assertFalse(quota.spend("u:1", 12));
    }

    @Test
    @DisplayName("사람마다 따로 센다")
    void perPerson() {
        GoogleQuota quota = new GoogleQuota();
        for (int i = 0; i < 12; i++) {
            quota.spend("u:1", 12);
        }
        assertFalse(quota.spend("u:1", 12));
        /* 옆 사람이 많이 썼다고 내가 막히면 안 됩니다. */
        assertTrue(quota.spend("u:2", 12));
    }
}
