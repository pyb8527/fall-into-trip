package net.weeniebeenie.fit.trip.application;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 가게가 언제 여는지, 전화번호가 뭔지.
 *
 * <p>월요일 휴관을 모르고 갔다가 하루를 날리는 일이 흔합니다. 일정에 넣어 둔
 * 곳이 언제 문을 여는지는 짤 때도, 가서도 필요합니다.
 *
 * <p><b>내용을 우리 DB 에 쌓지 않습니다.</b> 구글 약관이 막습니다. 영구 저장이
 * 허용된 것은 장소 번호(place_id) 하나뿐이라, 번호만 들고 있다가 화면이 열릴
 * 때 그 번호로 물어봅니다. 받은 내용은 메모리에만 잠깐 둡니다.
 *
 * <p>화면에는 구글에서 온 것이라는 표시를 함께 띄워야 합니다. 그것도 약관입니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlaceInfoService {

    /**
     * 답을 들고 있는 시간.
     *
     * <p>영업시간은 자주 바뀌지 않지만, 오래 들고 있는 것은 약관이 말하는
     * 저장에 가까워집니다. 같은 화면을 몇 번 오갈 때 다시 묻지 않을 만큼만
     * 둡니다.
     */
    private static final Duration KEEP = Duration.ofHours(1);

    /** 들고 있을 답의 개수. 넘으면 오래 안 쓴 것부터 버립니다. */
    private static final int CACHE_MAX = 1000;

    /**
     * 한 번에 물어볼 장소의 최대치.
     *
     * <p>장소마다 요금이 붙습니다. 하루에 열 곳을 넘게 넣는 일정은 드뭅니다.
     */
    private static final int MAX_PLACES = 12;

    /**
     * 달라고 할 것.
     *
     * <p>넓게 적으면 더 비싼 등급으로 넘어갑니다. 화면에 실제로 띄우는 것만
     * 적습니다. 사진과 후기는 넣지 않았습니다 — 그쪽은 글쓴이 이름과 프로필을
     * 함께 띄워야 하는 별도의 의무가 따라붙습니다.
     */
    private static final String FIELDS = String.join(",",
            "opening_hours/weekday_text",
            "utc_offset_minutes",
            "formatted_phone_number",
            "website",
            "rating",
            "user_ratings_total",
            "business_status",
            "url");

    private final TripAccessPolicy access;
    private final DayRepository days;
    private final PlaceRepository places;

    private final RestClient client = RestClient.builder()
            .baseUrl("https://maps.googleapis.com")
            .build();

    @Value("${fit.google.maps-key:}")
    private String key;

    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<String, Cached>(128, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > CACHE_MAX;
                }
            });

    public boolean enabled() {
        return key != null && !key.isBlank();
    }

    /*
      경로와 같은 이유로 트랜잭션을 걸지 않습니다. 장소마다 구글을 부르는데
      그동안 DB 연결을 붙들고 있으면 다른 요청이 연결을 못 얻습니다.
    */
    public List<Info> ofDay(AuthPrincipal me, String dayId) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanRead(day.getTripId(), me.id());

        if (!enabled()) {
            return List.of();
        }

        List<Info> out = new ArrayList<>();
        for (Place place : places.findAllByDayIdOrderBySortAsc(dayId)) {
            /* 좌표를 직접 넣은 장소에는 번호가 없습니다. 물어볼 데가 없으니
               건너뜁니다. 오류가 아닙니다. */
            if (place.getPlaceId() == null || place.getPlaceId().isBlank()) {
                continue;
            }
            Info info = lookup(place.getId(), place.getPlaceId());
            if (info != null) {
                out.add(info);
            }
            if (out.size() >= MAX_PLACES) {
                break;
            }
        }
        return out;
    }

    private Info lookup(String ourId, String googleId) {
        Cached hit = cache.get(googleId);
        if (hit != null && hit.until().isAfter(Instant.now())) {
            return hit.info() == null ? null : hit.info().withId(ourId);
        }

        Info fresh = ask(ourId, googleId);
        cache.put(googleId, new Cached(fresh, Instant.now().plus(KEEP)));
        return fresh;
    }

    private Info ask(String ourId, String googleId) {
        JsonNode body;
        try {
            body = client.get()
                    .uri(uri -> uri.path("/maps/api/place/details/json")
                            .queryParam("place_id", googleId)
                            .queryParam("fields", FIELDS)
                            .queryParam("language", "ko")
                            .queryParam("key", key)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
        } catch (Exception e) {
            /* 한 곳을 못 받았다고 하루 전체를 막을 이유는 없습니다. */
            log.warn("장소 정보를 받지 못했습니다: {}", e.getMessage());
            return null;
        }

        if (body == null) {
            return null;
        }
        String status = body.path("status").asText("");
        if (!"OK".equals(status)) {
            /* 가게가 없어졌으면 NOT_FOUND 가 옵니다. 그것도 정보이긴 하지만
               번호가 낡은 것인지 가게가 닫힌 것인지 구별할 수 없어 비워 둡니다. */
            log.warn("장소 정보가 거절됐습니다: status={} message={}",
                    status, body.path("error_message").asText(""));
            return null;
        }

        JsonNode r = body.path("result");
        List<String> hours = new ArrayList<>();
        for (JsonNode line : r.path("opening_hours").path("weekday_text")) {
            hours.add(line.asText());
        }

        return new Info(
                ourId,
                todayOf(hours, r.path("utc_offset_minutes")),
                hours,
                text(r, "formatted_phone_number"),
                text(r, "website"),
                r.hasNonNull("rating") ? r.path("rating").asDouble() : null,
                r.hasNonNull("user_ratings_total") ? r.path("user_ratings_total").asInt() : null,
                "CLOSED_PERMANENTLY".equals(r.path("business_status").asText("")),
                text(r, "url"));
    }

    /**
     * 오늘 몇 시에 여는지.
     *
     * <p>여기 서버의 오늘이 아니라 <b>그 가게가 있는 곳의 오늘</b>이어야 합니다.
     * 서울이 화요일 아침일 때 파리는 아직 월요일 밤입니다. 구글이 그 장소의
     * 시차를 함께 주므로 그것으로 요일을 셉니다.
     *
     * <p>구글의 요일 목록은 월요일부터 시작합니다.
     */
    private static String todayOf(List<String> hours, JsonNode offsetMinutes) {
        if (hours.size() != 7 || !offsetMinutes.isNumber()) {
            return null;
        }
        ZoneOffset zone = ZoneOffset.ofTotalSeconds(offsetMinutes.asInt() * 60);
        int weekday = OffsetDateTime.now(zone).getDayOfWeek().getValue();   // 월=1
        return hours.get(weekday - 1);
    }

    private static String text(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.path(field).asText() : null;
    }

    /**
     * 한 장소에 대해 화면이 띄우는 것.
     *
     * @param id                우리 쪽 장소 id
     * @param today             그 장소가 있는 곳 기준 오늘의 영업시간
     * @param hours             요일별 영업시간. 월요일부터입니다.
     * @param permanentlyClosed 아예 문을 닫은 가게
     * @param mapUrl            구글 지도에서 이 장소를 여는 주소
     */
    public record Info(String id, String today, List<String> hours,
                       String phone, String website,
                       Double rating, Integer ratingCount,
                       boolean permanentlyClosed, String mapUrl) {

        Info withId(String id) {
            return new Info(id, today, hours, phone, website,
                    rating, ratingCount, permanentlyClosed, mapUrl);
        }
    }

    private record Cached(Info info, Instant until) {
    }
}
