package net.weeniebeenie.fit.trip.application;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Coordinates;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 장소에서 장소로 가는 데 걸리는 시간과 실제 경로.
 *
 * <p>같은 두 지점이라도 걸어서 25분이 지하철로 8분입니다. 그래서 수단을 받아
 * 그 수단으로 계산합니다.
 *
 * <p>대중교통은 경유지를 넣을 수 없습니다(구글 제약). 그래서 한 구간씩 따로
 * 묻습니다. 다른 수단도 같은 길로 통일했습니다. 수단마다 코드가 갈리면 화면에서
 * 어느 쪽이 왜 다른지 설명하기 어려워집니다.
 *
 * <p>키는 장소 검색과 같은 것을 씁니다. 구글 콘솔에서 그 키에 Routes API 를
 * 허용해 두어야 합니다. 안 그러면 거절당합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RouteService {

    /**
     * 한 번에 물어볼 구간의 최대치.
     *
     * <p>구간마다 요금이 붙습니다. 하루에 열 곳을 넘게 넣는 일정은 드물고,
     * 실수로 큰 여행을 통째로 계산해 요금이 튀는 일을 막습니다.
     */
    private static final int MAX_LEGS = 12;

    /**
     * 답을 들고 있는 시간.
     *
     * <p>걷기와 자동차는 좌표가 같으면 답도 거의 같아 오래 들고 있어도 됩니다.
     * 대중교통은 시각에 따라 달라지므로 짧게 둡니다.
     *
     * <p>디스크에 남기지 않고 메모리에만 둡니다. 구글 약관이 결과를 오래 쌓아
     * 두는 것을 제한합니다.
     */
    private static final Duration KEEP_STATIC = Duration.ofHours(6);
    private static final Duration KEEP_TRANSIT = Duration.ofMinutes(20);

    /** 들고 있을 답의 개수. 넘으면 오래 안 쓴 것부터 버립니다. */
    private static final int CACHE_MAX = 2000;

    private final TripAccessPolicy access;
    private final DayRepository days;
    private final PlaceRepository places;

    private final RestClient client = RestClient.builder()
            .baseUrl("https://routes.googleapis.com")
            .build();

    @Value("${fit.google.maps-key:}")
    private String key;

    /** 오래 안 쓴 것부터 빠지도록 접근 순서를 기억하는 맵. */
    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<String, Cached>(256, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > CACHE_MAX;
                }
            });

    public boolean enabled() {
        return key != null && !key.isBlank();
    }

    /*
      일부러 트랜잭션으로 감싸지 않습니다. 구간마다 구글을 부르는데, 그동안
      트랜잭션이 열려 있으면 DB 연결 하나를 네트워크가 끝날 때까지 붙들고
      있게 됩니다. 열두 구간이면 몇 초입니다. 그 사이 다른 요청이 연결을
      못 얻습니다.

      읽기는 두 번뿐이고 서로 묶여야 할 이유가 없어, 각자 알아서 열고 닫게
      둡니다.
    */
    public DayRoute of(AuthPrincipal me, String dayId, Mode mode) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanRead(day.getTripId(), me.id());

        if (!enabled()) {
            throw ApiException.badRequest("경로 안내가 꺼져 있습니다.");
        }

        List<Place> list = places.findAllByDayIdOrderBySortAsc(dayId);
        if (list.size() < 2) {
            return new DayRoute(mode, List.of(), 0, 0, false);
        }

        int pairs = Math.min(list.size() - 1, MAX_LEGS);
        boolean trimmed = list.size() - 1 > MAX_LEGS;

        List<Leg> legs = new ArrayList<>(pairs);
        int seconds = 0;
        int meters = 0;

        for (int i = 0; i < pairs; i++) {
            Leg leg = leg(list.get(i), list.get(i + 1), mode);
            legs.add(leg);
            if (leg.reachable()) {
                seconds += leg.seconds();
                meters += leg.meters();
            }
        }

        return new DayRoute(mode, legs, seconds, meters, trimmed);
    }

    /**
     * 지금 서 있는 자리에서 그 장소까지.
     *
     * <p>일정에 적힌 순서가 아니라 <b>내가 있는 곳</b>이 출발점입니다. 길 위에서
     * 궁금한 것은 대개 이쪽입니다.
     *
     * <p>보낸 좌표는 어디에도 남기지 않습니다. 이 요청을 처리하는 동안만 씁니다.
     * 아래 캐시에도 넣지 않습니다 — 사람이 움직이므로 다음에 물을 때는 이미
     * 다른 자리이고, 무엇보다 남의 위치를 서버가 들고 있을 이유가 없습니다.
     */
    public Leg fromHere(AuthPrincipal me, String placeId, double lat, double lng, Mode mode) {
        Place to = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없습니다."));
        Day day = days.findById(to.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanRead(day.getTripId(), me.id());

        if (!enabled()) {
            throw ApiException.badRequest("경로 안내가 꺼져 있습니다.");
        }

        Coordinates at = Coordinates.of(lat, lng);
        Place here = Place.builder().name("여기").lat(at.lat()).lng(at.lng()).build();
        return ask(here, to, mode).withEnds("me", to.getId());
    }

    private Leg leg(Place from, Place to, Mode mode) {
        String id = cacheKey(from, to, mode);
        Cached hit = cache.get(id);
        if (hit != null && hit.until().isAfter(Instant.now())) {
            return hit.leg().withEnds(from.getId(), to.getId());
        }

        Leg fresh = ask(from, to, mode);
        Duration keep = mode == Mode.TRANSIT ? KEEP_TRANSIT : KEEP_STATIC;
        cache.put(id, new Cached(fresh, Instant.now().plus(keep)));
        return fresh;
    }

    /**
     * 같은 자리를 다시 묻지 않도록 좌표를 다섯 자리까지만 봅니다. 그 아래는 한
     * 걸음 남짓이라 경로가 달라지지 않습니다.
     */
    private String cacheKey(Place from, Place to, Mode mode) {
        return String.format(Locale.ROOT, "%s|%.5f,%.5f|%.5f,%.5f",
                mode, from.getLat(), from.getLng(), to.getLat(), to.getLng());
    }

    private Leg ask(Place from, Place to, Mode mode) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("origin", point(from.getLat(), from.getLng()));
        body.put("destination", point(to.getLat(), to.getLng()));
        body.put("travelMode", mode.name());
        body.put("languageCode", "ko");
        body.put("units", "METRIC");
        /* routingPreference 는 차로 갈 때만 받습니다. 걷기나 대중교통에 붙이면
           요청 자체가 거절당합니다. */
        if (mode == Mode.DRIVE) {
            body.put("routingPreference", "TRAFFIC_AWARE");
        }

        try {
            JsonNode res = client.post()
                    .uri("/directions/v2:computeRoutes")
                    .header("X-Goog-Api-Key", key)
                    /* 달라고 한 것만 옵니다. 안 적으면 요청이 거절되고, 넓게
                       적으면 더 비싼 등급으로 넘어갑니다. */
                    .header("X-Goog-FieldMask",
                            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline")
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            JsonNode route = res == null ? null : res.path("routes").path(0);
            if (route == null || route.isMissingNode() || route.isEmpty()) {
                /*
                  섬과 뭍처럼 그 수단으로는 이어지지 않는 구간이 있습니다.
                  오류가 아니라 "그 길은 없다" 입니다.

                  대중교통에서는 자주 일어납니다. 두 곳이 몇 백 미터밖에 안
                  떨어져 있으면 구글은 버스나 지하철을 태울 이유가 없다고 보고
                  아무 경로도 주지 않습니다. 그래서 짧은 구간만 있는 하루는
                  대중교통으로 아무것도 안 나오는 것처럼 보입니다.

                  왜 비었는지 뒤에서 알아볼 수 있게 남깁니다. 조용히 넘기면
                  키 문제인지 거리 문제인지 구별할 방법이 없습니다.
                */
                log.info("경로가 비었습니다: mode={} {},{} -> {},{} 응답={}",
                        mode, from.getLat(), from.getLng(), to.getLat(), to.getLng(),
                        res == null ? "null" : res.toString());
                return Leg.unreachable(from.getId(), to.getId());
            }

            return new Leg(
                    from.getId(),
                    to.getId(),
                    seconds(route.path("duration").asText("")),
                    route.path("distanceMeters").asInt(0),
                    route.path("polyline").path("encodedPolyline").asText(null),
                    true);
        } catch (Exception e) {
            /* 한 구간이 안 됐다고 하루 전체를 못 보여 줄 이유는 없습니다.
               그 구간만 비워 두고 나머지를 그립니다. */
            log.warn("경로를 받지 못했습니다: mode={} {}", mode, e.getMessage());
            return Leg.unreachable(from.getId(), to.getId());
        }
    }

    private static Map<String, Object> point(double lat, double lng) {
        return Map.of("location", Map.of("latLng", Map.of("latitude", lat, "longitude", lng)));
    }

    /** 구글은 "165s" 처럼 초 뒤에 s 를 붙여 보냅니다. */
    private static int seconds(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        String digits = text.endsWith("s") ? text.substring(0, text.length() - 1) : text;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** 사람이 고르는 이동 수단. 구글이 받는 이름과 같게 둡니다. */
    public enum Mode {
        WALK,
        TRANSIT,
        DRIVE
    }

    /**
     * 한 구간.
     *
     * @param polyline  지도에 그릴 길. 이어지지 않는 구간이면 비어 있습니다.
     * @param reachable 그 수단으로 갈 수 있는지
     */
    public record Leg(String fromId, String toId, int seconds, int meters,
                      String polyline, boolean reachable) {

        static Leg unreachable(String fromId, String toId) {
            return new Leg(fromId, toId, 0, 0, null, false);
        }

        Leg withEnds(String fromId, String toId) {
            return new Leg(fromId, toId, seconds, meters, polyline, reachable);
        }
    }

    /**
     * 하루치 경로.
     *
     * @param trimmed 장소가 너무 많아 뒷부분을 계산하지 않았는지
     */
    public record DayRoute(Mode mode, List<Leg> legs, int totalSeconds, int totalMeters,
                           boolean trimmed) {
    }

    private record Cached(Leg leg, Instant until) {
    }
}
