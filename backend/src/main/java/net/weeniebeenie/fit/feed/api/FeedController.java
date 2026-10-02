package net.weeniebeenie.fit.feed.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.community.application.CommentService;
import net.weeniebeenie.fit.feed.application.FeedService;
import net.weeniebeenie.fit.feed.domain.Post;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 피드 — 사진과 글.
 *
 * <p>보는 길이 셋입니다. 어느 모임의 것인지, 내가 올린 것인지, 어느 여행
 * 이야기인지. 셋을 한 길에 두고 묻는 것만 다르게 합니다 — 돌려주는 모양이
 * 같으므로 화면도 한 벌이면 됩니다.
 */
@RestController
@RequiredArgsConstructor
public class FeedController {

    private final FeedService feed;
    private final CommentService comments;

    /**
     * 피드를 봅니다.
     *
     * @param group 모임 번호. 주면 그 모임의 피드
     * @param mine  true 면 내가 올린 것 전부
     * @param trip  여행 번호. 주면 그 여행에 붙은 글들
     * @param tag   그 태그가 달린 것만. 안 주면 전부
     */
    @GetMapping("/api/feed")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(required = false) String group,
                                    @RequestParam(required = false) Boolean mine,
                                    @RequestParam(required = false) String trip,
                                    @RequestParam(required = false) String tag,
                                    @RequestParam(required = false) String author,
                                    @RequestParam(defaultValue = "0") int page) {
        if (group != null && !group.isBlank()) {
            FeedService.Slice slice = feed.ofGroup(me, group, tag, page);
            return Map.of("posts", slice.posts(), "more", slice.more());
        }
        if (trip != null && !trip.isBlank()) {
            /* 한 여행에 붙는 글은 많아야 몇십 편이라 나눠 주지 않습니다. */
            return Map.of("posts", feed.ofTrip(me, trip), "more", false);
        }
        if (author != null && !author.isBlank()) {
            FeedService.Slice slice = feed.ofAuthor(me, author, tag, page);
            return Map.of("posts", slice.posts(), "more", slice.more());
        }
        if (Boolean.TRUE.equals(mine)) {
            FeedService.Slice slice = feed.mine(me, tag, page);
            return Map.of("posts", slice.posts(), "more", slice.more());
        }
        throw ApiException.badRequest("어느 피드를 볼지 알려 주세요.");
    }

    @GetMapping("/api/feed/{id}")
    public Map<String, Object> read(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return Map.of("post", feed.read(me, id));
    }

    @PostMapping("/api/feed")
    public Map<String, Object> write(@CurrentUser AuthPrincipal me,
                                     @RequestBody WriteRequest req) {
        WriteRequest r = req == null ? new WriteRequest(null, null, null, null, null) : req;
        Post made = feed.write(me, r.groupId(), r.tripId(), r.text(), r.tags(), r.photoIds());
        return Map.of("post", feed.read(me, made.getId()));
    }

    /**
     * @param groupId 모임에 올리면 그 모임. 안 주면 내 피드입니다
     * @param tripId  어느 여행 이야기인지. 안 골라도 됩니다
     */
    public record WriteRequest(String groupId, String tripId, String text,
                               List<String> tags, List<String> photoIds) {
    }

    /** 보낸 것만 바뀝니다. 비우는 것은 빈 글입니다. */
    @PatchMapping("/api/feed/{id}")
    public Map<String, Object> edit(@CurrentUser AuthPrincipal me,
                                    @PathVariable String id,
                                    @RequestBody EditRequest req) {
        EditRequest r = req == null ? new EditRequest(null, null, null, null) : req;
        feed.edit(me, id, r.text(), r.tags(), r.photoIds(), r.tripId());
        return Map.of("post", feed.read(me, id));
    }

    public record EditRequest(String text, List<String> tags, List<String> photoIds,
                              String tripId) {
    }

    @DeleteMapping("/api/feed/{id}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        feed.remove(me, id);
        return Map.of("ok", true);
    }

    /* ---------------------------------------------------------------- 댓글 */

    /**
     * 댓글.
     *
     * <p>지우고 신고하는 길은 여행기 쪽과 같습니다
     * ({@code /api/comments/{id}}) — 같은 표에 있고 운영 화면도 하나입니다.
     */
    @GetMapping("/api/feed/{id}/comments")
    public Map<String, Object> commentsOf(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        feed.mine(id, me.id());
        return Map.of("comments", comments.listOfFeed(id, me.id()));
    }

    @PostMapping("/api/feed/{id}/comments")
    public Map<String, Object> comment(@CurrentUser AuthPrincipal me,
                                       @PathVariable String id,
                                       @RequestBody TextRequest req) {
        feed.mine(id, me.id());
        var made = comments.addToFeed(me, id, req == null ? null : req.text());
        return Map.of("comment", comments.cardOf(made, me.id()));
    }

    public record TextRequest(String text) {
    }
}
