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
     * 장소와 장소 사이를 <b>세 수단으로 한꺼번에</b>.
     *
     * <p>전에는 사람이 위에서 수단을 하나 골라야 이동 시간이 나왔습니다. 그런데
     * 정작 알고 싶은 것은 "이 구간은 뭘 타야 하나" 이고, 그것은 셋을 나란히
     * 놓아야만 알 수 있습니다. 걸어서 25분인 줄 알았는데 지하철도 25분이면
     * 그냥 걷는 게 낫습니다.
     *
     * <p>그래서 날짜를 펼치면 알아서 셋을 다 계산해 사이사이에 끼워 넣습니다.
     * 고르는 일이 사라집니다.
     *
     * <p><b>구간마다 요금이 세 배로 나갑니다.</b> 그래서 이렇게 막아 둡니다.
     *
     * <ul>
     *   <li>"전체" 를 볼 때는 부르지 않습니다. 날짜 하나를 펼쳤을 때만입니다.
     *       (그 판단은 화면이 합니다)</li>
     *   <li>답은 걷기·자동차 여섯 시간, 대중교통 이십 분 들고 있습니다. 같은
     *       날을 다시 열어도 다시 나가지 않습니다.</li>
     *   <li>한 날에 열두 구간까지만 봅니다.</li>
     * </ul>
     *
     * <p>세 수단이 모두 안 되는 구간도 있습니다(몇 백 미터 거리에는 구글이
     * 대중교통을 안 태웁니다). 그런 것은 빼고 되는 것만 내놓습니다.
     */
    public List<Gap> compare(AuthPrincipal me, String dayId) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanRead(day.getTripId(), me.id());

        if (!enabled()) {
            throw ApiException.badRequest("경로 안내가 꺼져 있습니다.");
        }

        List<Place> list = places.findAllByDayIdOrderBySortAsc(dayId);
        if (list.size() < 2) {
            return List.of();
        }

        int pairs = Math.min(list.size() - 1, MAX_LEGS);
        List<Gap> out = new ArrayList<>(pairs);

        for (int i = 0; i < pairs; i++) {
            Place from = list.get(i);
            Place to = list.get(i + 1);

            List<Option> options = new ArrayList<>(3);
            for (Mode mode : Mode.values()) {
                Leg leg = leg(from, to, mode);
                if (leg.reachable() && leg.seconds() > 0) {
                    options.add(new Option(mode, leg.seconds(), leg.meters(),
                            leg.polyline(), leg.fare()));
                }
            }
            out.add(new Gap(from.getId(), to.getId(), options,
                    pick(options, true), pick(options, false)));
        }
        return out;
    }

    /**
     * 추천할 것 하나.
     *
     * @param fastest 시간을 아끼는 쪽이면 true, 돈을 아끼는 쪽이면 false
     *
     * <p>돈 쪽은 요금이 <b>없는</b> 것(걷기)이 가장 쌉니다. 같은 값이면 빠른
     * 쪽을 고릅니다. 다만 통화가 서로 다르면 비교하지 않습니다 — 엔과 원을
     * 숫자만으로 견주면 엉뚱한 답이 나옵니다. 한 구간 안에서는 통화가 같으므로
     * 실제로 문제가 되지는 않지만, 그래도 확인하고 넘어갑니다.
     */
    private static Mode pick(List<Option> options, boolean fastest) {
        Option best = null;
        for (Option o : options) {
            if (best == null) {
                best = o;
                continue;
            }
            if (fastest) {
                if (o.seconds() < best.seconds()) {
                    best = o;
                }
                continue;
            }
            long mine = o.fare() == null ? 0 : o.fare().amount();
            long theirs = best.fare() == null ? 0 : best.fare().amount();
            boolean sameMoney = o.fare() == null || best.fare() == null
                    || o.fare().currency().equals(best.fare().currency());
            if (!sameMoney) {
                continue;
            }
            if (mine < theirs || (mine == theirs && o.seconds() < best.seconds())) {
                best = o;
            }
        }
        return best == null ? null : best.mode();
    }

    /**
     * 한 수단으로 갔을 때.
     *
     * @param fare 대중교통은 구글이 준 값, 자동차는 우리가 어림한 값, 걷기는
     *             없음. 어느 쪽인지는 fare.estimated 가 말합니다.
     */
    public record Option(Mode mode, int seconds, int meters, String polyline,
                         TaxiFare.Money fare) {
    }

    /**
     * 장소와 장소 사이의 빈칸.
     *
     * @param fastest  가장 빨리 가는 수단
     * @param cheapest 가장 돈이 덜 드는 수단. 둘이 같으면 고민할 것이 없습니다.
     */
    public record Gap(String fromId, String toId, List<Option> options,
                      Mode fastest, Mode cheapest) {
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
                    /* 대중교통일 때만 요금을 더 달라고 합니다. 걷기·자동차에
                       붙이면 있지도 않은 칸을 달라는 것이라 거절당합니다. */
                    .header("X-Goog-FieldMask", mode == Mode.TRANSIT
                            ? "routes.duration,routes.distanceMeters,"
                              + "routes.polyline.encodedPolyline,routes.travelAdvisory.transitFare"
                            : "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline")
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

            int meters = route.path("distanceMeters").asInt(0);
            TaxiFare.Money fare = mode == Mode.TRANSIT
                    ? transitFare(route.path("travelAdvisory").path("transitFare"))
                    /* 구글은 택시 요금을 주지 않습니다. 우리가 어림하고, 화면이
                       "어림값" 이라고 붙입니다. */
                    : mode == Mode.DRIVE
                            ? TaxiFare.estimate(from.getLat(), from.getLng(), meters)
                            : null;

            return new Leg(
                    from.getId(),
                    to.getId(),
                    seconds(route.path("duration").asText("")),
                    meters,
                    route.path("polyline").path("encodedPolyline").asText(null),
                    true,
                    fare);
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
                      String polyline, boolean reachable, TaxiFare.Money fare) {

        static Leg unreachable(String fromId, String toId) {
            return new Leg(fromId, toId, 0, 0, null, false, null);
        }

        Leg withEnds(String fromId, String toId) {
            return new Leg(fromId, toId, seconds, meters, polyline, reachable, fare);
        }
    }

    /**
     * 구글이 준 대중교통 요금.
     *
     * <p>{"currencyCode":"JPY","units":"230"} 처럼 옵니다. 소수점 아래는 nanos
     * 로 따로 오는데, 표에 적을 값이라 버립니다.
     *
     * <p>이것은 어림이 아니라 구글이 계산한 값이라 estimated 가 false 입니다.
     */
    private static TaxiFare.Money transitFare(JsonNode fare) {
        if (fare == null || fare.isMissingNode() || !fare.hasNonNull("currencyCode")) {
            return null;
        }
        long units = fare.path("units").asLong(0);
        if (units <= 0) {
            return null;
        }
        return new TaxiFare.Money(fare.path("currencyCode").asText(""), units, false);
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
