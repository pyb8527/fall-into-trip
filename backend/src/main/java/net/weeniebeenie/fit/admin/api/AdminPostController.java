package net.weeniebeenie.fit.admin.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.admin.application.AdminGuard;
import net.weeniebeenie.fit.community.application.PostService;
import net.weeniebeenie.fit.community.domain.TripPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 신고된 글을 살펴보는 곳.
 *
 * <p>신고가 몇 건 쌓이면 사람이 볼 때까지 글이 자동으로 감춰집니다. 그러면
 * 되돌릴 통로도 있어야 합니다. 몇 사람이 짜고 신고하면 멀쩡한 글도 내려가는데,
 * 그것을 되살릴 수 없으면 신고가 곧 삭제가 됩니다.
 */
@RestController
@RequestMapping("/api/admin/posts")
@RequiredArgsConstructor
public class AdminPostController {

    private final AdminGuard guard;
    private final PostService posts;

    @GetMapping
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "page", defaultValue = "0") int page,
                                    @RequestParam(name = "size", defaultValue = "20") int size) {
        guard.requireAdmin(me);
        Page<TripPost> found =
                posts.needingReview(PageRequest.of(Math.max(0, page), AdminPaging.size(size)));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (TripPost p : found.getContent()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", p.getId());
            row.put("title", p.getTitle());
            row.put("authorName", posts.authorNameOf(p));
            row.put("hidden", p.isHidden());
            row.put("reportCount", posts.reportCountOf(p.getId()));
            row.put("likeCount", p.getLikeCount());
            row.put("viewCount", p.getViewCount());
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
        posts.setHidden(me, postId, req != null && Boolean.TRUE.equals(req.hidden()));
        return Map.of("ok", true);
    }

    public record HiddenRequest(Boolean hidden) {
    }
}
