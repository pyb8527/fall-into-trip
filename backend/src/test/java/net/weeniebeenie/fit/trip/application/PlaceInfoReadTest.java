package net.weeniebeenie.fit.trip.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.weeniebeenie.fit.trip.application.PlaceInfoService.Info;
import net.weeniebeenie.fit.trip.application.PlaceInfoService.Price;
import net.weeniebeenie.fit.trip.application.PlaceInfoService.Raw;
import net.weeniebeenie.fit.trip.application.PlaceInfoService.Span;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

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
        assertNull(info.price());
        assertEquals(List.of(), info.breaks());
        assertNull(info.lastOrder());
    }

    /* ------------------------------------------------------------ 값대 */

    /*
      값대의 모양은 2026-10-13 에 운영 키로 찍어 본 15곳을 따랐습니다
      (docs/2026-10/plan-price-hours.md §10.1).
    */

    @Test
    @DisplayName("시작과 끝이 다 오면 그 사이")
    void priceBoth() throws Exception {
        Raw raw = read("""
                { "priceRange": {
                    "startPrice": { "currencyCode": "JPY", "units": "1000" },
                    "endPrice": { "currencyCode": "JPY", "units": "2000" } } }
                """);
        assertEquals(new Price("JPY", 1000.0, 2000.0), raw.price());
    }

    @Test
    @DisplayName("시작이 1 이면 「까지」 — 마츠야 · 요시노야")
    void priceUpTo() throws Exception {
        /* 「1엔부터 1,000엔」 이 아니라 「1,000엔 이하」 입니다. */
        Raw raw = read("""
                { "priceRange": {
                    "startPrice": { "currencyCode": "JPY", "units": "1" },
                    "endPrice": { "currencyCode": "JPY", "units": "1000" } } }
                """);
        assertEquals(new Price("JPY", null, 1000.0), raw.price());
    }

    @Test
    @DisplayName("시작만 오면 「부터」 — Cretya")
    void priceFrom() throws Exception {
        Raw raw = read("""
                { "priceRange": { "startPrice": { "currencyCode": "IDR", "units": "250000" } } }
                """);
        assertEquals(new Price("IDR", 250000.0, null), raw.price());
    }

    @Test
    @DisplayName("값대가 없으면 모른다 — 이케부쿠로 · AKASA")
    void priceAbsent() throws Exception {
        assertNull(read("""
                { "businessStatus": "OPERATIONAL" }
                """).price());
        /* 통화를 모르면 금액을 못 읽습니다. */
        assertNull(read("""
                { "priceRange": { "startPrice": { "units": "1000" } } }
                """).price());
    }

    @Test
    @DisplayName("작은 단위(nanos)도 합친다")
    void priceNanos() throws Exception {
        Raw raw = read("""
                { "priceRange": {
                    "startPrice": { "currencyCode": "USD", "units": "10", "nanos": 500000000 },
                    "endPrice": { "currencyCode": "USD", "units": "20" } } }
                """);
        assertEquals(new Price("USD", 10.5, 20.0), raw.price());
    }

    /* ------------------------------------------------------- 쉬는 시간 */

    /** 월요일(구글 1) 구간들을 periods 로. "11:00-14:30" 모양을 받습니다. */
    private static String monday(String... spans) {
        StringBuilder out = new StringBuilder("[");
        for (String s : spans) {
            String[] p = s.split("-");
            String[] o = p[0].split(":");
            String[] c = p[1].split(":");
            /* 닫는 시각이 여는 시각보다 앞서면 다음 날(화요일)에 닫습니다. */
            int closeDay = p[1].compareTo(p[0]) <= 0 ? 2 : 1;
            if (out.length() > 1) {
                out.append(',');
            }
            out.append(String.format(
                    "{\"open\":{\"day\":1,\"hour\":%d,\"minute\":%d},"
                            + "\"close\":{\"day\":%d,\"hour\":%d,\"minute\":%d}}",
                    Integer.parseInt(o[0]), Integer.parseInt(o[1]),
                    closeDay, Integer.parseInt(c[0]), Integer.parseInt(c[1])));
        }
        return out.append(']').toString();
    }

    /** 2026-10-12 은 월요일입니다. */
    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 12);

    private static Info onMonday(String json) throws Exception {
        return viewOf("p", "p", read(json), MONDAY);
    }

    @Test
    @DisplayName("30분 넘는 틈이 쉬는 시간 — 수프 카레 카무이")
    void breakGap() throws Exception {
        Info info = onMonday("{ \"regularOpeningHours\": { \"periods\": "
                + monday("11:00-14:30", "17:00-20:30") + " } }");
        assertEquals(List.of(new Span("14:30", "17:00")), info.breaks());
    }

    @Test
    @DisplayName("15분 틈은 쉬는 시간이 아니다 — 로쿠린샤")
    void shortGap() throws Exception {
        Info info = onMonday("{ \"regularOpeningHours\": { \"periods\": "
                + monday("07:30-09:45", "10:00-23:00") + " } }");
        assertEquals(List.of(), info.breaks());
    }

    @Test
    @DisplayName("자정을 넘기는 구간도 그 앞의 틈만 센다")
    void breakOvernight() throws Exception {
        /* 17:00–02:00 은 그날의 마지막입니다. 차례가 뒤섞여 와도 같습니다. */
        Info info = onMonday("{ \"regularOpeningHours\": { \"periods\": "
                + monday("17:00-02:00", "11:00-14:30") + " } }");
        assertEquals(List.of(new Span("14:30", "17:00")), info.breaks());
    }

    @Test
    @DisplayName("전날 밤에서 이어진 00:00 구간 뒤의 틈은 밤에 닫은 것")
    void breakAfterMidnightTail() throws Exception {
        Info info = onMonday("{ \"regularOpeningHours\": { \"periods\": "
                + monday("00:00-02:00", "11:00-23:00") + " } }");
        assertEquals(List.of(), info.breaks());
    }

    @Test
    @DisplayName("쉬는 시간은 그날 요일 것만")
    void breakOtherDay() throws Exception {
        /* 화요일(구글 2)에만 틈이 있습니다. 월요일을 보면 없어야 합니다. */
        Info info = onMonday("""
                { "regularOpeningHours": { "periods": [
                  { "open": {"day":1,"hour":11,"minute":0}, "close": {"day":1,"hour":22,"minute":0} },
                  { "open": {"day":2,"hour":11,"minute":0}, "close": {"day":2,"hour":14,"minute":0} },
                  { "open": {"day":2,"hour":17,"minute":0}, "close": {"day":2,"hour":22,"minute":0} }
                ] } }
                """);
        assertEquals(List.of(), info.breaks());
        assertEquals(List.of(new Span("14:00", "17:00")),
                viewOf("p", "p", read("""
                { "regularOpeningHours": { "periods": [
                  { "open": {"day":2,"hour":11,"minute":0}, "close": {"day":2,"hour":14,"minute":0} },
                  { "open": {"day":2,"hour":17,"minute":0}, "close": {"day":2,"hour":22,"minute":0} }
                ] } }
                """), MONDAY.plusDays(1)).breaks());
    }

    /* ------------------------------------------------------- 주문 마감 */

    private static String withKitchen(String main, String type, String kitchen) {
        return "{ \"regularOpeningHours\": { \"periods\": " + main + " },"
                + " \"regularSecondaryOpeningHours\": [ { \"secondaryHoursType\": \"" + type + "\","
                + " \"periods\": " + kitchen + " } ] }";
    }

    @Test
    @DisplayName("주방이 먼저 닫으면 라스트오더 — 이치란")
    void kitchenEarlier() throws Exception {
        Info info = onMonday(withKitchen(monday("09:30-22:45"), "KITCHEN", monday("09:30-22:30")));
        assertEquals("22:30", info.lastOrder());
    }

    @Test
    @DisplayName("자정을 넘겨 닫는 가게도 같은 기준으로 — 01:00 닫고 주방 00:30")
    void kitchenOvernight() throws Exception {
        Info info = onMonday(withKitchen(monday("18:00-01:00"), "KITCHEN", monday("18:00-00:30")));
        assertEquals("00:30", info.lastOrder());
        /* 주방이 자정 전에 닫아도 마찬가지입니다. 23:30 을 01:00 보다 늦다고 읽지 않습니다. */
        assertEquals("23:30", onMonday(withKitchen(
                monday("18:00-01:00"), "KITCHEN", monday("18:00-23:30"))).lastOrder());
    }

    @Test
    @DisplayName("주방이 가게와 같이 닫으면 적지 않는다")
    void kitchenEqual() throws Exception {
        assertNull(onMonday(withKitchen(
                monday("11:00-23:00"), "KITCHEN", monday("11:00-23:00"))).lastOrder());
    }

    @Test
    @DisplayName("KITCHEN 이 없거나 다른 갈래뿐이면 적지 않는다")
    void kitchenAbsent() throws Exception {
        assertNull(onMonday("{ \"regularOpeningHours\": { \"periods\": "
                + monday("09:30-22:45") + " } }").lastOrder());
        /* 아침 시간이 일찍 닫는다고 라스트오더가 아닙니다. */
        assertNull(onMonday(withKitchen(
                monday("07:00-22:00"), "BREAKFAST", monday("07:00-10:30"))).lastOrder());
        assertNull(onMonday(withKitchen(
                monday("11:00-23:00"), "HAPPY_HOUR", monday("17:00-19:00"))).lastOrder());
    }

    @Test
    @DisplayName("보조 시간을 전부 본 시간으로 채운 곳 — 타카하시야")
    void kitchenNoise() throws Exception {
        String main = monday("11:00-15:00", "17:00-21:00");
        StringBuilder all = new StringBuilder();
        for (String type : List.of("DRIVE_THROUGH", "HAPPY_HOUR", "DELIVERY", "TAKEOUT", "KITCHEN",
                "BREAKFAST", "LUNCH", "DINNER", "BRUNCH", "PICKUP", "ACCESS", "SENIOR_HOURS")) {
            if (!all.isEmpty()) {
                all.append(',');
            }
            all.append("{ \"secondaryHoursType\": \"").append(type).append("\", \"periods\": ")
                    .append(main).append(" }");
        }
        Info info = onMonday("{ \"regularOpeningHours\": { \"periods\": " + main + " },"
                + " \"regularSecondaryOpeningHours\": [" + all + "] }");
        assertNull(info.lastOrder());
        /* 본 시간의 틈은 그대로 쉬는 시간입니다. */
        assertEquals(List.of(new Span("15:00", "17:00")), info.breaks());
    }
}
