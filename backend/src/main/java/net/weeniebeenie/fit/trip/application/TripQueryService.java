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
                visits.visitedPlaceIds(me.id(), trip.getId()),
                access.roleOf(trip.getId(), me.id()));
    }

    public record TripDetail(Trip trip, List<Day> days, Map<String, List<Place>> placesByDay,
                             List<String> visitedPlaceIds, TripRole myRole) {
    }
}
