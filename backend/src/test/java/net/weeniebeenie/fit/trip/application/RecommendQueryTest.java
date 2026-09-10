package net.weeniebeenie.fit.trip.application;

import net.weeniebeenie.fit.trip.application.RecommendService.Intent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 기기가 쪼개 온 것을 검색어로 엮는 자리.
 *
 * <p>여기가 기기에서 온 값이 처음 닿는 곳입니다. 그 값은 사람이 고칠 수 있고,
 * 검증 없이 구글로 흘려보내면 우리 사용량으로 남의 질의를 대신 태우게 됩니다.
 * 그래서 이 자리는 시험이 필요합니다.
 */
class RecommendQueryTest {

    @Test
    @DisplayName("쪼갠 것이 없으면 문장을 그대로 쓴다")
    void plainWhenNoIntent() {
        assertEquals("비 올 때 갈 만한 실내",
                RecommendService.queryOf("비 올 때 갈 만한 실내", null));
    }

    @Test
    @DisplayName("쪼갠 것을 지역·낱말·갈래 순으로 엮는다")
    void weavesInOrder() {
        assertEquals("오사카 조용한 카페",
                RecommendService.queryOf("첫날 저녁에 조용히 커피",
                        new Intent("오사카", "cafe", "조용한")));
    }

    @Test
    @DisplayName("갈래는 우리말로 바꿔 묻는다")
    void kindBecomesKorean() {
        /* 구글에 "onsen" 이라고 묻는 것보다 "온천" 이 한국어 결과에 가깝습니다. */
        assertEquals("하코네 온천",
                RecommendService.queryOf("아무거나", new Intent("하코네", "onsen", null)));
    }

    @Test
    @DisplayName("모르는 갈래는 버린다")
    void unknownKindDropped() {
        /* 모델이 지어낸 갈래입니다. 그대로 실어 보내면 뜻 없는 낱말이
           검색어에 섞입니다. */
        assertEquals("오사카 조용한",
                RecommendService.queryOf("원래 문장", new Intent("오사카", "teleport", "조용한")));
    }

    @Test
    @DisplayName("긴 값은 자른다")
    void longValuesCut() {
        String flood = "가".repeat(500);
        String made = RecommendService.queryOf("짧은 문장", new Intent(flood, null, flood));

        /* 60자씩 둘에 사이 공백 하나. 길이를 안 자르면 기기가 아무 길이나
           밀어 넣을 수 있습니다. */
        assertEquals(121, made.length());
    }

    @Test
    @DisplayName("쪼갠 것이 전부 비면 문장으로 돌아간다")
    void fallsBackWhenEmpty() {
        /* 모델이 헛소리를 해도 사람이 보는 것은 조금 덜 맞는 추천이지
           빈 화면이 아닙니다. */
        assertEquals("원래 문장",
                RecommendService.queryOf("원래 문장", new Intent(null, null, null)));
        assertEquals("원래 문장",
                RecommendService.queryOf("원래 문장", new Intent("  ", "없는갈래", "\t")));
    }

    @Test
    @DisplayName("갈래만 있어도 된다")
    void kindOnly() {
        assertEquals("라멘", RecommendService.queryOf("면이 먹고 싶다", new Intent(null, "ramen", null)));
    }

    @Test
    @DisplayName("갈래 이름의 대소문자와 앞뒤 공백을 봐준다")
    void kindIsForgiving() {
        assertEquals("카페", RecommendService.queryOf("x", new Intent(null, "  CAFE ", null)));
    }
}
