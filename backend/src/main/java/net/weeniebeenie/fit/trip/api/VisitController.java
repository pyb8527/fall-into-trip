package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.VisitService;
import net.weeniebeenie.fit.trip.domain.PhotoKind;
import net.weeniebeenie.fit.trip.domain.Place;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 다녀온 자리에 남기는 것.
 *
 * <p>여행의 것입니다 — 멤버면 누구나 더하고 고치고 뺍니다. 한동안 사람마다
 * 따로 두었는데, 그러면 한 장소에 여러 덩어리가 나란히 서고 남이 올린 것은
 * 손댈 수가 없었습니다.
 */
@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
public class VisitController {

    private final VisitService visits;

    /**
     * 도장을 찍고, 그 자리에 남깁니다.
     *
     * <p>본문 없이 부르면 "다녀왔다" 만 남습니다. 사진·별점·한 줄은 함께
     * 보내도 되고 나중에 다시 불러 보태도 됩니다 — 도장을 먼저 찍고 사진을
     * 나중에 붙이는 것이 실제 순서입니다.
     */
    @PutMapping("/{placeId}")
    public Map<String, Object> mark(@CurrentUser AuthPrincipal me,
                                    @PathVariable String placeId,
                                    @RequestBody(required = false) MarkRequest req) {
        /* 도장이 먼저입니다. 남기는 것은 찍은 자리에 붙는 일이라, 아직 안
           찍혔으면 찍고 나서 붙입니다. */
        visits.stamp(me, placeId);
        Place got = visits.record(me, placeId, req == null ? null
                : new VisitService.Mark(req.photoIds(), req.stars(), req.note()));

        Map<String, Object> out = new java.util.HashMap<>();
        out.put("ok", true);
        out.put("visited", true);
        out.put("photoIds", visits.photosOf(placeId, PhotoKind.RECORD));
        out.put("stars", got.getStars());
        out.put("note", got.getReview());
        return out;
    }

    /**
     * @param photoIds 이 장소에 붙일 사진들. 보내 온 목록이 곧 그 장소의
     *                 사진입니다 — 빠진 것은 뗍니다. 안 보내면 그대로 둡니다
     * @param stars    1~5. 0 은 "안 매김" 으로 지우기입니다
     * @param note     한 줄. 빈 글자가 지우기입니다
     */
    public record MarkRequest(List<String> photoIds, Integer stars, String note) {
    }

    /**
     * 도장을 뺍니다.
     *
     * <p>같이 간 사람 누구나 뺄 수 있습니다. 찍은 사람만 뺄 수 있게 두면 그
     * 사람이 앱을 안 열면 영영 찍힌 채로 남습니다.
     *
     * <h3>남긴 것은 안 건드립니다</h3>
     *
     * <p>한동안 남긴 것도 함께 지웠습니다. "도장이 없는데 감상만 남아 있으면
     * 어디에도 안 붙는다" 는 생각이었는데, 그 값이 너무 큽니다 — <b>손가락이
     * 스쳐 도장이 풀리면 그 자리에서 찍은 사진이 되돌릴 수 없이 사라집니다.</b>
     * 도장은 다시 누르면 그만이고 사진은 다시 찍을 수 없습니다.
     *
     * <p>도장 없이 남은 기록은 그대로 둡니다. 다시 찍으면 제자리로 돌아오고,
     * 지우고 싶으면 남기는 판에서 빼면 됩니다.
     */
    @DeleteMapping("/{placeId}")
    public Map<String, Object> unmark(@CurrentUser AuthPrincipal me, @PathVariable String placeId) {
        visits.unstamp(me, placeId);
        return Map.of("ok", true, "visited", false);
    }

    /**
     * 다니면서 볼 사진.
     *
     * <p>메뉴판, 예매 화면, 가는 길 지도 같은 것입니다. 여행기에는 <b>안
     * 실립니다</b> — 다니면서 보려고 넣는 것이지 남에게 보이려고 넣는 것이
     * 아닙니다.
     *
     * <p>도장과 상관없습니다. 가기 <b>전에</b> 넣어 두는 것이라, 다녀와야
     * 넣을 수 있으면 쓸모가 없습니다.
     */
    @PutMapping("/{placeId}/refs")
    public Map<String, Object> refs(@CurrentUser AuthPrincipal me,
                                    @PathVariable String placeId,
                                    @RequestBody(required = false) RefsRequest req) {
        visits.setRefs(me, placeId, req == null ? List.of() : req.photoIds());
        return Map.of("ok", true, "photoIds", visits.photosOf(placeId, PhotoKind.REFERENCE));
    }

    public record RefsRequest(List<String> photoIds) {
    }
}
