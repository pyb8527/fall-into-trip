package net.weeniebeenie.fit.trip.application;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.support.quota.GoogleQuota;
import net.weeniebeenie.fit.support.quota.GoogleQuotaKey;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
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
 * <p>월요일 휴관을 모르고 갔다가 하루를 날리는 일이 흔합니다. 그래서 <b>오늘</b>
 * 이 아니라 <b>그 장소를 넣어 둔 날</b> 기준으로 봅니다. 10월 9일에 갈 곳이
 * 그날 쉬는지가 궁금한 것이지, 오늘 여는지가 궁금한 것이 아닙니다.
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
     * 구글이 말하는 가게의 형편.
     *
     * <p>전에는 이 자리를 <b>{@code CLOSED_PERMANENTLY} 인지 아닌지</b>로만
     * 읽었습니다. 그래서 우리가 모르는 값이 오면 전부 "아닌 것" 으로 묶여
     * 영업 중으로 흘렀습니다.
     *
     * <p>2026-03-17 에 구글이 {@code FUTURE_OPENING} 을 새로 냈습니다. 아직
     * 문도 안 연 가게가 그 길로 추천 카드에 "그날 영업" 으로 떴습니다. 안 연
     * 곳은 휴무보다 나쁩니다 — 휴무는 다음에 가면 되지만 안 연 곳은 갈 수가
     * 없습니다.
     *
     * <p>그래서 <b>아는 값만 안다고 말합니다.</b> 여기 없는 것이 오면 모르는
     * 것으로 둡니다. 구글이 또 새 값을 내도 같은 일이 되풀이되지 않습니다.
     */
    static final String OPERATIONAL = "OPERATIONAL";
    static final String CLOSED_TEMPORARILY = "CLOSED_TEMPORARILY";
    static final String CLOSED_PERMANENTLY = "CLOSED_PERMANENTLY";

    /**
     * 그날 문을 여는가.
     *
     * <p>세 갈래입니다 — 연다({@code TRUE}), 안 연다({@code FALSE}), 모른다
     * ({@code null}). 모르는 것을 "안 엶" 으로 적으면 멀쩡한 가게가 목록에서
     * 밀려나고, "엶" 으로 적으면 닫힌 문 앞에 사람을 보냅니다.
     *
     * @param closedOnDay 그 날짜에 쉬는지. 영업시간을 보고 이미 판단한 값입니다.
     */
    public static Boolean opensOn(Info info, boolean closedOnDay) {
        if (info == null) {
            return null;
        }
        if (CLOSED_PERMANENTLY.equals(info.status()) || CLOSED_TEMPORARILY.equals(info.status())) {
            /* 아주 닫았거나 잠시 닫았습니다. 둘 다 지금 가면 못 들어갑니다. */
            return false;
        }
        if (!OPERATIONAL.equals(info.status())) {
            /* FUTURE_OPENING 이거나, 구글이 안 보냈거나, 우리가 모르는 새 값. */
            return null;
        }
        return !closedOnDay;
    }

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
     *
     * <p>periods 는 브레이크 타임을 알기 위해 받습니다. weekday_text 는
     * "11:00~15:00, 17:00~22:00" 처럼 한 줄로 오는데, 그 줄을 말로 쪼개면
     * 나라마다 표기가 달라 깨집니다.
     */
    private static final String FIELDS = String.join(",",
            "regularOpeningHours.weekdayDescriptions",
            "regularOpeningHours.periods",
            "utcOffsetMinutes",
            "nationalPhoneNumber",
            "websiteUri",
            "rating",
            "userRatingCount",
            "businessStatus",
            "googleMapsUri");

    private final GoogleQuota quota;
    private final GoogleQuotaKey quotaKey;
    private final TripAccessPolicy access;
    private final DayRepository days;
    private final PlaceRepository places;

    private final RestClient client = RestClient.builder()
            .baseUrl("https://places.googleapis.com")
            .build();

    @Value("${fit.google.maps-key:}")
    private String key;

    /**
     * 주간 원본만 들고 있습니다.
     *
     * <p>"그날 여는가" 는 날짜마다 다른 값이라 여기 넣으면 안 됩니다. 같은
     * 가게가 이틀에 걸쳐 있으면 한쪽 답이 다른 쪽에 새어 나갑니다.
     */
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
            Raw raw = lookup(place.getPlaceId());
            if (raw != null) {
                out.add(viewOf(place.getId(), raw, day.getIso()));
            }
            if (out.size() >= MAX_PLACES) {
                break;
            }
        }
        return out;
    }

    /**
     * 번호 하나로 그 장소의 그날 사정을 봅니다.
     *
     * <p>추천이 씁니다. 일정에 아직 없는 곳이라 {@link #ofDay} 로는 닿지
     * 않습니다.
     *
     * <p>권한을 보지 않습니다 — 구글에 공개된 가게 정보이고, 어느 여행에도
     * 매여 있지 않습니다. 대신 이 자리로 오는 길(추천)은 이미 그 여행을 볼
     * 수 있는 사람만 지나갑니다.
     *
     * @param on 그날. 없으면 그 장소가 있는 곳의 오늘로 봅니다.
     */
    public Info about(String googleId, LocalDate on) {
        if (!enabled() || googleId == null || googleId.isBlank()) {
            return null;
        }
        Raw raw = lookup(googleId);
        return raw == null ? null : viewOf(googleId, raw, on);
    }

    private Raw lookup(String googleId) {
        Cached hit = cache.get(googleId);
        if (hit != null && hit.until().isAfter(Instant.now())) {
            return hit.raw();
        }
        Raw fresh = ask(googleId);
        cache.put(googleId, new Cached(fresh, Instant.now().plus(KEEP)));
        return fresh;
    }

    /**
     * 그 장소를 넣어 둔 날 기준으로 추립니다.
     *
     * <p>날짜가 없는 여행이면 그 장소가 있는 곳의 오늘로 봅니다. 여기 서버의
     * 오늘이 아닙니다 — 서울이 화요일 아침일 때 파리는 아직 월요일 밤입니다.
     */
    private static Info viewOf(String placeId, Raw raw, LocalDate on) {
        LocalDate target = on;
        if (target == null && raw.utcOffsetMinutes() != null) {
            ZoneOffset zone = ZoneOffset.ofTotalSeconds(raw.utcOffsetMinutes() * 60);
            target = OffsetDateTime.now(zone).toLocalDate();
        }

        String text = null;
        List<Span> spans = List.of();
        boolean closed = false;

        if (target != null) {
            int weekday = target.getDayOfWeek().getValue();      // 월=1 … 일=7
            if (raw.hours().size() == 7) {
                /* 구글의 요일 목록은 월요일부터 시작합니다. */
                text = raw.hours().get(weekday - 1);
            }
            /* 그런데 periods 쪽은 일요일이 0 입니다. 같은 응답 안에서 기준이
               다르므로 각각 맞춰 세야 합니다. */
            int googleDay = weekday == 7 ? 0 : weekday;
            spans = raw.spansByDay().getOrDefault(googleDay, List.of());
            closed = spans.isEmpty() && text != null && looksClosed(text);
        }

        return new Info(placeId, text, closed, spans, raw.hours(),
                raw.phone(), raw.website(), raw.rating(), raw.ratingCount(),
                CLOSED_PERMANENTLY.equals(raw.status()), raw.status(), raw.mapUrl());
    }

    /**
     * 그 줄이 "쉼" 을 뜻하는지.
     *
     * <p>여는 구간이 하나도 없으면 대개 쉬는 날이지만, 구글이 시간을 모르는
     * 경우도 같은 모양입니다. 글에 쉰다고 적혀 있을 때만 쉰다고 말합니다 —
     * 모르는 것을 쉰다고 하면 멀쩡한 가게를 지나칩니다.
     */
    private static boolean looksClosed(String text) {
        String lower = text.toLowerCase();
        return lower.contains("휴무") || lower.contains("휴업") || lower.contains("closed");
    }

    private Raw ask(String googleId) {
        /* 캐시에 맞은 장소는 여기까지 안 옵니다. 하루를 펼칠 때 열둘을 미리
           빼던 것이 여기로 내려왔습니다 — 실제로 물어본 것만 셉니다. */
        quota.spend(quotaKey.current(), 1);

        JsonNode r;
        try {
            r = client.get()
                    .uri(uri -> uri.path("/v1/places/{id}")
                            .queryParam("languageCode", "ko")
                            .build(googleId))
                    .header("X-Goog-Api-Key", key)
                    .header("X-Goog-FieldMask", FIELDS)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            /* 왜 거절했는지는 본문에 적혀 있습니다. 이것을 버리면 콘솔에서
               이 API 를 안 켠 것인지 알 길이 없습니다. */
            String why = e.getResponseBodyAsString();
            log.warn("장소 정보가 거절됐습니다 ({}): {}", e.getStatusCode(),
                    why.length() > 300 ? why.substring(0, 300) : why);
            return null;
        } catch (Exception e) {
            /* 한 곳을 못 받았다고 하루 전체를 막을 이유는 없습니다. */
            log.warn("장소 정보를 받지 못했습니다: {}", e.getMessage());
            return null;
        }

        if (r == null) {
            return null;
        }

        List<String> hours = new ArrayList<>();
        for (JsonNode line : r.path("regularOpeningHours").path("weekdayDescriptions")) {
            hours.add(line.asText());
        }

        return new Raw(
                hours,
                spansOf(r.path("regularOpeningHours").path("periods")),
                r.hasNonNull("utcOffsetMinutes") ? r.path("utcOffsetMinutes").asInt() : null,
                text(r, "nationalPhoneNumber"),
                text(r, "websiteUri"),
                r.hasNonNull("rating") ? r.path("rating").asDouble() : null,
                r.hasNonNull("userRatingCount") ? r.path("userRatingCount").asInt() : null,
                text(r, "businessStatus"),
                text(r, "googleMapsUri"));
    }

    /**
     * 여는 구간을 요일별로 모읍니다.
     *
     * <p>한 요일에 구간이 둘이면 그 사이가 브레이크 타임입니다. 점심만 하고
     * 닫았다가 저녁에 다시 여는 가게가 그렇습니다.
     *
     * <p>여기서 요일은 <b>일요일이 0</b> 입니다. 같은 응답의 weekday_text 는
     * 월요일부터인데 이쪽만 다릅니다.
     */
    private static Map<Integer, List<Span>> spansOf(JsonNode periods) {
        Map<Integer, List<Span>> byDay = new LinkedHashMap<>();
        for (JsonNode period : periods) {
            JsonNode open = period.path("open");
            if (!open.hasNonNull("day") || !open.hasNonNull("hour")) {
                continue;
            }
            /* 닫는 시각이 없으면 24시간 영업입니다. */
            JsonNode close = period.path("close");
            byDay.computeIfAbsent(open.path("day").asInt(), d -> new ArrayList<>())
                    .add(new Span(clock(open), close.hasNonNull("hour") ? clock(close) : null));
        }
        return byDay;
    }

    /**
     * 시각을 사람이 읽는 모양으로.
     *
     * <p>옛 API 는 "1130" 처럼 붙여 보냈고 새 API 는 시와 분을 숫자로 따로
     * 보냅니다. 자리를 맞춰 붙이면 됩니다 — 잘라 붙이던 것보다 오히려
     * 튼튼합니다. 세 자리로 오던 것에 걸려 넘어지지 않습니다.
     */
    private static String clock(JsonNode at) {
        int hour = at.path("hour").asInt();
        int minute = at.path("minute").asInt();
        return String.format("%02d:%02d", hour, minute);
    }

    private static String text(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.path(field).asText() : null;
    }

    /** 여는 구간 하나. end 가 비어 있으면 그날 안 닫습니다. */
    public record Span(String start, String end) {
    }

    /**
     * 화면이 띄우는 것.
     *
     * @param onDay        그 장소를 넣어 둔 날의 영업시간
     * @param closedOnDay  그날 쉬는지
     * @param spans        그날 여는 구간들. 둘 이상이면 사이가 브레이크 타임입니다.
     * @param hours        요일별 전체. 월요일부터입니다.
     * @param permanentlyClosed 아주 문을 닫았는지. 화면이 "문을 닫은 곳입니다" 에 씁니다
     * @param status       구글이 말한 형편 그대로. 우리가 모르는 값도 그대로 옵니다 —
     *                     아는 것만 안다고 말하려면 원본이 있어야 합니다
     */
    public record Info(String id, String onDay, boolean closedOnDay, List<Span> spans,
                       List<String> hours, String phone, String website,
                       Double rating, Integer ratingCount,
                       boolean permanentlyClosed, String status, String mapUrl) {
    }

    /** 구글에서 받은 주간 원본. 날짜에 매이지 않아 캐시에 둘 수 있습니다. */
    private record Raw(List<String> hours, Map<Integer, List<Span>> spansByDay,
                       Integer utcOffsetMinutes, String phone, String website,
                       Double rating, Integer ratingCount,
                       String status, String mapUrl) {
    }

    private record Cached(Raw raw, Instant until) {
    }
}
