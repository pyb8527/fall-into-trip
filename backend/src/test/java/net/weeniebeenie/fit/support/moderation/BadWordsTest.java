package net.weeniebeenie.fit.support.moderation;

import net.weeniebeenie.fit.shared.error.ApiException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BadWordsTest {

    @Test
    @DisplayName("다듬기 — 작은 글자로, 글자 아닌 것을 걷고, 이어진 같은 글자를 하나로")
    void normalize() {
        assertEquals("fuck", BadWords.normalize("F.u-u-u C K!!"));
        assertEquals("씨발", BadWords.normalize("씨 1 씨 발"));
        assertEquals("도쿄라멘번", BadWords.normalize("도쿄 라멘 🍜 3번"));
        assertEquals("", BadWords.normalize(null));
    }

    @Test
    @DisplayName("피해 적은 욕도 걸린다")
    void caught() {
        assertTrue(BadWords.contains("씨발"));
        assertTrue(BadWords.contains("아 씨.발 진짜"));
        assertTrue(BadWords.contains("씨1발"));
        assertTrue(BadWords.contains("씨씨씨발"));
        assertTrue(BadWords.contains("이 병신아"));
        assertTrue(BadWords.contains("개 새 끼"));
        assertTrue(BadWords.contains("FUUUCK this"));
        assertTrue(BadWords.contains("f u c k"));
        assertTrue(BadWords.contains("ㅅㅂ 늦었다"));
    }

    @Test
    @DisplayName("닮았지만 멀쩡한 말은 안 걸린다")
    void allowedLookalikes() {
        assertFalse(BadWords.contains("여기가 이번 여행의 시발점이에요"));
        assertFalse(BadWords.contains("솜씨 발휘했어요"));
        assertFalse(BadWords.contains("다시 발견한 골목"));
        assertFalse(BadWords.contains("화병 신경 쓰지 마세요"));
        assertFalse(BadWords.contains("새끼 고양이가 있었어요"));
        assertFalse(BadWords.contains("미친 풍경"));
        assertFalse(BadWords.contains("Scunthorpe 에서 하루"));
        assertFalse(BadWords.contains("shiitake 라멘"));
        assertFalse(BadWords.contains("Shitennoji 다녀옴"));
        assertFalse(BadWords.contains("Niigata 사케"));
        assertFalse(BadWords.contains("Bitchu-Takahashi"));
        assertFalse(BadWords.contains("class assassin cocktail"));
        assertFalse(BadWords.contains(""));
        assertFalse(BadWords.contains(null));
    }

    @Test
    @DisplayName("걸리면 400 과 고쳐 달라는 말")
    void check() {
        ApiException e = assertThrows(ApiException.class, () -> BadWords.check("제목", "씨발"));
        assertEquals(400, e.getStatus().value());
        assertEquals(BadWords.MESSAGE, e.getMessage());
        assertDoesNotThrow(() -> BadWords.check("도쿄 라멘 투어", null, "  "));
    }
}
