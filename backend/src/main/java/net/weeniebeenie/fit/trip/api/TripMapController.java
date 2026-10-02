package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.application.StaticMapService;
import net.weeniebeenie.fit.trip.application.StaticMapService.Point;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayLabels;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.LocalDate;
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
 * <h3>하루만 그리는 길이 같은 주소에 있습니다</h3>
 *
 * <p>달력에서 날을 누르면 그날 동선이 필요합니다. 주소를 따로 내지 않고
 * {@code ?date=2026-10-08} 한 칸을 받습니다 — 길을 하나 더 내면 「부른
 * 사람만」을 보는 줄과 캐시 머리글을 <b>두 군데에 똑같이</b> 적게 되고,
 * 한쪽을 고칠 때 다른 쪽이 남습니다. 돌려주는 것도 같은 PNG 입니다.
 *
 * <p>번호(dayId)가 아니라 날짜로 받습니다. 누르는 쪽은 달력이고 달력이 아는
 * 것은 날짜뿐입니다 — 번호로 받으면 화면이 그림 한 장마다 일정을 먼저 받아
 * 번호를 찾아야 하고, 그것은 왕복 하나를 둘로 늘리는 일입니다.
 *
 * <h3>돈이 드는 쪽을 기본값으로 두지 않습니다</h3>
 *
 * <p>그림 한 장이 구글 Static Maps 한 번입니다. 달력은 한 달에 서른 칸이라
 * 칸마다 그림을 달면 달을 넘길 때마다 서른 번입니다. 그래서 <b>부르는 쪽이
 * 누른 날 하나만</b> 묻게 두었습니다(trip-calendar.tsx). 서버는 미리 그려
 * 두지도, 옆날을 끼워 주지도 않습니다.
 *
 * <p>그릴 곳이 없는 날은 400 입니다. 구글을 부르기 전에 걸러지므로 빈 날을
 * 눌러도 요금이 붙지 않습니다({@link StaticMapService}). 곳이 하나뿐인 날은
 * 선 없이 핀 하나를 그립니다 — 「이날 여기 하나」도 보여 줄 값이 있습니다.
 *
 * <h3>남의 여행은 안 됩니다</h3>
 *
 * <p>글의 동선 그림은 로그인 없이 열립니다 — 이미 공개된 것이라서입니다.
 * 이쪽은 반대입니다. 여행은 부른 사람들만 봅니다. 그림 한 장이라도 어느
 * 동네를 도는지가 드러나므로 같은 문을 지나게 합니다. 하루 그림도 같은
 * 줄을 지납니다 — 하루라고 덜 드러나는 것이 아닙니다.
 */
@RestController
@RequiredArgsConstructor
public class TripMapController {

    /*
      그림 크기.

      <p>하루 그림도 같은 크기입니다. 비율이 다르면 달력 아래의 그림과 글
      목록 썸네일이 서로 다른 것으로 읽히고, 들고 있는 그림의 열쇠도 크기마다
      갈라져 같은 동선을 두 번 받아 오게 됩니다.
    */
    private static final int W = 600;
    private static final int H = 320;

    private final TripAccessPolicy access;
    private final DayRepository days;
    private final PlaceRepository places;
    private final StaticMapService maps;

