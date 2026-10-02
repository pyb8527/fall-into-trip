package net.weeniebeenie.fit.community.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 사본에서 「이 글의 첫 사진」을 꼽는 일.
 *
 * <p>목록이 표지 다음에 세우는 사진입니다. 표지도 사진도 없을 때만 동선 그림을
 * 그리는데, 그 그림 한 장이 구글 Static Maps 한 번이라 이 칸이 맞으면 호출이
 * 그만큼 줄어듭니다.
 *
 * <p><b>차례가 핵심입니다.</b> 글은 날마다 「장소들 → 그 날에 걸린 피드 글」
 * 순서로 그려지고 날에 안 걸린 글은 맨 뒤에 섭니다. 목록이 그와 다른 장을
 * 고르면, 들어가 본 사람은 "아까 그 사진이 어디 갔나" 가 됩니다. 눈으로는 안
 * 갈리는 자리라 여기서 짚습니다.
 */
class FirstPhotoTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static String firstOf(String json) {
        try {
            JsonNode snap = MAPPER.readTree(json);
            return PostService.firstPhotoIn(snap);
        } catch (Exception e) {
            throw new IllegalStateException("시험에 쓴 JSON 이 깨졌습니다.", e);
        }
    }

    @Test
    @DisplayName("첫날 첫 장소의 첫 사진이 이긴다")
    void earliestPlaceWins() {
        assertEquals("p1", firstOf("""
                {"days": [
                  {"places": [{"photos": ["p1", "p2"]}, {"photos": ["p3"]}]},
                  {"places": [{"photos": ["p4"]}]}
                ]}
                """));
    }

    @Test
    @DisplayName("사진 없는 장소는 건너뛴다")
    void skipsPlacesWithoutPhotos() {
        /* 사진을 고르는 것은 장소마다입니다 — 앞쪽 장소가 비어 있는 글이 흔합니다. */
        assertEquals("p9", firstOf("""
                {"days": [
                  {"places": [{"name": "하네다"}, {"name": "호텔", "photos": []}]},
                  {"places": [{"photos": ["p9"]}]}
                ]}
                """));
    }

    @Test
    @DisplayName("같은 날이면 장소가 피드 글보다 앞이다")
    void placesComeBeforeStories() {
        /* 화면이 그 순서로 그립니다(community/[id].tsx) — 날 하나를 그리고 그
           날에 걸린 글을 그 아래 붙입니다. */
        assertEquals("place", firstOf("""
                {"days": [{"places": [{"photos": ["place"]}]}],
                 "stories": [{"dayIndex": 0, "photos": ["told"]}]}
                """));
    }

    @Test
    @DisplayName("장소에 사진이 없으면 그 날에 걸린 피드 글의 사진이 선다")
    void storyOfThatDay() {
        assertEquals("day2", firstOf("""
                {"days": [{"places": []}, {"places": []}],
                 "stories": [{"dayIndex": 1, "photos": ["day2"]},
                             {"dayIndex": 0, "photos": []}]}
                """));
    }

    @Test
    @DisplayName("날에 안 걸린 글은 맨 뒤다")
    void loneStoriesLast() {
        /* 올린 날이 올린 날들 가운데 없는 글입니다. 글에서도 일정 뒤에 섭니다. */
        assertEquals("onDay", firstOf("""
                {"days": [{"places": []}, {"places": []}],
                 "stories": [{"photos": ["loose"]},
                             {"dayIndex": 1, "photos": ["onDay"]}]}
                """));
        assertEquals("loose", firstOf("""
                {"days": [{"places": []}],
                 "stories": [{"photos": ["loose"]}]}
                """));
    }

    @Test
    @DisplayName("사진이 한 장도 없으면 비어 있다 — 없는 번호를 지어내지 않는다")
    void noneMeansNull() {
        assertNull(firstOf("""
                {"days": [{"places": [{"name": "하네다"}]}]}
                """));
        /* 장소 사진을 아예 안 담던 시절의 옛 글 — days 만 있고 photos 칸이
           어디에도 없습니다. */
        assertNull(firstOf("{\"title\": \"오사카 사흘\", \"days\": []}"));
        assertNull(firstOf("{}"));
    }

    @Test
    @DisplayName("빈 글자는 사진이 아니다")
    void blankIsNotAPhoto() {
        /* 받는 쪽은 번호를 그대로 /api/photos/… 에 붙입니다. 빈 값이 가면
           없는 사진을 부르는 호출이 됩니다. */
        assertEquals("real", firstOf("""
                {"days": [{"places": [{"photos": ["", "  ", "real"]}]}]}
                """));
    }
}
