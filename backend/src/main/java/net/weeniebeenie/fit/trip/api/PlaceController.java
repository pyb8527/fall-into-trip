package net.weeniebeenie.fit.trip.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.api.dto.TripDtos;
import net.weeniebeenie.fit.trip.api.dto.TripDtos.ReorderRequest;
import net.weeniebeenie.fit.trip.application.PlaceSearchService;
import net.weeniebeenie.fit.trip.application.PlaceService;
import net.weeniebeenie.fit.trip.application.PlaceService.PlaceDraft;
import net.weeniebeenie.fit.trip.application.RouteService;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.RouteTidy;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
public class PlaceController {

    private final PlaceService places;
    private final PlaceSearchService search;
    private final RouteService routes;
    private final ObjectMapper mapper;

    /**
     * 이름으로 장소 찾기.
     *
     * 좌표를 손으로 적게 두면 지도를 따로 켜서 숫자를 옮겨 적어야 하고, 한
     * 자리 틀리면 엉뚱한 나라에 점이 찍힙니다. 서버가 구글에 대신 물어보고
     * 이름·주소·좌표만 돌려줍니다. 키는 서버에만 있습니다.
     */
    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(name = "q") String query) {
        return Map.of("places", search.search(query));
    }

    /**
     * 지금 있는 자리에서 이 장소까지 얼마나 걸리는지.
     *
     * <p>좌표를 주소가 아니라 <b>본문</b>으로 받습니다. 쿼리스트링은 nginx 접근
     * 기록과 브라우저 방문 기록에 그대로 남는데, 사람이 지금 어디 있는지는
     * 거기 남겨 둘 값이 아닙니다.
     */
    @PostMapping("/{placeId}/route")
    public Map<String, Object> fromHere(@CurrentUser AuthPrincipal me,
                                        @PathVariable String placeId,
                                        @RequestBody HereRequest req) {
        if (req == null || req.lat() == null || req.lng() == null) {
            throw ApiException.badRequest("지금 위치를 알 수 없습니다.");
        }
        RouteService.Mode mode;
        try {
            mode = RouteService.Mode.valueOf(
                    (req.mode() == null ? "TRANSIT" : req.mode()).trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("알 수 없는 이동 수단입니다.");
        }
        return Map.of("leg", routes.fromHere(me, placeId, req.lat(), req.lng(), mode));
    }

    /** 지금 서 있는 자리. 저장하지 않고 이 요청에만 씁니다. */
    public record HereRequest(Double lat, Double lng, String mode) {
    }

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

    /**
     * 이 날을 이렇게 돌면 덜 걷는다는 제안.
     *
     * <p>보기만 합니다. 받아들이면 화면이 아래 reorder 로 저장합니다.
     */
    @GetMapping("/tidy")
    public Map<String, Object> tidy(@CurrentUser AuthPrincipal me, @RequestParam String dayId) {
        RouteTidy.Tidied made = places.tidy(me, dayId);
        return Map.of(
                "placeIds", made.order().stream().map(Place::getId).toList(),
                /* 미터로 내보냅니다. "3.2km" 같은 꾸밈은 화면이 합니다 —
                   나라마다 부르는 단위가 다릅니다. */
                "beforeMeters", Math.round(made.beforeMeters()),
                "afterMeters", Math.round(made.afterMeters()),
                "worthIt", made.worthIt());
    }

    @PostMapping("/reorder")
    public Map<String, Object> reorder(@CurrentUser AuthPrincipal me,
                                       @Valid @RequestBody ReorderRequest req) {
        places.reorder(me, req.dayId(), req.placeIds());
        return Map.of("ok", true);
    }
}
