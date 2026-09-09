package net.weeniebeenie.fit.community.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.community.application.PostService;
import net.weeniebeenie.fit.community.domain.TripPost;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 내 일정을 게시판에 올립니다.
 *
 * <p>여행 쪽 주소에 둡니다. 무엇을 올리는지가 여행이라, 글 목록(/api/posts)
 * 아래에 두면 "어느 여행을" 이 주소에서 사라집니다.
 */
@RestController
@RequiredArgsConstructor
public class PublishController {

    private final PostService posts;

    @PostMapping("/api/trips/{tripId}/publish")
    public Map<String, Object> publish(@CurrentUser AuthPrincipal me,
                                       @PathVariable String tripId,
                                       @RequestBody(required = false) PublishRequest req) {
        TripPost post = posts.publish(me, tripId,
                req == null ? null : req.title(),
                req == null ? null : req.summary(),
                req == null ? null : req.region(),
                req != null && Boolean.TRUE.equals(req.feedback()));
        return Map.of("postId", post.getId());
    }

    /**
     * @param title   비우면 여행 이름을 그대로 씁니다.
     * @param summary 목록에서 보이는 한 줄 소개
     * @param region  어느 지역 여행인지. 목록에 없는 값은 버립니다.
     */
    public record PublishRequest(String title, String summary, String region,
                                 Boolean feedback) {
    }
}
