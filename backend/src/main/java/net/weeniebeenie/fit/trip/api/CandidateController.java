package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.CandidateService;
import net.weeniebeenie.fit.trip.application.CandidateService.Draft;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 가고 싶은 곳 후보와 투표.
 *
 * <p>일정에 바로 넣으면 아직 정하지도 않은 것이 확정처럼 보입니다. 후보로
 * 올려 두고 각자 좋아요를 누른 뒤, 다 좋다고 한 것만 옮깁니다.
 */
@RestController
@RequiredArgsConstructor
public class CandidateController {

    private final CandidateService candidates;

    @GetMapping("/api/trips/{tripId}/candidates")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        return Map.of("candidates", candidates.listOf(me, tripId));
    }

    @PostMapping("/api/trips/{tripId}/candidates")
    public Map<String, Object> add(@CurrentUser AuthPrincipal me,
                                   @PathVariable String tripId,
                                   @RequestBody Draft draft) {
        return Map.of("id", candidates.add(me, tripId, draft).getId());
    }

    /**
     * 표를 던지거나 거둡니다.
     *
     * @param req yes 를 비우면 던진 표를 거둡니다. 싫다고 한 것과 다릅니다.
     */
    @PutMapping("/api/candidates/{candidateId}/vote")
    public Map<String, Object> vote(@CurrentUser AuthPrincipal me,
                                    @PathVariable String candidateId,
                                    @RequestBody(required = false) VoteRequest req) {
        candidates.vote(me, candidateId, req == null ? null : req.yes());
        return Map.of("ok", true);
    }

    @DeleteMapping("/api/candidates/{candidateId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me,
                                      @PathVariable String candidateId) {
        candidates.remove(me, candidateId);
        return Map.of("ok", true);
    }

    /** 정해진 후보를 일정으로 옮깁니다. 후보 쪽에서는 사라집니다. */
    @PostMapping("/api/days/{dayId}/places/from-candidates")
    public Map<String, Object> pour(@CurrentUser AuthPrincipal me,
                                    @PathVariable String dayId,
                                    @RequestBody PourRequest req) {
        return Map.of("added", candidates.pour(me, dayId, req == null ? null : req.candidateIds()));
    }

    public record VoteRequest(Boolean yes) {
    }

    public record PourRequest(List<String> candidateIds) {
    }
}
