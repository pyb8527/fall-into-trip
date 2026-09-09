package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.SavedPlaceService;
import net.weeniebeenie.fit.trip.application.SavedPlaceService.Draft;
import net.weeniebeenie.fit.trip.domain.SavedPlace;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 보관함 — 나중에 쓰려고 담아 둔 장소.
 *
 * <p>남의 일정에서, 검색에서, 지도에서 눈에 띄는 곳을 담았다가 내 일정
 * 아무 날에나 꺼내 넣습니다.
 */
@RestController
@RequiredArgsConstructor
public class SavedPlaceController {

    private final SavedPlaceService saved;

    @GetMapping("/api/saved")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me) {
        return Map.of("places", saved.listOf(me).stream().map(View::of).toList());
    }

    @PostMapping("/api/saved")
    public Map<String, Object> save(@CurrentUser AuthPrincipal me, @RequestBody Draft draft) {
        return Map.of("place", View.of(saved.save(me, draft)));
    }

    /**
     * 담아 둔 곳의 그림을 바꿉니다.
     *
     * <p>담을 때는 구글 갈래로 짐작해 찍어 둡니다. 대개 맞지만 틀릴 때가
     * 있고, 무엇보다 "이건 나한테 온천이 아니라 사진 찍을 곳" 처럼 쓰는 사람이
     * 달리 보고 싶을 수 있습니다. 지우고 다시 담게 하지 않습니다.
     */
    @PatchMapping("/api/saved/{savedId}")
    public Map<String, Object> retag(@CurrentUser AuthPrincipal me,
                                     @PathVariable String savedId,
                                     @RequestBody IconRequest req) {
        return Map.of("place",
                View.of(saved.retag(me, savedId, req == null ? null : req.icon())));
    }

    /** 빈 문자열은 "그림 빼기" 입니다. */
    public record IconRequest(String icon) {
    }

    @DeleteMapping("/api/saved/{savedId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me, @PathVariable String savedId) {
        saved.remove(me, savedId);
        return Map.of("ok", true);
    }

    /**
     * 담아 둔 것을 하루에 넣습니다.
     *
     * <p>보관함에서는 지우지 않습니다. 같은 곳을 여러 여행에 넣을 수 있고,
     * 넣었다고 사라지면 다시 찾아야 합니다.
     */
    @PostMapping("/api/days/{dayId}/places/from-saved")
    public Map<String, Object> pour(@CurrentUser AuthPrincipal me,
                                    @PathVariable String dayId,
                                    @RequestBody PourRequest req) {
        int added = saved.pour(me, dayId, req == null ? null : req.savedIds()).size();
        return Map.of("added", added);
    }

    public record PourRequest(List<String> savedIds) {
    }

    record View(String id, String name, double lat, double lng, String placeId,
                String cat, String icon, String note, String fromPost, Instant createdAt) {

        static View of(SavedPlace p) {
            return new View(p.getId(), p.getName(), p.getLat(), p.getLng(), p.getPlaceId(),
                    p.getCat(), p.getIcon(), p.getNote(), p.getFromPost(), p.getCreatedAt());
        }
    }
}
