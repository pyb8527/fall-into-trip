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

    private final PostService posts;
    private final CommentService comments;

    /**
     * @param region 지역. 고를 수 있는 값은 /api/posts/regions 에 있습니다.
     * @param days   기간. "1"(당일), "2-4"(1~3박), "5"(그 이상)
     * @param q      제목과 소개에서 찾을 글자
     */
    @GetMapping
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "sort", defaultValue = "hot") String sort,
                                    @RequestParam(name = "region", required = false) String region,
                                    @RequestParam(name = "days", required = false) String days,
                                    @RequestParam(name = "q", required = false) String q,
                                    @RequestParam(name = "page", defaultValue = "0") int page) {
        Page<TripPost> found =
                posts.list(sort, region, days, q, PageRequest.of(Math.max(0, page), SIZE));
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
        Trip trip = posts.copy(me, postId, req.startIso());
        return Map.of("tripId", trip.getId());
    }

    @PostMapping("/{postId}/report")
    public Map<String, Object> report(@CurrentUser AuthPrincipal me,
                                      @PathVariable String postId,
                                      @RequestBody(required = false) ReportRequest req) {
        posts.report(me, postId, req == null ? null : req.reason());
        return Map.of("ok", true);
    }

    @DeleteMapping("/{postId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me, @PathVariable String postId) {
        posts.remove(me, postId);
        return Map.of("ok", true);
    }

    public record CopyRequest(String startIso) {
    }

    public record ReportRequest(String reason) {
    }
}
