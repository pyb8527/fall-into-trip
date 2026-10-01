package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 화면 하나를 그리는 데 필요한 것을 한 번에 모아 줍니다.
 *
 * 일정 화면은 날짜와 장소를 함께 보여 주므로, 나눠서 부르면 왕복이 늘고 그
 * 사이에 다른 사람이 고치면 앞뒤가 안 맞는 화면이 나옵니다.
 */
@Service
@RequiredArgsConstructor
public class TripQueryService {

    private final TripService trips;
    private final DayRepository days;
    private final PlaceRepository places;
    private final VisitService visits;
    private final TripAccessPolicy access;

    @Transactional(readOnly = true)
    public TripDetail detail(AuthPrincipal me, String tripId) {
        Trip trip = trips.resolveFor(me, tripId);
        access.requireCanRead(trip.getId(), me.id());

        List<Day> dayList = days.findAllByTripIdOrderBySortAsc(trip.getId());
        Map<String, List<Place>> byDay = places.findAllOfTrip(trip.getId()).stream()
                .collect(Collectors.groupingBy(Place::getDayId));

        return new TripDetail(
                trip,
                dayList,
                byDay,
                /* 다니면서 볼 사진. 여행의 것이라 누가 보든 같습니다. */
                visits.photosOfTrip(trip.getId()),
                trip.getOwnerId().equals(me.id()));
    }

    /**
     * @param owner 내가 만든 여행인지. 지우기와 모임 옮기기가 여기에 걸립니다.
     *              <p>고치기는 안 걸립니다 — 볼 수 있으면 고칠 수 있습니다.
     *              모임에 구경꾼을 두지 않기로 했기 때문입니다.
     */
    public record TripDetail(Trip trip, List<Day> days, Map<String, List<Place>> placesByDay,
                             /** 장소마다 챙겨 둔 사진들. 다니면서 볼 것입니다. */
                             List<net.weeniebeenie.fit.trip.domain.PlacePhoto> photos,
                             boolean owner) {
    }
}
