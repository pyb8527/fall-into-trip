package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.VisitService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 다니면서 볼 사진.
 *
 * <h3>도장이 여기 있었습니다</h3>
 *
 * <p>「다녀왔다」를 찍고, 그 자리에 사진·별점·한 줄을 남기는 길이었습니다.
 * 둘 다 걷었습니다 — 갔다 왔는지는 본인이 알고, 남기는 것은 장소를 먼저
 * 골라야 한다는 것이 문제였습니다(피드로 옮겼습니다).
 *
 * <p>남는 것은 메뉴판·예매 화면·가는 길 지도입니다. 여행기에는 안 실립니다.
 */
@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
public class VisitController {

    private final VisitService visits;

    /**
     * 다니면서 볼 사진을 챙겨 둡니다.
     *
     * <p>보낸 목록이 곧 그 장소의 사진입니다 — 빠진 것은 뗍니다. 빈 목록이
     * 「다 빼기」입니다.
     *
     * <p>도장과 상관없습니다. 가기 <b>전에</b> 넣어 두는 것이라, 다녀와야
     * 넣을 수 있으면 쓸모가 없습니다.
     */
    @PutMapping("/{placeId}/refs")
    public Map<String, Object> refs(@CurrentUser AuthPrincipal me,
                                    @PathVariable String placeId,
                                    @RequestBody(required = false) RefsRequest req) {
        visits.setRefs(me, placeId, req == null ? List.of() : req.photoIds());
        return Map.of("ok", true, "photoIds", visits.photosOf(placeId));
    }

    public record RefsRequest(List<String> photoIds) {
    }
}
