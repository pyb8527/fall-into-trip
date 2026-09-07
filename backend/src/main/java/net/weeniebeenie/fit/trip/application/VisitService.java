package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 다녀온 곳 표시.
 *
 * 이건 사람마다 따로 남습니다. 같은 여행을 가도 누구는 들르고 누구는 지나칠
 * 수 있으니, 한 사람이 체크했다고 모두에게 칠해지면 안 됩니다.
 */
@Service
@RequiredArgsConstructor
public class VisitService {

    private final VisitRepository visits;
    private final PlaceRepository places;
    private final DayRepository days;
    private final TripAccessPolicy access;

    @Transactional(readOnly = true)
    public List<String> visitedPlaceIds(String userId, String tripId) {
        return visits.findPlaceIdsOfTrip(userId, tripId);
    }

    @Transactional
    public void mark(AuthPrincipal me, String placeId) {
        requireReadable(me, placeId);
        VisitId id = new VisitId(me.id(), placeId);
        if (!visits.existsById(id)) {
            visits.save(new Visit(me.id(), placeId));
        }
    }

    @Transactional
    public void unmark(AuthPrincipal me, String placeId) {
        requireReadable(me, placeId);
        visits.deleteById(new VisitId(me.id(), placeId));
    }

    /** 볼 수 있는 여행의 장소여야 체크할 수 있습니다. */
    private void requireReadable(AuthPrincipal me, String placeId) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없습니다."));
        Day day = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanRead(day.getTripId(), me.id());
    }
}
