package net.weeniebeenie.fit.community.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.community.application.CommentService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
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

    /** 「내가 남긴 것」 한 쪽의 길이. 여행기 목록과 같은 값입니다. */
    private static final int SIZE = 20;

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

    /**
     * 내가 남긴 댓글 — 여행기와 피드 글에 달린 것이 한 목록에.
     *
     * <p>이름을 {@code /api/posts/mine}·{@code /api/posts/liked} 에 맞춥니다 —
     * 「무엇의 내 것」을 {@code mine} 으로 적는 규칙이 이미 서 있습니다.
     * {@code /api/me/comments} 쪽으로 가지 않은 까닭은 {@code /api/me} 아래가
     * <b>사람 하나</b>를 두고 묻는 자리라서입니다(profile · reviews · visited).
     * 댓글은 댓글에 관한 길이고, 고치기·지우기가 이미 {@code /api/comments/*}
     * 아래에 있습니다. 한 갈래를 두 뿌리에 걸치지 않습니다.
     *
     * <p>쪽을 끊어 냅니다. 몇 해 쓴 사람의 댓글은 몇백 개입니다.
     *
     * <p><b>피드 글 목록은 여기 없습니다.</b> 내놓은 여행기는 마이페이지
     * 「여행기」 칸이, 피드 글은 둘러보기 「내 글」 탭이 이미 냅니다
     * ({@code /api/posts/mine} · {@code /api/feed}). 셋째 목록을 만들면 같은
     * 것을 두 군데서 그리게 되고, 한쪽을 고칠 때 다른 쪽이 남습니다.
     */
    @GetMapping("/api/comments/mine")
    public Map<String, Object> mine(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "page", defaultValue = "0") int page) {
        Page<CommentService.Mine> found =
                comments.mine(me, PageRequest.of(Math.max(0, page), SIZE));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("comments", found.getContent());
        out.put("page", found.getNumber());
        out.put("totalPages", found.getTotalPages());
        out.put("total", found.getTotalElements());
        return out;
    }

    /**
     * 남긴 말 고치기.
     *
     * <p>남긴 사람만입니다. 지우기는 제 마당에 달린 것을 글쓴이도 치울 수
     * 있는데(아래 {@code remove}) 고치기는 그렇지 않습니다 — 남의 말을 고치는
     * 것은 치우는 것과 다른 일입니다. 규칙은 {@link CommentService#edit}.
     */
    @PatchMapping("/api/comments/{commentId}")
    public Map<String, Object> edit(@CurrentUser AuthPrincipal me,
                                    @PathVariable String commentId,
                                    @RequestBody EditRequest req) {
        var comment = comments.edit(me, commentId, req == null ? null : req.text());
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

    /**
     * 고치는 것 — 글자만.
     *
     * <p>가리키는 장소는 안 받습니다. 「여기 말고 옆집」을 다른 집으로 옮기면
     * 뜻이 통째로 달라지므로 그것은 고치는 일이 아니라 새로 남기는 일입니다.
     */
    public record EditRequest(String text) {
    }

    public record ReasonRequest(String reason) {
    }
}
