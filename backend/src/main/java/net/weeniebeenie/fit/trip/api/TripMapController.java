package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.StaticMapService;
import net.weeniebeenie.fit.trip.application.StaticMapService.Point;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 내 여행의 동선을 한 장의 그림으로.
 *
 * <h3>왜 이것이 필요한가</h3>
 *
 * <p>일정 화면의 지도는 살아 있는 지도(Google Maps JS·SDK)입니다. 손으로
 * 끌고 넓힐 수 있어 짤 때는 그편이 낫지만, <b>데이터가 안 터지면 아무것도
 * 안 뜹니다.</b> 그 자리에 남는 것은 회색 바탕뿐입니다.
 *
 * <p>일정 자체는 이미 기기에 담아 두고 있습니다(lib/keep). 장소 이름과
 * 시각은 안 터져도 보이는데, 정작 "오늘 이 동네를 이렇게 돈다" 는 그림만
 * 사라졌습니다. 그림은 담을 수가 없었기 때문입니다 — 살아 있는 지도는
 * 그릴 때마다 구글을 부릅니다.
 *
 * <p>한 장짜리 그림이면 담을 수 있습니다. 올라온 글에는 이미 있던 것이고
 * (PostMapController), 같은 서비스를 그대로 씁니다.
 *
 * <h3>남의 여행은 안 됩니다</h3>
 *
 * <p>글의 동선 그림은 로그인 없이 열립니다 — 이미 공개된 것이라서입니다.
 * 이쪽은 반대입니다. 여행은 부른 사람들만 봅니다. 그림 한 장이라도 어느
 * 동네를 도는지가 드러나므로 같은 문을 지나게 합니다.
 */
@RestController
@RequiredArgsConstructor
public class TripMapController {

    private final TripAccessPolicy access;
    private final DayRepository days;
    private final PlaceRepository places;
    private final StaticMapService maps;

    @GetMapping(value = "/api/trips/{tripId}/map", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> map(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        access.requireCanRead(tripId, me.id());

        List<Day> ordered = days.findAllByTripIdOrderBySortAsc(tripId);
        Map<String, List<Place>> byDay = places
                .findAllByDayIdIn(ordered.stream().map(Day::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(Place::getDayId));

        /* 날짜 순서로, 그 안에서는 적어 둔 순서로. 여행 전체를 한 번에 묶어
           부르는 길이 있지만 그쪽은 날짜를 가로질러 섞이므로 쓰지 않습니다. */
        List<Point> points = new ArrayList<>();
        for (Day day : ordered) {
            byDay.getOrDefault(day.getId(), List.of()).stream()
                    .sorted(Comparator.comparingInt(Place::getSort))
                    .forEach(p -> points.add(new Point(p.getLat(), p.getLng())));
        }

        byte[] png = maps.render(points, 600, 320);
        return ResponseEntity.ok()
                /*
                  남의 캐시에 얹히면 안 되는 그림입니다. 여행은 부른 사람들만
                  보는 것이라, 중간에 있는 캐시가 들고 있다가 다른 사람에게
                  내주면 그대로 새는 것이 됩니다.

                  브라우저에는 잠깐 두게 합니다. 화면이 이것을 받아 기기에
                  따로 담아 두므로 길게 잡을 이유가 없습니다.
                */
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePrivate())
                .body(png);
    }
}
