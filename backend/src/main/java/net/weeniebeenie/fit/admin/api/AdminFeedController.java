package net.weeniebeenie.fit.admin.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.admin.application.AdminGuard;
import net.weeniebeenie.fit.feed.application.FeedService;
import net.weeniebeenie.fit.feed.domain.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 신고된 피드 글.
 *
 * <p>여행기 · 한 줄 · 댓글과 같은 이유로 되돌릴 통로가 있어야 합니다. 몇
 * 사람이 짜고 신고하면 멀쩡한 것도 내려가는데, 되살릴 수 없으면 신고가 곧
 * 삭제가 됩니다.
 *
 * <p>지우기는 따로 길을 안 냅니다. 피드 글을 지우는 길({@code DELETE
 * /api/feed/{id}})이 이미 운영자를 받습니다 — 감춰진 글도 찾도록 그쪽을
 * 고쳐 두었습니다({@code FeedService.remove}).
 */
@RestController
@RequestMapping("/api/admin/feed")
@RequiredArgsConstructor
public class AdminFeedController {

    private final AdminGuard guard;
    private final FeedService feed;

    @GetMapping
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "page", defaultValue = "0") int page,
                                    @RequestParam(name = "size", defaultValue = "20") int size) {
        guard.requireAdmin(me);
        Page<Post> found =
                feed.needingReview(PageRequest.of(Math.max(0, page), AdminPaging.size(size)));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Post p : found.getContent()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", p.getId());
            /* 글 없이 사진만 올린 글도 있습니다. 비워 두면 운영 화면 줄이 제목
               없이 서서 무엇인지 모릅니다. */
            row.put("text", p.getText() == null ? "(사진만 올린 글)" : p.getText());
            row.put("authorName", feed.authorNameOf(p));
            row.put("audience", p.getAudience().name());
            row.put("hidden", p.isHidden());
            row.put("reportCount", feed.reportCountOf(p.getId()));
            row.put("createdAt", p.getCreatedAt());
            rows.add(row);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", rows);
        out.put("page", found.getNumber());
        out.put("totalPages", found.getTotalPages());
        out.put("total", found.getTotalElements());
        return out;
    }

    @PatchMapping("/{postId}/hidden")
    public Map<String, Object> setHidden(@CurrentUser AuthPrincipal me,
                                         @PathVariable String postId,
                                         @RequestBody HiddenRequest req) {
        guard.requireAdmin(me);
        feed.setHidden(me, postId, req != null && Boolean.TRUE.equals(req.hidden()));
        return Map.of("ok", true);
    }

    public record HiddenRequest(Boolean hidden) {
    }
}
