package net.weeniebeenie.fit.safety.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.safety.application.BlockService;
import net.weeniebeenie.fit.safety.application.ProfileReportService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 사람을 막고, 사람을 신고하는 길.
 *
 * <p>글을 신고하는 길은 글마다 따로 있습니다({@code /api/posts/{id}/report},
 * {@code /api/feed/{id}/report} …). 여기는 <b>사람</b>에 대한 것입니다 —
 * 프로필(이름 · 소개 · 사진)을 신고하고, 사람을 막습니다.
 *
 * <p>다 로그인해야 합니다. 누가 막았는지, 누가 신고했는지를 세야 합니다.
 */
@RestController
@RequiredArgsConstructor
public class SafetyController {

    private final BlockService blocks;
    private final ProfileReportService reports;

    @PostMapping("/api/users/{userId}/block")
    public Map<String, Object> block(@CurrentUser AuthPrincipal me, @PathVariable String userId) {
        blocks.block(me, userId);
        return Map.of("ok", true);
    }

    @DeleteMapping("/api/users/{userId}/block")
    public Map<String, Object> unblock(@CurrentUser AuthPrincipal me, @PathVariable String userId) {
        blocks.unblock(me, userId);
        return Map.of("ok", true);
    }

    /** 내가 막은 사람들. 막힌 사람 쪽에는 이런 목록이 없습니다 — 조용히 막습니다. */
    @GetMapping("/api/me/blocks")
    public Map<String, Object> mine(@CurrentUser AuthPrincipal me) {
        return Map.of("blocks", blocks.listOf(me));
    }

    @PostMapping("/api/users/{userId}/report")
    public Map<String, Object> report(@CurrentUser AuthPrincipal me,
                                      @PathVariable String userId,
                                      @RequestBody(required = false) ReasonRequest req) {
        reports.report(me, userId, req == null ? null : req.reason());
        return Map.of("ok", true);
    }

    public record ReasonRequest(String reason) {
    }
}
