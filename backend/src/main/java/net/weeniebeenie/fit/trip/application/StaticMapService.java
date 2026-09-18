package net.weeniebeenie.fit.trip.application;

import net.weeniebeenie.fit.trip.domain.DayLabels;

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

    /**
     * 조용한 지도.
     *
     * <h3>왜 여기에 또 적는가</h3>
     *
     * <p>화면의 살아 있는 지도는 같은 뜻을 JSON 으로 적어 둡니다
     * (frontend/src/lib/map-style.ts). 그런데 그림 API 는 그 JSON 을 안 받고
     * {@code style=feature:...|element:...|color:0x...} 꼴만 받습니다. 같은
     * 값을 두 말로 적을 수밖에 없습니다.
     *
     * <p><b>둘을 함께 고쳐야 합니다.</b> 한쪽만 고치면 글 목록의 썸네일과
     * 그 글을 열었을 때의 지도가 다른 지도가 됩니다 — 실제로 그랬습니다.
     * 썸네일만 구글 기본 지도라 가게 이름이 색색으로 덮여 있고, 정작
     * 보여 주려던 동선이 그 위에서 한 가닥 선으로 묻혔습니다.
     *
     * <p>하는 일은 지도를 예쁘게 만드는 것이 아니라 <b>조용하게</b> 만드는
     * 것입니다. 땅·물·길은 겨우 구별될 만큼만 남기고 구글이 찍어 주는 가게
     * 표시는 지웁니다. 그래야 우리가 그린 동선이 가장 진한 것이 됩니다.
     */
    private static final List<String> QUIET = List.of(
            "element:geometry|color:0xF7F6F3",
            "element:labels.text.fill|color:0x8B867D",
            "element:labels.text.stroke|color:0xFFFFFF",
            "element:labels.icon|visibility:off",
            "feature:administrative|element:geometry|color:0xE2DFD8",
            "feature:administrative.locality|element:labels.text.fill|color:0x5C5852",
            "feature:poi|element:labels|visibility:off",
            "feature:poi|element:geometry|color:0xEFEDE7",
            "feature:poi.park|element:geometry|color:0xE3EDE3",
            "feature:road|element:geometry|color:0xFFFFFF",
            "feature:road|element:geometry.stroke|color:0xEAE7E0",
            "feature:road|element:labels|visibility:off",
            "feature:road.highway|element:geometry|color:0xF1EDE4",
            "feature:road.highway|element:geometry.stroke|color:0xE0D9CB",
            "feature:transit|element:geometry|color:0xE9E5DC",
            "feature:transit|element:labels|visibility:off",
            "feature:water|element:geometry|color:0xD7E4E6",
            "feature:water|element:labels.text.fill|color:0x93A5A8");

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
     * 점들을 이어 그린 지도 그림. 날짜 구분 없이 한 색으로 잇습니다.
     *
     * @param points 순서대로 이어집니다. 두 개 미만이면 선 없이 점만 찍습니다.
     */
    public byte[] render(List<Point> points, int width, int height) {
        return renderDays(List.of(points), width, height);
    }

    /**
     * 날짜마다 다른 색으로 이어 그린 지도 그림.
     *
     * <h3>왜 날짜마다 색을 나누는가</h3>
     *
     * <p>한 색으로 스무 곳을 이으면 닷새치 동선이 <b>한 덩어리 실뭉치</b>가
     * 됩니다. 어디가 첫날이고 어디가 마지막 날인지 알 수 없고, 겹치는 구간이
     * 많은 여행일수록 더합니다.
     *
     * <p>화면의 지도가 이미 날짜마다 색을 씁니다. 썸네일이 같은 색을 쓰면
     * 글 목록에서 본 그림과 열어 본 지도가 같은 것으로 읽힙니다.
     *
     * @param days 날짜별 점들. 빈 날은 그냥 건너뜁니다
     */
    public byte[] renderDays(List<List<Point>> days, int width, int height) {
        if (!enabled()) {
            throw ApiException.badRequest("지도 그림이 꺼져 있습니다.");
        }
        List<List<Point>> thinned = thinDays(days);
        if (thinned.isEmpty()) {
            throw ApiException.badRequest("그릴 곳이 없습니다.");
        }

        String id = cacheKey(thinned, width, height);
        Cached hit = cache.get(id);
        if (hit != null && hit.until().isAfter(Instant.now())) {
            return hit.png();
        }

        List<String> paths = new ArrayList<>();
        List<String> markers = new ArrayList<>();
        for (int i = 0; i < thinned.size(); i++) {
            String color = "0x" + DayLabels.COLORS[i % DayLabels.COLORS.length].substring(1);
            /* 선을 굵게 둡니다. 썸네일은 가로 600 이라 4 로는 도로와 굵기가
               비슷해져, 조용한 바탕에서도 어느 것이 동선인지 한눈에 안 옵니다. */
            StringBuilder path = new StringBuilder("color:" + color + "|weight:5");
            /* 점은 글자 없는 작은 동그라미로. 기본 물방울은 스무 개가 서면
               서로 덮어서 동선을 가립니다. */
            StringBuilder mark = new StringBuilder("size:tiny|color:" + color);
            for (Point p : thinned.get(i)) {
                String at = String.format(Locale.ROOT, "%.5f,%.5f", p.lat(), p.lng());
                path.append('|').append(at);
                mark.append('|').append(at);
            }
            paths.add(path.toString());
            markers.add(mark.toString());
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
                            .queryParam("style", QUIET.toArray())
                            .queryParam("path", paths.toArray())
                            .queryParam("markers", markers.toArray())
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
    private static List<Point> thin(List<Point> points, int room) {
        if (points.size() <= room) {
            return points;
        }
        if (room <= 1) {
            /* 자리가 하나뿐인 날은 첫 곳만 찍습니다. 선은 못 그려도 그 날에
               무언가 있었다는 것은 남습니다. */
            return List.of(points.get(0));
        }
        List<Point> out = new ArrayList<>(room);
        double step = (points.size() - 1) / (double) (room - 1);
        for (int i = 0; i < room; i++) {
            out.add(points.get((int) Math.round(i * step)));
        }
        return out;
    }

    /**
     * 날짜별로 솎아 냅니다.
     *
     * <p>전체를 한 줄로 이어 솎으면 곳이 많은 날이 자리를 다 가져가고 짧은
     * 날은 통째로 사라집니다. 날마다 <b>제 몫만큼</b> 남기되, 어느 날도
     * 두 곳 밑으로는 안 내려가게 합니다 — 한 곳만 남으면 그 날은 선이 아니라
     * 점 하나가 됩니다.
     */
    private static List<List<Point>> thinDays(List<List<Point>> days) {
        List<List<Point>> live = new ArrayList<>();
        for (List<Point> day : days) {
            if (day != null && !day.isEmpty()) {
                live.add(day);
            }
        }
        if (live.isEmpty()) {
            return List.of();
        }
        int total = live.stream().mapToInt(List::size).sum();
        if (total <= MAX_POINTS) {
            return live;
        }
        List<List<Point>> out = new ArrayList<>(live.size());
        for (List<Point> day : live) {
            int room = Math.max(2, (int) Math.round(MAX_POINTS * (day.size() / (double) total)));
            out.add(thin(day, room));
        }
        return out;
    }

    private static String cacheKey(List<List<Point>> days, int width, int height) {
        StringBuilder id = new StringBuilder(width + "x" + height);
        for (List<Point> day : days) {
            /* 날 사이를 갈라 둡니다. 안 그러면 [[a],[b]] 와 [[a,b]] 가 같은
               열쇠가 되어, 색이 다른 두 그림 중 먼저 그린 것이 돌아옵니다. */
            id.append("|-");
            for (Point p : day) {
                id.append(String.format(Locale.ROOT, "|%.5f,%.5f", p.lat(), p.lng()));
            }
        }
        return id.toString();
    }

    public record Point(double lat, double lng) {
    }

    private record Cached(byte[] png, Instant until) {
    }
}
