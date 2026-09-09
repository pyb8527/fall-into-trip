package net.weeniebeenie.fit.tip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.tip.domain.PlaceTip;
import net.weeniebeenie.fit.tip.domain.PlaceTipRepository;
import net.weeniebeenie.fit.tip.domain.TipReport;
import net.weeniebeenie.fit.tip.domain.TipReportRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 다녀온 사람이 남기는 한 줄.
 *
 * <p>"지금 대기 40분", "2번 출구로 나와야 함" 처럼 구글에는 없고 방금 다녀온
 * 사람만 아는 것들입니다.
 *
 * <p>오래된 것은 보여 주지 않습니다. "지금 대기 40분" 은 다음 날이면 이미
 * 쓸모가 없고, 두 달 전 것은 사람을 잘못 이끕니다.
 */
@Service
@RequiredArgsConstructor
public class TipService {

    /**
     * 이만큼 지난 팁은 보여 주지 않습니다.
     *
     * <p>지우지는 않습니다. 지우면 신고를 받은 뒤 확인할 것도 사라집니다.
     */
    private static final Duration FRESH = Duration.ofDays(7);

    /** 한 사람이 한 장소에 하루에 남길 수 있는 수. 도배를 막습니다. */
    private static final int MAX_PER_DAY = 3;

    /** 이만큼 신고가 쌓이면 사람이 볼 때까지 감춥니다. */
    private static final long HIDE_AT_REPORTS = 3;

    private static final int MAX_LENGTH = 200;

    private final PlaceTipRepository tips;
    private final TipReportRepository reports;
    private final UserRepository users;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<Card> listOf(String placeId, String meId) {
        List<Card> out = new ArrayList<>();
        for (PlaceTip tip : tips.findAllByPlaceIdAndHiddenFalseAndCreatedAtAfterOrderByCreatedAtDesc(
                placeId, Instant.now().minus(FRESH))) {
            out.add(cardOf(tip, meId));
        }
        return out;
    }

    /** 장소마다 최근 팁이 몇 개인지. 목록에서 "팁 3" 을 띄우는 데 씁니다. */
    @Transactional(readOnly = true)
    public Map<String, Integer> countsOf(Collection<String> placeIds) {
        if (placeIds.isEmpty()) {
            return Map.of();
        }
        Map<String, Integer> out = new HashMap<>();
        for (Object[] row : tips.countsOf(placeIds, Instant.now().minus(FRESH))) {
            out.put((String) row[0], ((Number) row[1]).intValue());
        }
        return out;
    }

    @Transactional
    public PlaceTip add(AuthPrincipal me, String placeId, String text) {
        if (placeId == null || placeId.isBlank()) {
            throw ApiException.badRequest("어느 장소인지 알 수 없습니다.");
        }
        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("남길 말을 적어 주세요.");
        }
        if (clean.length() > MAX_LENGTH) {
            throw ApiException.badRequest("한 줄 팁은 " + MAX_LENGTH + "자까지입니다.");
        }
        if (tips.countByUserIdAndPlaceIdAndCreatedAtAfter(
                me.id(), placeId, Instant.now().minus(Duration.ofDays(1))) >= MAX_PER_DAY) {
            throw ApiException.badRequest("같은 곳에는 하루 " + MAX_PER_DAY + "번까지 남길 수 있습니다.");
        }

        PlaceTip tip = tips.save(PlaceTip.builder()
                .placeId(placeId)
                .userId(me.id())
                .text(clean)
                .build());
        audit.log(me.id(), "tip.add", tip.getId());
        return tip;
    }

    @Transactional
    public void remove(AuthPrincipal me, String tipId) {
        PlaceTip tip = tips.findById(tipId)
                .orElseThrow(() -> ApiException.notFound("팁을 찾을 수 없습니다."));
        boolean mine = tip.getUserId().equals(me.id());
        if (!mine && me.role() != Role.ADMIN) {
            throw ApiException.forbidden("내가 남긴 것만 지울 수 있습니다.");
        }
        tips.delete(tip);
        audit.log(me.id(), mine ? "tip.remove" : "tip.remove.admin", tipId);
    }

    /**
     * 신고.
     *
     * <p>몇 건이 쌓이면 사람이 볼 때까지 자동으로 감춥니다. 혼자 운영하는
     * 서비스라 확인까지 몇 시간이 걸릴 수 있는데, 그동안 문제되는 글이 장소
     * 아래 걸려 있으면 안 됩니다.
     */
    @Transactional
    public void report(AuthPrincipal me, String tipId, String reason) {
        PlaceTip tip = tips.findById(tipId)
                .orElseThrow(() -> ApiException.notFound("팁을 찾을 수 없습니다."));
        if (tip.getUserId().equals(me.id())) {
            throw ApiException.badRequest("내가 남긴 것은 신고할 수 없습니다.");
        }
        if (reports.existsByTipIdAndUserId(tipId, me.id())) {
            throw ApiException.badRequest("이미 신고했습니다.");
        }
        reports.save(new TipReport(tipId, me.id(),
                reason == null || reason.isBlank() ? null : reason.trim()));

        if (reports.countByTipId(tipId) >= HIDE_AT_REPORTS) {
            tip.setHidden(true);
        }
        audit.log(me.id(), "tip.report", tipId);
    }

    /* ------------------------------------------------------------- 운영 */

    @Transactional(readOnly = true)
    public Page<PlaceTip> needingReview(Pageable pageable) {
        return tips.findNeedingReview(pageable);
    }

    public long reportCountOf(String tipId) {
        return reports.countByTipId(tipId);
    }

    @Transactional
    public void setHidden(AuthPrincipal me, String tipId, boolean hidden) {
        PlaceTip tip = tips.findById(tipId)
                .orElseThrow(() -> ApiException.notFound("팁을 찾을 수 없습니다."));
        tip.setHidden(hidden);
        audit.log(me.id(), hidden ? "tip.hide" : "tip.unhide", tipId);
    }

    public Card cardOf(PlaceTip tip, String meId) {
        return new Card(tip.getId(), tip.getText(), nameOf(tip.getUserId()),
                tip.getUserId().equals(meId), tip.getCreatedAt());
    }

    public String nameOf(String userId) {
        return users.findById(userId).map(User::getName).orElse("알 수 없음");
    }

    /** @param mine 내가 남긴 것인지. 지울 수 있는지를 이걸로 정합니다. */
    public record Card(String id, String text, String authorName, boolean mine, Instant createdAt) {
    }
}
