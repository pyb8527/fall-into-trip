package net.weeniebeenie.fit.trip.application;

import net.weeniebeenie.fit.trip.domain.Place;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * 「두 곳 사이」 검색에 넘기는 직선.
 *
 * <p>구글 Routes 에 걷는 길을 묻던 자리를 직접 만든 직선으로 바꿨습니다. 글자
 * 하나만 어긋나도 장소 검색이 선을 못 읽고, 그러면 조용히 점 검색으로 내려앉아
 * 틀린 줄도 모릅니다. 그래서 구글 문서의 예시 그대로 맞춰 봅니다.
 */
class StraightLineTest {

    private static Place at(double lat, double lng) {
        return Place.builder().name("곳").lat(lat).lng(lng).build();
    }

    @Test
    @DisplayName("구글 문서의 예시와 같은 글자를 낸다")
    void matchesGoogleExample() {
        /* developers.google.com/maps/documentation/utilities/polylinealgorithm
           의 앞 두 점: (38.5, -120.2) → (40.7, -120.95). */
        assertEquals("_p~iF~ps|U_ulLnnqC",
                RecommendService.straightLine(at(38.5, -120.2), at(40.7, -120.95)));
    }

    @Test
    @DisplayName("같은 곳이면 둘째 점은 차이 없음으로 적힌다")
    void samePlace() {
        assertEquals("_p~iF~ps|U??",
                RecommendService.straightLine(at(38.5, -120.2), at(38.5, -120.2)));
    }
}
