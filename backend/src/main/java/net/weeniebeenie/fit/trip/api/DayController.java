package net.weeniebeenie.fit.trip.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.api.dto.TripDtos;
import net.weeniebeenie.fit.trip.api.dto.TripDtos.*;
import net.weeniebeenie.fit.trip.application.DayService;
import net.weeniebeenie.fit.trip.domain.Day;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/days")
@RequiredArgsConstructor
public class DayController {

    private final DayService days;
    private final ObjectMapper mapper;

    @PostMapping
    public Map<String, Object> append(@CurrentUser AuthPrincipal me,
                                      @Valid @RequestBody CreateDayRequest req) {
        Day day = days.append(me, req.tripId(), req.iso(), req.label(), req.shortName());
        return Map.of("day", TripDtos.dayView(day, List.of(), mapper));
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@CurrentUser AuthPrincipal me,
                                      @PathVariable String id,
                                      @RequestBody UpdateDayRequest req) {
        Day day = days.update(me, id, new DayService.DayPatch(
                req.label(), req.shortName(), req.iso(),
                req.theme(), req.color(), req.budget(), req.flight(),
                req.stayName(), req.stayLat(), req.stayLng(),
                req.stayPlaceId(), req.stayNote(), req.stayForward(),
                req.version()));
        return Map.of("day", TripDtos.dayView(day, List.of(), mapper));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        days.delete(me, id);
        return Map.of("ok", true);
    }
}
