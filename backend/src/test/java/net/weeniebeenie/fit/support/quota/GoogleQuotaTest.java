package net.weeniebeenie.fit.support.quota;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static net.weeniebeenie.fit.support.quota.GoogleQuotaFilter.touchesGoogle;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 구글로 나가는 길목의 문턱.
 *
 * <p>여기가 틀리면 두 가지로 잘못됩니다. 문턱이 뜻대로 안 서면 청구서로
 * 배우게 되고, 상관없는 자리를 막으면 멀쩡한 화면이 죽습니다. 둘 다 조용히
 * 일어나므로 시험으로 붙잡아 둡니다.
 *
 * <p><b>세는 값이 아니라 여는 자리를 봅니다.</b> 전에는 이 자리가 "이 경로는
 * 열두 번 부를 것" 같은 추정을 들고 있었고, 그 추정이 실제와 양쪽으로
 * 틀렸습니다. 이제 몇 번 부를지는 부르는 쪽이 셉니다 — 여기는 "구글을 부를
 * 수 있는 자리인가" 만 압니다.
 */
class GoogleQuotaTest {

    @Test
    @DisplayName("구글과 상관없는 자리는 문턱을 안 지난다")
    void freePaths() {
        assertFalse(touchesGoogle("GET", "/api/trips"));
        assertFalse(touchesGoogle("GET", "/api/trip"));
        assertFalse(touchesGoogle("POST", "/api/places"));
        assertFalse(touchesGoogle("POST", "/api/places/reorder"));
        assertFalse(touchesGoogle("GET", "/api/saved"));
        assertFalse(touchesGoogle("POST", "/api/auth/login"));
        /* 동선 정리는 직선거리로 잽니다. 구글을 부르지 않습니다. */
        assertFalse(touchesGoogle("GET", "/api/places/tidy"));
    }

    @Test
    @DisplayName("구글을 부를 수 있는 자리는 지난다")
    void googlePaths() {
        assertTrue(touchesGoogle("GET", "/api/places/search"));
        assertTrue(touchesGoogle("POST", "/api/recommend"));
        assertTrue(touchesGoogle("POST", "/api/trips/abc/recommend"));
        assertTrue(touchesGoogle("GET", "/api/days/abc/places-info"));
        assertTrue(touchesGoogle("GET", "/api/days/abc/route/compare"));
        assertTrue(touchesGoogle("GET", "/api/days/abc/route"));
        assertTrue(touchesGoogle("GET", "/api/places/ChIJabc/info"));
        assertTrue(touchesGoogle("GET", "/api/posts/abc/map"));
    }

    @Test
    @DisplayName("추천은 보내는 것만")
    void onlyPost() {
        /* 같은 주소로 GET 이 올 일은 없지만, 온다 해도 구글을 부르지
           않습니다. 있지도 않은 자리를 막으면 안 됩니다. */
        assertFalse(touchesGoogle("GET", "/api/recommend"));
    }

    @Test
    @DisplayName("한도를 넘으면 막고, 그 전까지는 통과시킨다")
    void stopsAtTheLimit() {
        GoogleQuota quota = new GoogleQuota();

        /* 한 시간에 150. 열둘씩 열두 번이면 144 로 아직 남습니다. */
        for (int i = 0; i < 12; i++) {
            assertTrue(quota.spend("u:1", 12), "아직 남아 있어야 합니다 (" + i + ")");
        }
        /* 여기서 156 이 되어 넘어갑니다. */
        assertFalse(quota.spend("u:1", 12));
    }

    @Test
    @DisplayName("막힌 것은 안 쌓인다")
    void refusedDoesNotAccumulate() {
        GoogleQuota quota = new GoogleQuota();
        for (int i = 0; i < 12; i++) {
            quota.spend("u:1", 12);                 // 144
        }
        /* 열둘은 안 들어갑니다(156). 그런데 못 쓴 것을 쌓아 두면, 걸린 사람이
           새로고침할수록 더 깊이 들어가 창이 끝날 때까지 안 풀립니다. */
        assertFalse(quota.spend("u:1", 12));
        assertFalse(quota.spend("u:1", 12));
        assertFalse(quota.spend("u:1", 12));

        /* 144 그대로여야 합니다. 여섯은 아직 들어갈 자리가 있습니다. */
        assertTrue(quota.spend("u:1", 6), "막힌 것이 쌓였습니다");
    }

    @Test
    @DisplayName("left 는 보기만 하고 쓰지 않는다")
    void leftDoesNotSpend() {
        GoogleQuota quota = new GoogleQuota();
        for (int i = 0; i < 100; i++) {
            assertTrue(quota.left("u:1"));
        }
        /* 백 번을 물어봤어도 한 번도 안 썼으므로 150 이 그대로 남아 있어야
           합니다. 문턱이 요청마다 이것을 부르므로, 여기서 닳으면 보기만
           해도 막히는 옛 고장으로 되돌아갑니다. */
        assertTrue(quota.spend("u:1", 150));
        assertFalse(quota.left("u:1"));
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

    @Test
    @DisplayName("누구인지 모르면 세지 않는다")
    void nobody() {
        GoogleQuota quota = new GoogleQuota();
        /* 예약 작업처럼 사람이 누른 것이 아닌 자리. 누구 몫으로 달 수가
           없습니다. 막지도 않습니다 — 우리가 돌린 일입니다. */
        for (int i = 0; i < 100; i++) {
            assertTrue(quota.spend(null, 12));
        }
        assertTrue(quota.left(null));
    }
}
