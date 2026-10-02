package net.weeniebeenie.fit.community.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 좌표로 지역을 꼽는 일.
 *
 * <p>내놓을 때 지역을 <b>제목에서</b> 꼽고 있었습니다. 「도쿄 라멘 투어」는
 * 도쿄가 되지만 「엄마랑 셋이」는 아무것도 안 됐습니다. 제목 대신 장소 좌표를
 * 봅니다.
 *
 * <p>네모를 차례대로 견주므로 <b>겹치는 자리</b>가 이 묶음의 핵심입니다 —
 * 부산과 대마도, 오키나와와 대만, 지브롤터와 알제처럼 위도만으로는 안 갈리는
 * 짝들입니다.
 */
class RegionsTest {

    @Test
    @DisplayName("한반도 남쪽과 제주는 국내다")
    void korea() {
        assertEquals("국내", Regions.of(37.5665, 126.9780));  // 서울
        assertEquals("국내", Regions.of(35.1796, 129.0756));  // 부산
        assertEquals("국내", Regions.of(33.4996, 126.5312));  // 제주
        assertEquals("국내", Regions.of(36.3504, 127.3845));  // 대전 — 도시 목록에 없어 11번에서 전주로 묶였던 곳
        assertEquals("국내", Regions.of(37.4845, 130.9057));  // 울릉도
    }

    @Test
    @DisplayName("대마도는 부산보다 남서쪽이어도 일본이다")
    void tsushimaIsJapan() {
        /* 국내 동해안 네모를 34.9 에서 자른 까닭이 이것입니다. */
        assertEquals("일본", Regions.of(34.2003, 129.2866));  // 이즈하라
        assertEquals("일본", Regions.of(33.5902, 130.4017));  // 후쿠오카 — 부산과 위도가 거의 같습니다
        assertEquals("일본", Regions.of(35.6812, 139.7671));  // 도쿄
        assertEquals("일본", Regions.of(43.0618, 141.3545));  // 삿포로
        assertEquals("일본", Regions.of(26.2124, 127.6809));  // 오키나와
        assertEquals("일본", Regions.of(24.4541, 123.0107));  // 요나구니 — 일본의 서쪽 끝
    }

    @Test
    @DisplayName("대만·홍콩·중국 내륙은 중화권이다")
    void greaterChina() {
        assertEquals("중화권", Regions.of(25.0330, 121.5654));  // 타이베이
        assertEquals("중화권", Regions.of(22.6273, 120.3014));  // 가오슝
        assertEquals("중화권", Regions.of(22.3193, 114.1694));  // 홍콩
        assertEquals("중화권", Regions.of(31.2304, 121.4737));  // 상하이
        assertEquals("중화권", Regions.of(30.5728, 104.0668));  // 청두
        assertEquals("중화권", Regions.of(45.8038, 126.5350));  // 하얼빈
    }

    @Test
    @DisplayName("동남아는 중화권과 경도에서 갈린다")
    void southeastAsia() {
        assertEquals("동남아", Regions.of(13.7563, 100.5018));  // 방콕
        assertEquals("동남아", Regions.of(21.0278, 105.8342));  // 하노이 — 중국 국경 바로 아래
        assertEquals("동남아", Regions.of(1.3521, 103.8198));   // 싱가포르
        assertEquals("동남아", Regions.of(-8.4095, 115.1889));  // 발리
        assertEquals("동남아", Regions.of(18.5500, 120.7500));  // 루손 북단
    }

    @Test
    @DisplayName("유럽과 북아프리카는 위도만으로 안 갈린다")
    void europeAndMaghreb() {
        assertEquals("유럽", Regions.of(36.1408, -5.3536));   // 지브롤터
        assertEquals("유럽", Regions.of(37.5024, 15.0873));   // 시칠리아
        assertEquals("유럽", Regions.of(64.1466, -21.9426));  // 레이캬비크
        assertEquals("유럽", Regions.of(41.0082, 28.9784));   // 이스탄불
        /* 알제(36.8)와 튀니스(36.8)는 지브롤터(36.1)보다 북쪽입니다. */
        assertEquals("그 밖", Regions.of(36.7538, 3.0588));   // 알제
        assertEquals("그 밖", Regions.of(36.8065, 10.1815));  // 튀니스
        assertEquals("그 밖", Regions.of(35.7595, -5.8340));  // 탕헤르
    }

    @Test
    @DisplayName("태평양은 하와이와 타히티가 다른 칸이다")
    void pacific() {
        assertEquals("미주", Regions.of(21.3069, -157.8583));        // 호놀룰루
        assertEquals("오세아니아", Regions.of(-17.6509, -149.4260));  // 타히티
        assertEquals("오세아니아", Regions.of(13.4443, 144.7937));    // 괌
        assertEquals("오세아니아", Regions.of(-31.9523, 115.8613));   // 퍼스
        assertEquals("미주", Regions.of(40.7128, -74.0060));        // 뉴욕
        assertEquals("미주", Regions.of(-34.6037, -58.3816));       // 부에노스아이레스
    }

    @Test
    @DisplayName("네모에 없는 곳은 「그 밖」이고, 엉뚱한 지역이 되지 않는다")
    void elsewhere() {
        /* 안 걸리는 것은 틀린 말을 하지 않습니다 — 인도가 중화권이 되면 안 됩니다. */
        assertEquals("그 밖", Regions.of(28.6139, 77.2090));    // 델리
        assertEquals("그 밖", Regions.of(25.2048, 55.2708));    // 두바이
        assertEquals("그 밖", Regions.of(30.0444, 31.2357));    // 카이로
        assertEquals("그 밖", Regions.of(-33.9249, 18.4241));   // 케이프타운
        assertEquals("그 밖", Regions.of(43.1332, 131.9113));   // 블라디보스토크
        assertEquals("그 밖", Regions.of(0.0, 0.0));            // 기니만 — 좌표를 안 채운 장소
    }

    @Test
    @DisplayName("꼽은 값은 반드시 고를 수 있는 여덟 중 하나다")
    void alwaysInList() {
        /* 목록에 없는 값은 저장은 되는데 둘러보기에서 아무것도 안 걸립니다. */
        for (double lat = -80; lat <= 80; lat += 7.5) {
            for (double lng = -180; lng <= 180; lng += 7.5) {
                String region = Regions.of(lat, lng);
                assertTrue(Regions.ALL.contains(region), lat + "/" + lng + " → " + region);
            }
        }
        assertEquals(Regions.ALL, PostService.REGIONS);
    }
}
