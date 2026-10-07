package net.weeniebeenie.fit.admin.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.admin.application.AdminGuard;
import net.weeniebeenie.fit.safety.application.ProfileReportService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 신고된 프로필.
 *
 * <p>서로 다른 세 사람이 신고하면 남에게 보이는 한 줄 소개와 얼굴 사진이
 * 비워집니다. 운영자가 할 일은 둘 중 하나입니다.
 *
 * <ul>
 *   <li><b>괜찮다</b>({@code DELETE .../reports}) — 신고를 거둡니다. 감춰져
 *       있었으면 다시 보입니다</li>
 *   <li><b>문제가 맞다</b>({@code POST .../wipe}) — 소개와 사진을 비우고
 *       신고를 거둡니다. 그 사람이 새로 적는 것은 다시 보입니다</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/admin/profiles")
@RequiredArgsConstructor
public class AdminProfileController {

    private final AdminGuard guard;
    private final ProfileReportService reports;

    @GetMapping
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "page", defaultValue = "0") int page,
                                    @RequestParam(name = "size", defaultValue = "20") int size) {
        guard.requireAdmin(me);
        Page<ProfileReportService.Row> found =
                reports.needingReview(PageRequest.of(Math.max(0, page), AdminPaging.size(size)));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", found.getContent());
        out.put("page", found.getNumber());
        out.put("totalPages", found.getTotalPages());
        out.put("total", found.getTotalElements());
        return out;
    }

    @DeleteMapping("/{userId}/reports")
    public Map<String, Object> clear(@CurrentUser AuthPrincipal me, @PathVariable String userId) {
        guard.requireAdmin(me);
        reports.clear(me, userId);
        return Map.of("ok", true);
    }

    @PostMapping("/{userId}/wipe")
    public Map<String, Object> wipe(@CurrentUser AuthPrincipal me, @PathVariable String userId) {
        guard.requireAdmin(me);
        reports.wipe(me, userId);
        return Map.of("ok", true);
    }
}
