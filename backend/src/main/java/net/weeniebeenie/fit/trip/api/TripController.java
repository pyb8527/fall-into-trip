package net.weeniebeenie.fit.trip.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.api.dto.TripDtos;
import net.weeniebeenie.fit.trip.api.dto.TripDtos.*;
import net.weeniebeenie.fit.trip.application.TripQueryService;
import net.weeniebeenie.fit.trip.application.TripService;
import net.weeniebeenie.fit.trip.domain.Trip;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TripController {

    private final TripService trips;
    private final TripQueryService query;
    private final ObjectMapper mapper;

    /** 내가 볼 수 있는 여행 목록. */
    @GetMapping("/trips")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me) {
        return Map.of("trips", trips.listFor(me).stream().map(TripSummaryView::of).toList());
    }

    @PostMapping("/trips")
    public Map<String, Object> create(@CurrentUser AuthPrincipal me,
                                      @Valid @RequestBody CreateTripRequest req) {
        Trip trip = trips.create(me, req.title(), req.startIso(), req.nightsOrZero());
        return Map.of("trip", TripView.of(trip));
    }

    @PatchMapping("/trips/{id}")
    public Map<String, Object> update(@CurrentUser AuthPrincipal me,
                                      @PathVariable String id,
                                      @RequestBody UpdateTripRequest req) {
        trips.update(me, id, req.title(), req.startIso());
        return Map.of("ok", true);
    }

    @DeleteMapping("/trips/{id}")
    public Map<String, Object> delete(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        trips.delete(me, id);
        return Map.of("ok", true);
    }

    /**
     * 일정 화면이 쓰는 전부 — 여행·날짜·장소·내가 다녀온 곳.
     *
     * trip 을 생략하면 가장 먼저 만든 여행을 봅니다.
     */
    @GetMapping("/trip")
    public Map<String, Object> detail(@CurrentUser AuthPrincipal me,
                                      @RequestParam(name = "trip", required = false) String tripId) {
        TripQueryService.TripDetail d = query.detail(me, tripId);
        List<DayView> days = d.days().stream()
                .map(day -> TripDtos.dayView(day,
                        d.placesByDay().getOrDefault(day.getId(), List.of()), mapper))
                .toList();

        return Map.of(
                "trip", TripView.of(d.trip()),
                "days", days,
                "visited", d.visitedPlaceIds(),
                "myRole", d.myRole() == null ? "NONE" : d.myRole().name());
    }
}
