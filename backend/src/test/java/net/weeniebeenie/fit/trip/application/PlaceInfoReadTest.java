package net.weeniebeenie.fit.trip.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.weeniebeenie.fit.trip.application.PlaceInfoService.Info;
import net.weeniebeenie.fit.trip.application.PlaceInfoService.Raw;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static net.weeniebeenie.fit.trip.application.PlaceInfoService.rawOf;
import static net.weeniebeenie.fit.trip.application.PlaceInfoService.viewOf;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 구글 상세 응답 한 장을 읽는 자리.
 *
 * <p>확인용 서버에는 구글 키가 없어서 상세 응답이 한 번도 오지 않습니다. HTTP
 * 시험으로는 {@code info} 가 늘 비어 있으니, 읽는 자리가 맞는지는 여기서 구글이
 * 실제로 보내는 모양의 JSON 을 먹여서 봅니다.
 *
 * <p>모양은 2026-10-12 에 운영 키로 우리 장소 15곳을 찍어 본 응답을 따랐습니다
 * (docs/2026-10/plan-constraints.md §10.1). 옮긴 가게는 그 안에 없어서
 * {@code movedPlaceId} 가 실린 모양은 구글 문서의 필드 설명대로 지었습니다
 * (plan-moved-place.md §10).
 */
class PlaceInfoReadTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static Raw read(String json) throws Exception {
        JsonNode node = JSON.readTree(json);
        return rawOf(node);
    }

    /** 구글 번호 {@code self} 를 물어서 받은 응답을, 화면이 받는 모양으로. */
    private static Info view(String self, String json) throws Exception {
        return viewOf(self, self, read(json), null);
    }

    /* ----------------------------------------------------- 휠체어 입구 */

    @Test
    @DisplayName("휠체어 입구가 된다고 오면 된다고 읽는다")
    void wheelchairTrue() throws Exception {
        Raw raw = read("""
                {
                  "businessStatus": "OPERATIONAL",
                  "accessibilityOptions": {
                    "wheelchairAccessibleParking": true,
                    "wheelchairAccessibleEntrance": true,
                    "wheelchairAccessibleRestroom": true,
                    "wheelchairAccessibleSeating": true
                  }
                }
                """);
        assertEquals(Boolean.TRUE, raw.wheelchairEntrance());
    }

    @Test
    @DisplayName("안 된다고 오면 안 된다고 읽는다 — 「없다」 도 아는 값")
    void wheelchairFalse() throws Exception {
        /* 아키하바라 가차폰 회관이 이 모양으로 왔습니다. 화면은 이 값을 안
           띄우지만(plan-constraints.md §10.2), 서버가 「모름」 으로 뭉개면 안
           됩니다 — 띄울지는 화면이 정합니다. */
        Raw raw = read("""
                {
                  "businessStatus": "OPERATIONAL",
                  "accessibilityOptions": { "wheelchairAccessibleEntrance": false }
                }
                """);
        assertEquals(Boolean.FALSE, raw.wheelchairEntrance());
    }

    @Test
    @DisplayName("칸이 없으면 모른다고 둔다 — 「모름」 이 「못 들어감」 으로 읽히지 않는다")
    void wheelchairAbsent() throws Exception {
        /* 이 묶음에서 가장 중요한 줄입니다. 구글은 모르는 가게에 칸을 안
           보냅니다. 아사히 스카이룸 · 만세이바시역 터가 이랬습니다. */
        assertNull(read("""
                { "businessStatus": "OPERATIONAL" }
                """).wheelchairEntrance());

        /* 다른 칸만 오고 입구는 없는 곳 — 나리타 공항 터미널(화장실만),
           갓파바시(주차만). 묶음이 있다고 입구를 안다고 말하지 않습니다. */
        assertNull(read("""
                {
                  "businessStatus": "OPERATIONAL",
                  "accessibilityOptions": { "wheelchairAccessibleRestroom": true }
                }
                """).wheelchairEntrance());
    }

    /* ------------------------------------------------------- 옮긴 자리 */

    @Test
    @DisplayName("아주 닫았고 다른 번호를 가리키면 그 번호가 옮긴 자리")
    void movedClosed() throws Exception {
        Info info = view("ChIJold", """
                { "businessStatus": "CLOSED_PERMANENTLY", "movedPlaceId": "ChIJnew" }
                """);
        assertTrue(info.permanentlyClosed());
        assertEquals("ChIJnew", info.movedTo());
    }

    @Test
    @DisplayName("아주 닫았지만 옮긴 번호가 없으면 가리키지 않는다 — 망한 가게")
    void closedWithoutMove() throws Exception {
        /* 카츠미도리 회전초밥 시부야점이 2026-10-12 에 이 모양으로 왔습니다. */
        Info info = view("ChIJkatsu", """
                {
                  "displayName": { "text": "카츠미도리 회전초밥 시부야점", "languageCode": "ko" },
                  "businessStatus": "CLOSED_PERMANENTLY"
                }
                """);
        assertTrue(info.permanentlyClosed());
        assertNull(info.movedTo());
    }

    @Test
    @DisplayName("영업 중인데 옮긴 번호가 와도 띄우지 않는다")
    void movedButOpen() throws Exception {
        /* 구글 문서는 「아주 닫았고 옮겼으면」 이라고 적었습니다. 그 밖에 오는
           번호는 뜻을 모르므로, 여는 가게를 두고 사람을 딴 데로 보내지 않습니다. */
        assertNull(view("ChIJold", """
                { "businessStatus": "OPERATIONAL", "movedPlaceId": "ChIJnew" }
                """).movedTo());
        assertNull(view("ChIJold", """
                { "businessStatus": "CLOSED_TEMPORARILY", "movedPlaceId": "ChIJnew" }
                """).movedTo());
    }

    @Test
    @DisplayName("자기 번호를 가리키면 가리키지 않는다 — 제자리 고리")
    void movedToSelf() throws Exception {
        assertNull(view("ChIJsame", """
                { "businessStatus": "CLOSED_PERMANENTLY", "movedPlaceId": "ChIJsame" }
                """).movedTo());
    }

    @Test
    @DisplayName("새 자리 판의 재료 — 이름 · 좌표 · 주소를 읽는다")
    void nameAndWhere() throws Exception {
        Info info = view("ChIJnew", """
                {
                  "displayName": { "text": "이치란 도톤보리점 별관", "languageCode": "ko" },
                  "location": { "latitude": 34.6687, "longitude": 135.5013 },
                  "formattedAddress": "일본 오사카부 오사카시 주오구 도톤보리 1-4-16",
                  "businessStatus": "OPERATIONAL"
                }
                """);
        assertEquals("ChIJnew", info.id());
        assertEquals("이치란 도톤보리점 별관", info.name());
        assertEquals(34.6687, info.lat());
        assertEquals(135.5013, info.lng());
        assertEquals("일본 오사카부 오사카시 주오구 도톤보리 1-4-16", info.address());
    }

    @Test
    @DisplayName("새 칸이 하나도 없는 옛 모양 응답도 그대로 읽힌다")
    void oldShape() throws Exception {
        /* 지금까지 받던 칸만 있는 응답. 새로 더한 칸이 없다고 읽기가 깨지거나
           엉뚱한 값을 채우면 안 됩니다. */
        Info info = view("ChIJold", """
                {
                  "regularOpeningHours": {
                    "weekdayDescriptions": ["월요일: 09:00~18:00", "화요일: 09:00~18:00",
                      "수요일: 09:00~18:00", "목요일: 09:00~18:00", "금요일: 09:00~18:00",
                      "토요일: 휴무일", "일요일: 휴무일"],
                    "periods": [{ "open": { "day": 1, "hour": 9, "minute": 0 },
                                  "close": { "day": 1, "hour": 18, "minute": 0 } }]
                  },
                  "utcOffsetMinutes": 540,
                  "nationalPhoneNumber": "06-1234-5678",
                  "rating": 4.3,
                  "userRatingCount": 812,
                  "businessStatus": "OPERATIONAL",
                  "googleMapsUri": "https://maps.google.com/?cid=1"
                }
                """);
        assertEquals(7, info.hours().size());
        assertEquals("06-1234-5678", info.phone());
        assertEquals(4.3, info.rating());
        assertEquals(812, info.ratingCount());
        assertFalse(info.permanentlyClosed());
        assertNull(info.movedTo());
        assertNull(info.name());
        assertNull(info.lat());
        assertNull(info.lng());
        assertNull(info.address());
        assertNull(info.wheelchairEntrance());
    }
}
