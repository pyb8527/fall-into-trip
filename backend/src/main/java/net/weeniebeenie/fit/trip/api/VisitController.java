package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.VisitService;
import net.weeniebeenie.fit.trip.domain.Visit;
import net.weeniebeenie.fit.trip.application.VisitService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 다녀온 곳 표시. 사람마다 따로 남습니다. */
@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
public class VisitController {

    private final VisitService visits;

    /**
     * 도장을 찍습니다.
     *
     * <p>본문 없이 부르면 지금까지처럼 "다녀왔다" 만 남습니다. 사진·별점·한
     * 줄은 함께 보내도 되고, 나중에 다시 불러 보태도 됩니다 — 도장을 먼저
     * 찍고 사진을 나중에 붙이는 것이 실제 순서입니다.
     */
    @PutMapping("/{placeId}")
    public Map<String, Object> mark(@CurrentUser AuthPrincipal me,
                                    @PathVariable String placeId,
                                    @RequestBody(required = false) MarkRequest req) {
        /* 도장이 먼저입니다. 남기는 것은 찍은 자리에 붙는 일이라, 아직 안
           찍혔으면 찍고 나서 붙입니다. */
        visits.stamp(me, placeId);
        Visit got = visits.mark(me, placeId, req == null ? null
                : new VisitService.Mark(req.photoId(), req.stars(), req.note()));
        Map<String, Object> out = new java.util.HashMap<>();
        out.put("ok", true);
        out.put("visited", true);
        out.put("photoId", got.getPhotoId());
        out.put("stars", got.getStars());
        out.put("note", got.getNote());
        return out;
    }

    /**
     * 도장에 함께 남기는 것들.
     *
     * <p>안 보낸 칸은 그대로 둡니다. 빈 문자열이나 0 은 지우기입니다 — 매긴
     * 별을 지우는 길이 없으면 잘못 누른 것을 되돌릴 수 없습니다.
     */
    public record MarkRequest(String photoId, Integer stars, String note) {
    }

    /**
     * 도장을 뺍니다.
     *
     * <p>같이 간 사람 누구나 뺄 수 있습니다. 찍은 사람만 뺄 수 있게 두면 그
     * 사람이 앱을 안 열면 영영 찍힌 채로 남습니다.
     *
     * <p>내가 남긴 것도 함께 갑니다 — 도장이 없는데 그 자리의 감상만 남아
     * 있으면 어디에도 안 붙습니다. 남이 남긴 것은 그대로 둡니다.
     */
    @DeleteMapping("/{placeId}")
    public Map<String, Object> unmark(@CurrentUser AuthPrincipal me, @PathVariable String placeId) {
        visits.unstamp(me, placeId);
        visits.unmark(me, placeId);
        return Map.of("ok", true, "visited", false);
    }
}
