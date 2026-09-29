package net.weeniebeenie.fit.community.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.community.application.CommentService;
import net.weeniebeenie.fit.community.application.PostService;
import net.weeniebeenie.fit.community.domain.TripPost;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.Trip;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 게시판.
 *
 * <p>목록과 글 보기는 로그인 없이 열립니다. 남의 일정을 구경하러 왔다가
 * 가입하는 흐름이라, 처음부터 가입을 요구하면 아무도 안 들어옵니다.
 *
 * <p>추천·복제·신고는 로그인해야 합니다. 누가 눌렀는지 세야 하고, 한 사람이
 * 한 번만 눌러야 하기 때문입니다.
 */
@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    /** 한 쪽에 보여 줄 글의 수. */
    private static final int SIZE = 20;

    /** 내주는 태그 수. 한 번 쓰인 것까지 다 내면 목록이 아니라 남의 글 모음입니다. */
    private static final int TAG_LIMIT = 30;

    private final PostService posts;
    private final CommentService comments;

    /**
     * @param region 지역. 고를 수 있는 값은 /api/posts/regions 에 있습니다.
     * @param tag    태그 하나. 고를 수 있는 값은 /api/posts/tags 에 있고, 거기
     *               없는 것을 보내도 됩니다 — 사람이 직접 적는 것이라 목록이
     *               늘 뒤따라옵니다
     * @param days   기간. "1"(당일), "2-4"(1~3박), "5"(그 이상)
     * @param q      제목·소개·태그에서 찾을 글자. 태그 목록에 안 뜨는 태그도
     *               이 길로는 찾힙니다 — 목록에는 많이 쓰인 것만 오릅니다
     */
    @GetMapping
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "sort", defaultValue = "hot") String sort,
                                    @RequestParam(name = "region", required = false) String region,
                                    @RequestParam(name = "tag", required = false) String tag,
                                    @RequestParam(name = "days", required = false) String days,
                                    @RequestParam(name = "q", required = false) String q,
                                    @RequestParam(name = "page", defaultValue = "0") int page) {
        Page<TripPost> found =
                posts.list(sort, region, tag, days, q, PageRequest.of(Math.max(0, page), SIZE));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("posts", posts.cardsOf(found.getContent(), me == null ? null : me.id()));
        out.put("page", found.getNumber());
        out.put("totalPages", found.getTotalPages());
        out.put("total", found.getTotalElements());
        return out;
    }

    /**
     * 내가 올린 글.
     *
     * <p>올리고 나면 목록에서 스스로 찾아야 했습니다. 몇 개까지 올릴 수 있다는
     * 제한도 있는데 몇 개 올렸는지 볼 데가 없었습니다.
     *
     * <p>감춰진 글도 함께 보여 줍니다. 내 글이 왜 목록에 없는지는 알아야 합니다.
     */
    /** 고를 수 있는 지역. 화면이 이 목록으로 띠를 그립니다. */
    /**
     * 지금 쓰이고 있는 태그들.
     *
     * <p>지역과 달리 우리가 정한 목록이 아닙니다 — 사람이 적은 것을 세어
     * 돌려줍니다. 적을 때는 옆에 떠서 같은 말로 모이게 하고, 찾을 때는
     * 무엇을 찾을 수 있는지 알려 줍니다.
     */
    @GetMapping("/tags")
    public Map<String, Object> tags() {
        return Map.of("tags", posts.tags(TAG_LIMIT));
    }

    @GetMapping("/regions")
    public Map<String, Object> regions() {
        return Map.of("regions", PostService.REGIONS);
    }

    @GetMapping("/mine")
    public Map<String, Object> mine(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "page", defaultValue = "0") int page) {
        Page<TripPost> found = posts.mine(me, PageRequest.of(Math.max(0, page), SIZE));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("posts", posts.cardsOf(found.getContent(), me.id()));
        out.put("page", found.getNumber());
        out.put("totalPages", found.getTotalPages());
        out.put("total", found.getTotalElements());
        return out;
    }

    /** 내가 추천을 눌러 둔 글. */
    @GetMapping("/liked")
    public Map<String, Object> liked(@CurrentUser AuthPrincipal me,
                                     @RequestParam(name = "page", defaultValue = "0") int page) {
        Page<TripPost> found = posts.liked(me, PageRequest.of(Math.max(0, page), SIZE));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("posts", posts.cardsOf(found.getContent(), me.id()));
        out.put("page", found.getNumber());
        out.put("totalPages", found.getTotalPages());
        out.put("total", found.getTotalElements());
        return out;
    }

    @GetMapping("/{postId}")
    public Map<String, Object> read(@CurrentUser AuthPrincipal me, @PathVariable String postId) {
        TripPost post = posts.read(postId);
        if (me != null) {
            posts.countView(postId, me.id());
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", post.getId());
        out.put("title", post.getTitle());
        out.put("summary", post.getSummary());
        /* 목록 카드에는 실려 있는데 상세에는 없었습니다. 그래서 글을 열면
           어느 지역, 무슨 태그로 올린 글인지가 사라졌고, 고치는 판에 지금
           값을 채워 넣을 수도 없었습니다. */
        out.put("region", post.getRegion());
        out.put("tags", post.getTags());
        out.put("authorName", posts.authorNameOf(post));
        out.put("dayCount", post.getDayCount());
        out.put("placeCount", post.getPlaceCount());
        out.put("likeCount", post.getLikeCount());
        out.put("viewCount", post.getViewCount());
        out.put("liked", me != null && !posts.likedBy(me.id(), java.util.List.of(postId)).isEmpty());
        out.put("mine", me != null && post.getAuthorId().equals(me.id()));
        out.put("createdAt", post.getCreatedAt());
        out.put("feedback", post.isFeedback());
        out.put("commentCount", comments.countOf(postId));
        out.put("itinerary", posts.snapshotOf(post));
        return out;
    }

    @PostMapping("/{postId}/like")
    public Map<String, Object> like(@CurrentUser AuthPrincipal me,
                                    @PathVariable String postId,
                                    @RequestParam(name = "on", defaultValue = "true") boolean on) {
        return Map.of("liked", posts.like(me, postId, on));
    }

    /** 남의 일정을 내 것으로 가져옵니다. 첫날은 새로 정합니다. */
    @PostMapping("/{postId}/copy")
    public Map<String, Object> copy(@CurrentUser AuthPrincipal me,
                                    @PathVariable String postId,
                                    @RequestBody(required = false) CopyRequest req) {
        if (req == null || req.startIso() == null || req.startIso().isBlank()) {
            throw ApiException.badRequest("언제 떠날지 정해 주세요.");
        }
        Trip trip = posts.copy(me, postId, req.startIso(), req.days());
        return Map.of("tripId", trip.getId());
    }

    @PostMapping("/{postId}/report")
    public Map<String, Object> report(@CurrentUser AuthPrincipal me,
                                      @PathVariable String postId,
                                      @RequestBody(required = false) ReportRequest req) {
        posts.report(me, postId, req == null ? null : req.reason());
        return Map.of("ok", true);
    }

    /**
     * 올린 글의 겉을 고칩니다.
     *
     * <p>안 보낸 칸은 그대로입니다. 빈 문자열은 지우기입니다.
     */
    @PatchMapping("/{postId}")
    public Map<String, Object> edit(@CurrentUser AuthPrincipal me,
                                    @PathVariable String postId,
                                    @RequestBody EditRequest req) {
        TripPost post = posts.edit(me, postId, req.title(), req.summary(),
                req.region(), req.tags(), req.feedback());
        return Map.of("ok", true, "postId", post.getId());
    }

    /**
     * 올린 글에서 장소 하나를 뺍니다.
     *
     * <p>가운데 한 곳이 틀렸다는 이유로 글을 내리면 추천과 댓글이 함께
     * 사라집니다. 그 값이 너무 커서 대개 틀린 채로 두게 됩니다.
     *
     * @param dayAt   몇째 날(0부터)
     * @param placeAt 그 날의 몇째 곳(0부터)
     */
    @DeleteMapping("/{postId}/days/{dayAt}/places/{placeAt}")
    public Map<String, Object> dropPlace(@CurrentUser AuthPrincipal me,
                                         @PathVariable String postId,
                                         @PathVariable int dayAt,
                                         @PathVariable int placeAt) {
        TripPost post = posts.dropPlace(me, postId, dayAt, placeAt);
        return Map.of("ok", true, "dayCount", post.getDayCount(), "placeCount", post.getPlaceCount());
    }

    @DeleteMapping("/{postId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me, @PathVariable String postId) {
        posts.remove(me, postId);
        return Map.of("ok", true);
    }

    /**
     * @param days 가져올 날의 번호(0부터). 비우면 전부입니다.
     *             <p>닷새짜리 글에서 이틀만 쓰고 싶을 때가 있습니다. 통째로
     *             가져와 지우게 하면 지우는 일이 곧 남습니다.
     */
    public record CopyRequest(String startIso, java.util.List<Integer> days) {
    }

    public record ReportRequest(String reason) {
    }

    /**
     * 고칠 칸. 보내지 않은 것은 그대로 둡니다.
     *
     * <p>일정 자체(날과 장소)는 여기로 고치지 않습니다. 사본을 통째로 다시
     * 쓰게 하면 그건 고치기가 아니라 다시 올리기입니다.
     */
    public record EditRequest(String title, String summary, String region,
                              java.util.List<String> tags, Boolean feedback) {
    }
}
