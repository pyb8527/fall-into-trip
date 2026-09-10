package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.TripItemService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 챙길 것.
 *
 * <p>동행자면 누구나 적고, 맡고, 체크할 수 있습니다. 맡은 사람만 체크하게
 * 하면 "내 것 체크 좀 해 줘" 를 부탁하게 됩니다.
 */
@RestController
@RequiredArgsConstructor
public class TripItemController {

    private final TripItemService items;

    @GetMapping("/api/trips/{tripId}/items")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        return Map.of("items", items.listOf(me, tripId));
    }

    @PostMapping("/api/trips/{tripId}/items")
    public Map<String, Object> add(@CurrentUser AuthPrincipal me,
                                   @PathVariable String tripId,
                                   @RequestBody Draft draft) {
        return Map.of("id", items.add(me, tripId, draft.name(), draft.ownerId()).getId());
    }

    @PatchMapping("/api/items/{itemId}")
    public Map<String, Object> update(@CurrentUser AuthPrincipal me,
                                      @PathVariable String itemId,
                                      @RequestBody Draft draft) {
        items.update(me, itemId, draft.done(), draft.ownerId());
        return Map.of("ok", true);
    }

    @DeleteMapping("/api/items/{itemId}")
    public Map<String, Object> delete(@CurrentUser AuthPrincipal me, @PathVariable String itemId) {
        items.delete(me, itemId);
        return Map.of("ok", true);
    }

    /** @param ownerId 빈 문자열이면 "아무도 안 맡음" 으로 되돌립니다. */
    public record Draft(String name, String ownerId, Boolean done) {
    }
}
