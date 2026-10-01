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
                req == null ? null : req.tags(),
                req == null ? null : req.days(),
                req != null && Boolean.TRUE.equals(req.feedback()),
                req == null ? null : req.coverPhotoId(),
                seen(req == null ? null : req.visibility()),
                req == null ? null : req.storyIds());
        return Map.of("postId", post.getId());
    }

    /**
     * @param title   비우면 여행 이름을 그대로 씁니다.
     * @param summary 목록에서 보이는 한 줄 소개
     * @param region  어느 지역 여행인지. 목록에 없는 값은 버립니다.
     * @param tags    무엇에 대한 여행인지. 고르는 목록 없이 직접 적습니다 —
     *                무엇으로 묶일지는 미리 알 수 없고, 목록을 만들어 두면
     *                거기 없는 여행은 아무 데도 안 걸립니다. 다듬는 것과 수를
     *                줄이는 것은 서비스가 합니다
     * @param days    올릴 날의 id. 비우면 전부입니다 — 지금까지의 동작입니다.
     *                닷새 중 잘 짜인 하루만 올리고 싶을 때가 흔한데, 그
     *                하루를 보여 주려고 닷새를 통째로 올리면 보는 사람은
     *                나흘을 지나쳐야 합니다
     */
    /* 공개 범위를 읽는 규칙은 PostController 와 같아야 합니다 — 올릴 때와
       고칠 때가 다르면 그 자체가 버그입니다. */
    private static net.weeniebeenie.fit.community.domain.Visibility seen(String raw) {
        return PostController.seen(raw);
    }

    /**
     * @param coverPhotoId 표지 사진. 내가 올린 것이어야 합니다
     * @param visibility   LISTED(둘러보기에 뜸) · LINK(주소 아는 사람만) ·
     *                     PRIVATE(나만). 안 주면 LISTED — 지금까지의 동작입니다
     * @param storyIds     같이 실을 피드 글. 내가 쓴, 이 여행의 글만 됩니다 —
     *                     모임에서 남이 올린 사진을 공개로 돌리는 결정은
     *                     찍은 사람이 합니다
     */
    public record PublishRequest(String title, String summary, String region,
                                 java.util.List<String> tags,
                                 java.util.List<String> days, Boolean feedback,
                                 String coverPhotoId, String visibility,
                                 java.util.List<String> storyIds) {
    }
}
