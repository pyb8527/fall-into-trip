package net.weeniebeenie.fit.trip.application;

import net.weeniebeenie.fit.trip.application.PlaceInfoService.Info;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static net.weeniebeenie.fit.trip.application.PlaceInfoService.opensOn;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 그날 문을 여는가.
 *
 * <p>전에는 이 판단이 <b>{@code CLOSED_PERMANENTLY} 인지 아닌지</b> 하나였고,
 * 그래서 우리가 모르는 값이 오면 전부 "영업 중" 으로 흘렀습니다. 2026-03-17
 * 에 구글이 {@code FUTURE_OPENING} 을 내면서, 아직 문도 안 연 가게가 추천
 * 카드에 그날 영업으로 떴습니다.
 *
 * <p>구글이 그 값을 주는 장소를 찾아 HTTP 로 재기는 어렵습니다. 그래서
 * 판단하는 자리만 따로 봅니다 — <b>모르는 것을 안다고 말하지 않는가</b>가
 * 이 묶음이 지키는 전부입니다.
 */
class PlaceStatusTest {

    /** 영업시간 말고는 볼 것이 없는 장소 하나. */
    private static Info withStatus(String status) {
        return new Info("p1", "월요일: 09:00~18:00", false, List.of(), List.of(),
                null, null, null, null, "CLOSED_PERMANENTLY".equals(status), status, null);
    }

    @Test
    @DisplayName("아직 안 연 가게를 영업 중이라고 말하지 않는다")
    void futureOpening() {
        /* 이것이 이 묶음의 핵심입니다. 전에는 true 였습니다. */
        assertNull(opensOn(withStatus("FUTURE_OPENING"), false));
    }

    @Test
    @DisplayName("모르는 값이 와도 영업 중이라고 말하지 않는다")
    void unknownStatus() {
        /* 구글이 또 새 값을 내도 같은 일이 되풀이되지 않아야 합니다. */
        assertNull(opensOn(withStatus("SOMETHING_NEW"), false));
        assertNull(opensOn(withStatus(""), false));
        assertNull(opensOn(withStatus(null), false));
    }

    @Test
    @DisplayName("닫은 곳은 안 연다고 말한다")
    void closed() {
        /* 아주 닫은 것과 잠시 닫은 것. 둘 다 지금 가면 못 들어갑니다.
           잠시 닫은 쪽도 전에는 "영업 중" 으로 흘렀습니다. */
        assertEquals(Boolean.FALSE, opensOn(withStatus("CLOSED_PERMANENTLY"), false));
        assertEquals(Boolean.FALSE, opensOn(withStatus("CLOSED_TEMPORARILY"), false));
    }

    @Test
    @DisplayName("도는 가게는 그 날짜의 영업시간으로 답한다")
    void operational() {
        assertEquals(Boolean.TRUE, opensOn(withStatus("OPERATIONAL"), false));
        /* 그날 쉬는 날이면 안 엽니다. 이것이 원래 하던 일이고 그대로입니다. */
        assertEquals(Boolean.FALSE, opensOn(withStatus("OPERATIONAL"), true));
    }

    @Test
    @DisplayName("물어보지 못한 장소는 모르는 것으로 둔다")
    void noInfo() {
        /* 구글 번호가 없거나 키가 꺼져 있으면 아예 못 묻습니다. */
        assertNull(opensOn(null, false));
    }

    @Test
    @DisplayName("아주 닫은 곳은 화면에도 그렇게 말한다")
    void stillTellsPermanentlyClosed() {
        /* 화면 넷이 이 칸을 씁니다. status 를 새로 들이면서 이것이 빠지면
           "문을 닫은 곳입니다" 가 조용히 사라집니다. */
        assertTrue(withStatus("CLOSED_PERMANENTLY").permanentlyClosed());
        assertFalse(withStatus("OPERATIONAL").permanentlyClosed());
        assertFalse(withStatus("FUTURE_OPENING").permanentlyClosed());
    }
}