    @GetMapping(value = "/api/trips/{tripId}/map", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> map(@CurrentUser AuthPrincipal me,
                                      @PathVariable String tripId,
                                      /* 없으면 여행 전체입니다. 지금까지 부르던 자리들이
                                         그대로 돕니다. */
                                      @RequestParam(required = false) String date) {
        access.requireCanRead(tripId, me.id());

        List<Day> ordered = days.findAllByTripIdOrderBySortAsc(tripId);
        Map<String, List<Place>> byDay = places
                .findAllByDayIdIn(ordered.stream().map(Day::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(Place::getDayId));

        /* 날짜 순서로, 그 안에서는 적어 둔 순서로. 여행 전체를 한 번에 묶어
           부르는 길이 있지만 그쪽은 날짜를 가로질러 섞이므로 쓰지 않습니다.

           날짜를 묶어 둔 채로 넘깁니다. 한 줄로 이어 붙이면 닷새치가 한 색
           실뭉치가 되어, 어디가 첫날인지 알 수 없습니다. */
        List<DayRoute> rows = new ArrayList<>();
        for (Day day : ordered) {
            List<Point> one = new ArrayList<>();
            byDay.getOrDefault(day.getId(), List.of()).stream()
                    .sorted(Comparator.comparingInt(Place::getSort))
                    .forEach(p -> one.add(new Point(p.getLat(), p.getLng())));
            rows.add(new DayRoute(day.getIso(), one));
        }

        byte[] png = date == null || date.isBlank()
                ? maps.renderDays(rows.stream().map(DayRoute::points).toList(), W, H)
                : oneDay(rows, DayLabels.parse(date));

        return ResponseEntity.ok()
                /*
                  남의 캐시에 얹히면 안 되는 그림입니다. 여행은 부른 사람들만
                  보는 것이라, 중간에 있는 캐시가 들고 있다가 다른 사람에게
                  내주면 그대로 새는 것이 됩니다.

                  브라우저에는 잠깐 두게 합니다. 화면이 이것을 받아 기기에
                  따로 담아 두므로 길게 잡을 이유가 없습니다.

                  하루 그림도 같은 머리글입니다. 같은 날을 다시 누르면 이
                  십 분 안에는 서버까지도 안 옵니다 — 달력에서 날을 몇 번씩
                  왕복하는 것이 흔한 일이라, 그 왕복이 곧 요금이 되면 안
                  됩니다.
                */
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePrivate())
                .body(png);
    }

    /** 그 하루만. 색은 여행 전체 그림에서 그날이 쓰던 그 색입니다. */
    private byte[] oneDay(List<DayRoute> rows, LocalDate on) {
        OneDay one = onlyOn(rows, on);
        if (one == null) {
            /* 여행 전체가 비었을 때 서비스가 하는 말과 같은 자리입니다. 다만
               어느 쪽이 빈 것인지는 가려 적습니다 — 「그릴 곳이 없어요」만
               돌려주면 여행에 곳이 하나도 없는 것인지 이 날만 빈 것인지
               알 수 없습니다. */
            throw ApiException.badRequest("이날은 그릴 곳이 없어요.");
        }
        return maps.renderDays(List.of(one.points()), one.color(), W, H);
    }

    /**
     * 그 날짜의 동선과 색을 찾습니다. 없으면 {@code null}.
     *
     * <h3>색을 왜 세어야 하는가</h3>
     *
     * <p>여행 전체 그림은 <b>곳이 있는 날만</b> 세어 색을 돌립니다
     * ({@code thinDays} 가 빈 날을 걷어 냅니다). 그래서 둘째 날이 비어 있는
     * 여행의 셋째 날 색은 세 번째가 아니라 두 번째입니다. 여기서도 똑같이
     * 세지 않으면 달력에서 본 색과 여행 전체 그림의 그 날 색이 어긋납니다.
     *
     * <p>같은 날짜가 두 번 달려 있어도(날을 끼워 넣다 보면 생깁니다) 곳이
     * 있는 첫 번째 것을 그립니다. 둘을 겹쳐 그리면 한 날에 두 색이 되어
     * 「이게 며칠째지」가 됩니다.
     */
    static OneDay onlyOn(List<DayRoute> rows, LocalDate on) {
        int color = 0;
        for (DayRoute row : rows) {
            if (row.points().isEmpty()) {
                continue;
            }
            if (on.equals(row.iso())) {
                return new OneDay(row.points(), color);
            }
            color++;
        }
        return null;
    }

    /**
     * 하루에 달린 곳들.
     *
     * @param iso 날짜를 아직 안 정한 날은 비어 있습니다 — 그 날은 달력에
     *            올라가지 않으므로 날짜로 찾을 수도 없습니다
     */
    record DayRoute(LocalDate iso, List<Point> points) {
    }

    /** 그릴 하루 — 곳들과, 몇 번째 색으로 그릴 것인가. */
    record OneDay(List<Point> points, int color) {
    }
}
