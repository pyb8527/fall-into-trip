package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.application.StaticMapService;
import net.weeniebeenie.fit.trip.application.StaticMapService.Point;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * 한 자리를 그린 지도 그림.
 *
 * <h3>왜 살아 있는 지도를 안 쓰는가</h3>
 *
 * <p>장소 상세 판에 상호작용 지도를 띄우고 있었습니다. 그런데 거기 지도는
 * 누를 것도 이을 것도 없는 <b>그림 한 장</b>입니다 — 어디쯤인지만 보여 주면
 * 되는 자리인데, 판을 열 때마다 구글에 지도 한 장을 새로 띄웠습니다.
 *
 * <p>Maps JavaScript 는 <b>지도가 뜰 때마다</b> 셉니다. 혼자 쓰는데도 그
 * 숫자가 하루 할당량의 20%였고, 그중 상당수가 이 판이었습니다. 게다가 지도
 * 로딩은 우리가 캐시할 수 있는 것이 아닙니다.
 *
 * <p>그림으로 바꾸면 서버가 받아서 내보내고, 우리가 여섯 시간 들고 있습니다
 * (StaticMapService). 같은 장소를 다시 열면 구글에 아예 안 나갑니다.
 *
 * <h3>로그인 없이도 봅니다</h3>
 *
 * <p>둘러보기와 지금 뜨는 여행지에서도 이 판이 열립니다. 둘 다 계정 없이
 * 볼 수 있는 자리라 여기도 그래야 합니다. 좌표는 비밀이 아니고, 구글 키는
 * 서버에만 있으므로 밖으로 나가지 않습니다.
 */
@RestController
@RequiredArgsConstructor
public class SpotMapController {

    private final StaticMapService maps;

    /**
     * 한 점짜리 지도.
     *
     * <p>크기는 우리가 정합니다. 밖에서 아무 숫자나 받으면 같은 자리를 넓이
     * 마다 따로 받아 와야 해서, 캐시가 그만큼 잘게 쪼개집니다.
     */
    @GetMapping(value = "/api/maps/spot", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> spot(@RequestParam double lat, @RequestParam double lng) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw ApiException.badRequest("좌표가 올바르지 않아요.");
        }

        byte[] png = maps.render(List.of(new Point(lat, lng)), 600, 320);
        return ResponseEntity.ok()
                /* 한 자리의 지도는 안 바뀝니다. 브라우저가 오래 들고 있어도
                   틀린 그림을 보여 줄 일이 없습니다. */
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .body(png);
    }
}
