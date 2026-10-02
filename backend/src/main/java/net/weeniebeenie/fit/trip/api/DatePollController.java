package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.DatePollService;
import net.weeniebeenie.fit.trip.domain.DateChoice;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 언제 갈까.
 *
 * <p>새 화면이 아닙니다 — 모임 달력과 여행 화면의 판 하나가 이 길을
 * 씁니다. 규칙은 {@link DatePollService}.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DatePollController {

    private final DatePollService polls;

    @GetMapping("/trips/{id}/dates")
    public DatePollService.Poll poll(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return polls.pollOf(me, id);
    }

    @PostMapping("/trips/{id}/dates")
    public Map<String, Object> propose(@CurrentUser AuthPrincipal me, @PathVariable String id,
                                       @RequestBody ProposeBody body) {
        polls.propose(me, id, body.startIso(), body.nights());
        return Map.of("ok", true);
    }

    @DeleteMapping("/trips/{id}/dates/{optionId}")
    public Map<String, Object> withdraw(@CurrentUser AuthPrincipal me, @PathVariable String id,
                                        @PathVariable String optionId) {
        polls.withdraw(me, id, optionId);
        return Map.of("ok", true);
    }

    @PutMapping("/trips/{id}/dates/{optionId}/answer")
    public Map<String, Object> answer(@CurrentUser AuthPrincipal me, @PathVariable String id,
                                      @PathVariable String optionId,
                                      @RequestBody(required = false) AnswerBody body) {
        polls.answer(me, id, optionId, body == null ? null : body.answer());
        return Map.of("ok", true);
    }

    @PostMapping("/trips/{id}/dates/{optionId}/confirm")
    public Map<String, Object> confirm(@CurrentUser AuthPrincipal me, @PathVariable String id,
                                       @PathVariable String optionId) {
        polls.confirm(me, id, optionId);
        return Map.of("ok", true);
    }

    /** 모임 달력의 빗금 칸들. */
    @GetMapping("/groups/{id}/dates")
    public Map<String, Object> ofGroup(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return Map.of("options", polls.openOfGroup(me, id));
    }

    public record ProposeBody(String startIso, Integer nights) {
    }

    /** @param answer YES · IF_NEED · NO. 비우면 답을 거둡니다 */
    public record AnswerBody(DateChoice answer) {
    }
}
