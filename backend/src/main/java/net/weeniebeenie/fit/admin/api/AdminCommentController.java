package net.weeniebeenie.fit.admin.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.admin.application.AdminGuard;
import net.weeniebeenie.fit.community.application.CommentService;
import net.weeniebeenie.fit.community.domain.PostComment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 신고된 댓글.
 *
 * <p>글·한 줄과 같은 이유로 되돌릴 통로가 있어야 합니다. 몇 사람이 짜고
 * 신고하면 멀쩡한 것도 내려가는데, 되살릴 수 없으면 신고가 곧 삭제가 됩니다.
 */
@RestController
@RequestMapping("/api/admin/comments")
@RequiredArgsConstructor
public class AdminCommentController {

    private final AdminGuard guard;
    private final CommentService comments;

    @GetMapping
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "page", defaultValue = "0") int page,
                                    @RequestParam(name = "size", defaultValue = "20") int size) {
        guard.requireAdmin(me);
        Page<PostComment> found =
                comments.needingReview(PageRequest.of(Math.max(0, page), AdminPaging.size(size)));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (PostComment c : found.getContent()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", c.getId());
            row.put("text", c.getText());
            row.put("authorName", comments.nameOf(c.getUserId()));
            row.put("hidden", c.isHidden());
            row.put("reportCount", comments.reportCountOf(c.getId()));
            row.put("createdAt", c.getCreatedAt());
            rows.add(row);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", rows);
        out.put("page", found.getNumber());
        out.put("totalPages", found.getTotalPages());
        out.put("total", found.getTotalElements());
        return out;
    }

    @PatchMapping("/{commentId}/hidden")
    public Map<String, Object> setHidden(@CurrentUser AuthPrincipal me,
                                         @PathVariable String commentId,
                                         @RequestBody HiddenRequest req) {
        guard.requireAdmin(me);
        comments.setHidden(me, commentId, req != null && Boolean.TRUE.equals(req.hidden()));
        return Map.of("ok", true);
    }

    public record HiddenRequest(Boolean hidden) {
    }
}
