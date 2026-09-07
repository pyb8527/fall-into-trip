package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.VisitService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 다녀온 곳 표시. 사람마다 따로 남습니다. */
@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
public class VisitController {

    private final VisitService visits;

    @PutMapping("/{placeId}")
    public Map<String, Object> mark(@CurrentUser AuthPrincipal me, @PathVariable String placeId) {
        visits.mark(me, placeId);
        return Map.of("ok", true, "visited", true);
    }

    @DeleteMapping("/{placeId}")
    public Map<String, Object> unmark(@CurrentUser AuthPrincipal me, @PathVariable String placeId) {
        visits.unmark(me, placeId);
        return Map.of("ok", true, "visited", false);
    }
}
