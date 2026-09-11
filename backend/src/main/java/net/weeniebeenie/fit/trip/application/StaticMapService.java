package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.support.quota.GoogleQuota;
import net.weeniebeenie.fit.support.quota.GoogleQuotaKey;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 일정을 한 장의 지도 그림으로.
 *
 * <p>목록에서 글마다 지도를 띄우려면 그림이 필요합니다. 살아 있는 지도를 여러
 * 개 얹으면 화면이 무거워지고, 무엇보다 브라우저에 키가 나가야 합니다.
 *
 * <p>그래서 서버가 대신 받아 옵니다. 키는 여기 한 곳에만 있고, 화면은 우리
 * 주소만 부릅니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StaticMapService {

    /**
     * 그림에 찍을 점의 최대치.
     *
     * <p>주소 길이에 한계가 있고, 썸네일에서는 점이 스무 개만 넘어도 선으로
     * 뭉칩니다. 넘으면 고르게 솎아 냅니다 — 앞부분만 자르면 동선의 모양이
     * 달라집니다.
     */
    private static final int MAX_POINTS = 30;

    /**
     * 그림을 들고 있는 시간.
     *
     * <p>같은 글의 썸네일을 사람마다 다시 받아 오면 그만큼 요금이 붙습니다.
     * 디스크에 남기지 않고 메모리에만 둡니다 — 구글 약관이 결과를 오래 쌓아
     * 두는 것을 제한합니다.
     */
    private static final Duration KEEP = Duration.ofHours(6);

    /** 들고 있을 그림의 수. 하나에 수십 KB 라 넉넉히 잡아도 됩니다. */
    private static final int CACHE_MAX = 200;

    private final GoogleQuota quota;
    private final GoogleQuotaKey quotaKey;

    private final RestClient client = RestClient.builder()
            .baseUrl("https://maps.googleapis.com")
            .build();

    @Value("${fit.google.maps-key:}")
    private String key;

    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<String, Cached>(64, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > CACHE_MAX;
                }
            });

    public boolean enabled() {
        return key != null && !key.isBlank();
    }

    /**
     * 점들을 이어 그린 지도 그림.
     *
     * @param points 순서대로 이어집니다. 두 개 미만이면 선 없이 점만 찍습니다.
     */
    public byte[] render(List<Point> points, int width, int height) {
        if (!enabled()) {
            throw ApiException.badRequest("지도 그림이 꺼져 있습니다.");
        }
        List<Point> thinned = thin(points);
        if (thinned.isEmpty()) {
            throw ApiException.badRequest("그릴 곳이 없습니다.");
        }

        String id = cacheKey(thinned, width, height);
        Cached hit = cache.get(id);
        if (hit != null && hit.until().isAfter(Instant.now())) {
            return hit.png();
        }

        StringBuilder path = new StringBuilder("color:0x3182F6|weight:4");
        StringBuilder marks = new StringBuilder("size:small|color:0x3182F6");
        for (Point p : thinned) {
            String at = String.format(Locale.ROOT, "%.5f,%.5f", p.lat(), p.lng());
            path.append('|').append(at);
            marks.append('|').append(at);
        }

        /* 캐시에 맞은 그림은 위에서 돌아갔습니다. 여기까지 온 것만 셉니다 —
           같은 글의 썸네일을 여럿이 봐도 구글은 여섯 시간에 한 번입니다. */
        quota.spend(quotaKey.current(), 1);

        byte[] png;
        try {
            png = client.get()
                    .uri(uri -> uri.path("/maps/api/staticmap")
                            .queryParam("size", width + "x" + height)
                            /* 촘촘한 화면에서 흐리게 보이지 않도록 두 배로 받습니다. */
                            .queryParam("scale", 2)
                            .queryParam("maptype", "roadmap")
                            .queryParam("language", "ko")
                            .queryParam("path", path.toString())
                            .queryParam("markers", marks.toString())
                            .queryParam("key", key)
                            .build())
                    .retrieve()
                    .body(byte[].class);
        } catch (RestClientResponseException e) {
            /*
              구글이 왜 거절했는지는 본문에 적혀 있습니다.

              이것을 버리면 "받지 못했습니다" 만 남아, 키가 잘못된 것인지
              콘솔에서 이 API 를 안 켠 것인지 알 길이 없습니다. 실제로 장소
              검색이 되는데 그림만 안 나오는 일이 생기는데, 그때 답은 늘
              본문에 있습니다("This API project is not authorized to use this
              API" 같은 한 줄).

              본문에는 키가 들어 있지 않습니다 — 우리가 보낸 주소가 아니라
              구글이 돌려준 설명입니다. 그래도 길게 남기지는 않습니다.
             */
            String why = e.getResponseBodyAsString();
            log.warn("지도 그림을 받지 못했습니다 ({}): {}", e.getStatusCode(),
                    why.length() > 200 ? why.substring(0, 200) : why);
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "지도 그림을 받지 못했습니다.");
        } catch (Exception e) {
            log.warn("지도 그림을 받지 못했습니다: {}", e.getMessage());
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "지도 그림을 받지 못했습니다.");
        }

        if (png == null || png.length == 0) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "지도 그림을 받지 못했습니다.");
        }
        cache.put(id, new Cached(png, Instant.now().plus(KEEP)));
        return png;
    }

    /**
     * 점이 너무 많으면 고르게 솎아 냅니다.
     *
     * <p>앞에서 잘라 내면 동선이 중간에서 끊긴 것처럼 보입니다. 처음과 끝은
     * 반드시 남기고 사이를 일정한 간격으로 뽑습니다.
     */
    private static List<Point> thin(List<Point> points) {
        if (points.size() <= MAX_POINTS) {
            return points;
        }
        List<Point> out = new ArrayList<>(MAX_POINTS);
        double step = (points.size() - 1) / (double) (MAX_POINTS - 1);
        for (int i = 0; i < MAX_POINTS; i++) {
            out.add(points.get((int) Math.round(i * step)));
        }
        return out;
    }

    private static String cacheKey(List<Point> points, int width, int height) {
        StringBuilder id = new StringBuilder(width + "x" + height);
        for (Point p : points) {
            id.append(String.format(Locale.ROOT, "|%.5f,%.5f", p.lat(), p.lng()));
        }
        return id.toString();
    }

    public record Point(double lat, double lng) {
    }

    private record Cached(byte[] png, Instant until) {
    }
}
