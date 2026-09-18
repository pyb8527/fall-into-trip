package net.weeniebeenie.fit.trip.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static net.weeniebeenie.fit.trip.domain.PlaceKind.guess;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 구글이 준 갈래로 그림을 짐작하는 일.
 *
 * <p>보석함을 열었더니 츠케멘집과 꼬치집과 초등학교가 <b>전부 "명소"</b> 였고
 * 나란히 도리이 그림을 달고 있었습니다. 데이터 문제로 보이지만 실제로는
 * 짐작하는 순서가 틀린 것이었습니다.
 *
 * <p>구글은 거의 모든 장소에 {@code point_of_interest} 를 붙입니다. 그것으로
 * 명소를 판단했고, 그 검사가 식당 검사보다 앞에 있었습니다.
 */
class PlaceKindGuessTest {

    /** 구글이 실제로 주는 모양. 넓은 갈래가 늘 끼어 있습니다. */
    private static List<String> types(String... narrow) {
        List<String> all = new java.util.ArrayList<>(List.of(narrow));
        all.add("point_of_interest");
        all.add("establishment");
        return all;
    }

    @Test
    @DisplayName("식당이 명소로 묶이지 않는다")
    void restaurantIsNotSight() {
        /* 이것이 이 묶음의 핵심입니다. 전에는 셋 다 "sight" 였습니다. */
        assertEquals("food", guess(types("restaurant", "food"), "어느 식당"));
        assertEquals("food", guess(types("meal_takeaway"), "포장 전문"));
        assertEquals("food", guess(types("restaurant"), "이름 없는 밥집"));
    }

    @Test
    @DisplayName("이름에 적혀 있으면 그것이 이긴다")
    void nameWins() {
        /* 구글은 츠케멘집도 그냥 restaurant 로 줍니다. */
        assertEquals("ramen", guess(types("restaurant", "food"), "츠케멘 타로"));
        assertEquals("ramen", guess(types("restaurant"), "멘야 누들"));
        assertEquals("meat", guess(types("restaurant"), "야키토리 꼬치집"));
        assertEquals("sushi", guess(types("restaurant"), "스시 이치"));
    }

    @Test
    @DisplayName("우리 갈래에 없는 곳은 비워 둔다")
    void unknownStaysEmpty() {
        /* 학교에 도리이를 찍으면 지도가 틀린 말을 합니다. 번호만 찍습니다. */
        assertNull(guess(types("primary_school", "school"), "어느 초등학교"));
        assertNull(guess(types("hospital"), "어느 병원"));
        assertNull(guess(types(), "이름만 있는 곳"));
    }

    @Test
    @DisplayName("진짜 명소는 그대로 명소다")
    void realSight() {
        assertEquals("sight", guess(types("tourist_attraction"), "어느 전망대"));
        assertEquals("sight", guess(types("place_of_worship"), "어느 신사"));
        assertEquals("sight", guess(types("historical_landmark"), "어느 성"));
    }

    @Test
    @DisplayName("좁은 갈래가 넓은 갈래를 이긴다")
    void narrowWins() {
        assertEquals("cafe", guess(types("cafe", "food", "store"), "어느 카페"));
        assertEquals("stay", guess(types("lodging"), "어느 호텔"));
        assertEquals("move", guess(types("airport"), "어느 공항"));
        assertEquals("park", guess(types("aquarium", "tourist_attraction"), "어느 수족관"));
    }

    @Test
    @DisplayName("모르는 이름은 저장하지 않는다")
    void cleanRejectsUnknown() {
        assertNull(PlaceKind.clean("없는갈래"));
        assertNull(PlaceKind.clean(""));
        assertEquals("ramen", PlaceKind.clean("RAMEN"));
    }
}
