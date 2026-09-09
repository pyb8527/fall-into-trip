package net.weeniebeenie.fit.community.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.community.application.CommentService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 올라온 일정에 달리는 댓글.
 *
 * <p>읽는 것은 로그인 없이도 됩니다. 남기거나 신고할 때만 로그인을 부릅니다.
 *
 * <p>글쓴이가 의견을 받겠다고 열어 둔 글에만 달 수 있습니다. 구경만 하라고
 * 올린 글에 훈수가 달리면 반갑지 않습니다.
 */
@RestController
@RequiredArgsConstructor
public class CommentController {

    private final CommentService comments;

    @GetMapping("/api/posts/{postId}/comments")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me, @PathVariable String postId) {
        return Map.of("comments", comments.listOf(postId, me == null ? null : me.id()));
    }

    /**
     * @param req dayIndex 와 placeIndex 를 함께 주면 그 장소에 달립니다. 없으면
     *            일정 전체에 대한 말입니다.
     */
    @PostMapping("/api/posts/{postId}/comments")
    public Map<String, Object> add(@CurrentUser AuthPrincipal me,
                                   @PathVariable String postId,
                                   @RequestBody AddRequest req) {
        var comment = comments.add(me, postId,
                req == null ? null : req.text(),
                req == null ? null : req.dayIndex(),
                req == null ? null : req.placeIndex());
        return Map.of("comment", comments.cardOf(comment, me.id()));
    }

    @DeleteMapping("/api/comments/{commentId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me, @PathVariable String commentId) {
        comments.remove(me, commentId);
        return Map.of("ok", true);
    }

    @PostMapping("/api/comments/{commentId}/report")
    public Map<String, Object> report(@CurrentUser AuthPrincipal me,
                                      @PathVariable String commentId,
                                      @RequestBody(required = false) ReasonRequest req) {
        comments.report(me, commentId, req == null ? null : req.reason());
        return Map.of("ok", true);
    }

    public record AddRequest(String text, Integer dayIndex, Integer placeIndex) {
    }

    public record ReasonRequest(String reason) {
    }
}
