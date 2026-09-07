package net.weeniebeenie.fit.trip.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.api.dto.TripDtos;
import net.weeniebeenie.fit.trip.api.dto.TripDtos.ReorderRequest;
import net.weeniebeenie.fit.trip.application.PlaceService;
import net.weeniebeenie.fit.trip.application.PlaceService.PlaceDraft;
import net.weeniebeenie.fit.trip.domain.Place;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
public class PlaceController {

    private final PlaceService places;
    private final ObjectMapper mapper;

    @PostMapping
    public Map<String, Object> create(@CurrentUser AuthPrincipal me,
                                      @RequestBody PlaceDraft draft) {
        if (draft.dayId() == null || draft.dayId().isBlank()) {
            throw ApiException.badRequest("어느 날짜에 넣을지 알려 주세요.");
        }
        Place place = places.create(me, draft.dayId(), draft);
        return Map.of("place", TripDtos.placeView(place, mapper));
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@CurrentUser AuthPrincipal me,
                                      @PathVariable String id,
                                      @RequestBody PlaceDraft draft) {
        Place place = places.update(me, id, draft);
        return Map.of("place", TripDtos.placeView(place, mapper));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        places.delete(me, id);
        return Map.of("ok", true);
    }

    @PostMapping("/reorder")
    public Map<String, Object> reorder(@CurrentUser AuthPrincipal me,
                                       @Valid @RequestBody ReorderRequest req) {
        places.reorder(me, req.dayId(), req.placeIds());
        return Map.of("ok", true);
    }
}
