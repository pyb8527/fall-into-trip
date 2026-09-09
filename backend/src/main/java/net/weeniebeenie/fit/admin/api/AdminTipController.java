package net.weeniebeenie.fit.admin.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.admin.application.AdminGuard;
import net.weeniebeenie.fit.tip.application.TipService;
import net.weeniebeenie.fit.tip.domain.PlaceTip;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 신고된 한 줄 팁.
 *
 * <p>글과 같은 이유로 되돌릴 통로가 있어야 합니다. 몇 사람이 짜고 신고하면
 * 멀쩡한 것도 내려가는데, 되살릴 수 없으면 신고가 곧 삭제가 됩니다.
 */
@RestController
@RequestMapping("/api/admin/tips")
@RequiredArgsConstructor
public class AdminTipController {

    private final AdminGuard guard;
    private final TipService tips;

    @GetMapping
    public Map<String, Object> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "page", defaultValue = "0") int page,
                                    @RequestParam(name = "size", defaultValue = "20") int size) {
        guard.requireAdmin(me);
        Page<PlaceTip> found =
                tips.needingReview(PageRequest.of(Math.max(0, page), AdminPaging.size(size)));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (PlaceTip tip : found.getContent()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", tip.getId());
            row.put("text", tip.getText());
            row.put("authorName", tips.nameOf(tip.getUserId()));
            row.put("placeId", tip.getPlaceId());
            row.put("hidden", tip.isHidden());
            row.put("reportCount", tips.reportCountOf(tip.getId()));
            row.put("createdAt", tip.getCreatedAt());
            rows.add(row);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", rows);
        out.put("page", found.getNumber());
        out.put("totalPages", found.getTotalPages());
        out.put("total", found.getTotalElements());
        return out;
    }

    @PatchMapping("/{tipId}/hidden")
    public Map<String, Object> setHidden(@CurrentUser AuthPrincipal me,
                                         @PathVariable String tipId,
                                         @RequestBody HiddenRequest req) {
        guard.requireAdmin(me);
        tips.setHidden(me, tipId, req != null && Boolean.TRUE.equals(req.hidden()));
        return Map.of("ok", true);
    }

    public record HiddenRequest(Boolean hidden) {
    }
}
