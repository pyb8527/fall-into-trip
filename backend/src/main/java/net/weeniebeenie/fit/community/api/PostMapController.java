package net.weeniebeenie.fit.community.api;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.community.application.PostService;
import net.weeniebeenie.fit.trip.application.StaticMapService;
import net.weeniebeenie.fit.trip.application.StaticMapService.Point;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * 올라온 일정의 동선을 한 장의 그림으로.
 *
 * <p>목록에서 글마다 살아 있는 지도를 얹으면 화면이 무거워지고, 무엇보다
 * 브라우저에 키가 나가야 합니다. 서버가 그림을 대신 받아 우리 주소로만
 * 내보냅니다.
 *
 * <p>글은 로그인 없이도 볼 수 있으므로 이 그림도 그렇습니다.
 */
@RestController
@RequiredArgsConstructor
public class PostMapController {

    private final PostService posts;
    private final StaticMapService maps;

    @GetMapping(value = "/api/posts/{postId}/map", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> map(@PathVariable String postId) {
        JsonNode snapshot = posts.snapshotOf(posts.read(postId));

        List<Point> points = new ArrayList<>();
        for (JsonNode day : snapshot.path("days")) {
            for (JsonNode place : day.path("places")) {
                if (place.hasNonNull("lat") && place.hasNonNull("lng")) {
                    points.add(new Point(place.path("lat").asDouble(), place.path("lng").asDouble()));
                }
            }
        }

        byte[] png = maps.render(points, 600, 320);
        return ResponseEntity.ok()
                /* 글의 일정은 사본이라 바뀌지 않습니다. 브라우저가 오래 들고
                   있어도 틀린 그림을 보여 줄 일이 없습니다. */
                .cacheControl(CacheControl.maxAge(Duration.ofHours(6)).cachePublic())
                .body(png);
    }
}
