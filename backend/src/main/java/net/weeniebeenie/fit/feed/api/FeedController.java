package net.weeniebeenie.fit.feed.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.community.application.CommentService;
import net.weeniebeenie.fit.feed.application.FeedService;
import net.weeniebeenie.fit.feed.domain.Audience;
import net.weeniebeenie.fit.feed.domain.Post;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.DayLabels;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 피드 — 사진과 글.
 *
 * <p>보는 길이 넷입니다. 어느 모임의 것인지, 내가 올린 것인지, 어느 여행
 * 이야기인지, 어느 하루에 올린 것인지. 넷을 한 길에 두고 묻는 것만 다르게
 * 합니다 — 돌려주는 모양이 같으므로 화면도 한 벌이면 됩니다.
 *
 * <p>달력에 적을 <b>수</b>만 길이 따로입니다({@code /api/feed/days}). 돌려주는
 * 것이 글이 아니라 「날짜 → 개수」라서, 같은 길에 두면 같은 주소가 모양이 둘인
 * 답을 내게 됩니다.
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
     * @param on    {@code 2026-10-02} 꼴 하루. {@code mine} 과 함께 주면 그날
     *              내가 올린 글만입니다 — 달력에서 날을 누른 자리입니다. 홀로
     *              오면 안 봅니다. 「그날 모든 사람의 글」은 울타리를 날마다 다시
     *              물어야 하는 다른 일이라, 그 뜻으로 읽히게 두지 않습니다
     */
    @GetMapping("/api/feed")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(required = false) String group,
                                    @RequestParam(required = false) Boolean mine,
                                    @RequestParam(required = false) String trip,
                                    @RequestParam(required = false) String tag,
                                    @RequestParam(required = false) String author,
                                    @RequestParam(required = false) String on,
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
            if (on != null && !on.isBlank()) {
                /* 하루치는 많아야 몇 편이라 나눠 주지 않습니다 — 여행 앨범과
                   같습니다. */
                return Map.of("posts", feed.mineOn(me, DayLabels.parse(on)), "more", false);
            }
            FeedService.Slice slice = feed.mine(me, tag, page);
            return Map.of("posts", slice.posts(), "more", slice.more());
        }
        throw ApiException.badRequest("어느 피드를 볼지 알려 주세요.");
    }

    /**
     * 날마다 내가 올린 글이 몇 편인가 — 달력 칸에 적는 수.
     *
     * <p>{@code /api/feed/{id}} 옆에 글자 칸으로 섭니다. 스프링은 틀({@code
     * {id}})보다 글자가 적힌 길을 먼저 고르므로 {@code days} 가 글 번호로
     * 읽히지 않습니다 — 여행기 쪽도 같은 꼴입니다({@code /api/posts/mine} 이
     * {@code /api/posts/{postId}} 와 함께 있습니다). 컨트롤러를 따로 내지
     * 않는 까닭은 보는 사람과 울타리가 피드 것 그대로라서입니다.
     *
     * <p>돌려주는 모양은 {@code {"days": {"2026-10-02": 3}}} 입니다. 0 인 날은
     * 안 옵니다 — 서른 칸을 다 채우면 글 두 편 올린 달에 0 이 스물여덟 개
     * 갑니다.
     *
     * @param from {@code 2026-10-01} 꼴 첫 날
     * @param to   끝 날. <b>이 날도 듭니다</b> — 화면이 1일과 말일을 넘깁니다
     */
    @GetMapping("/api/feed/days")
    public Map<String, Object> days(@CurrentUser AuthPrincipal me,
                                    @RequestParam String from,
                                    @RequestParam String to) {
        /* 날짜를 열쇠로 쓰는 표라 차례를 지켜 담습니다. */
        Map<String, Integer> counts = new LinkedHashMap<>();
        feed.daysOfMine(me, DayLabels.parse(from), DayLabels.parse(to))
                .forEach((day, n) -> counts.put(day.toString(), n));
        return Map.of("days", counts);
    }

    @GetMapping("/api/feed/{id}")
    public Map<String, Object> read(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return Map.of("post", feed.read(me, id));
    }

    @PostMapping("/api/feed")
    public Map<String, Object> write(@CurrentUser AuthPrincipal me,
                                     @RequestBody WriteRequest req) {
        WriteRequest r = req == null ? new WriteRequest(null, null, null, null, null, null) : req;
        Post made = feed.write(me, r.groupId(), r.tripId(), r.text(), r.tags(), r.photoIds(),
                r.audience());
        return Map.of("post", feed.read(me, made.getId()));
    }

    /**
     * @param groupId  모임에 올리면 그 모임. 안 주면 내 피드입니다
     * @param tripId   어느 여행 이야기인지. 안 골라도 됩니다
     * @param audience 누가 볼지. 안 주면 올린 자리가 정합니다 — 모임에 올리면
     *                 그 모임 사람, 내 피드면 나만입니다. 공개 범위가 없던
     *                 때의 동작이라 옛 화면이 보내던 몸체가 그대로 통합니다
     */
    public record WriteRequest(String groupId, String tripId, String text,
                               List<String> tags, List<String> photoIds,
                               Audience audience) {
    }

    /** 보낸 것만 바뀝니다. 비우는 것은 빈 글입니다. */
    @PatchMapping("/api/feed/{id}")
    public Map<String, Object> edit(@CurrentUser AuthPrincipal me,
                                    @PathVariable String id,
                                    @RequestBody EditRequest req) {
        EditRequest r = req == null ? new EditRequest(null, null, null, null, null) : req;
        feed.edit(me, id, r.text(), r.tags(), r.photoIds(), r.tripId(), r.audience());
        return Map.of("post", feed.read(me, id));
    }

    /** @param audience 안 주면 그대로 둡니다. 비우는 뜻이 아닙니다 */
    public record EditRequest(String text, List<String> tags, List<String> photoIds,
                              String tripId, Audience audience) {
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
