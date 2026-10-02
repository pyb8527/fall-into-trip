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
import net.weeniebeenie.fit.tip.domain.PlaceTipView;
import net.weeniebeenie.fit.tip.domain.PlaceTipViewRepository;
import net.weeniebeenie.fit.tip.domain.TipReport;
import net.weeniebeenie.fit.tip.domain.TipReportRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
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
    private final PlaceTipViewRepository views;
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

    /**
     * 남의 한 줄을 읽었다고 표시합니다. 하루에 한 번만 셉니다.
     *
     * <p>남긴 사람에게 <b>자기 것이 쓰였다</b>고 말해 주려고 셉니다. 그것
     * 말고 쓰는 데가 없습니다 — 팁마다 조회수를 띄우지 않습니다. 띄우면
     * 수가 적은 팁이 덜 맞는 말처럼 보이는데, 늦게 올라온 것일 뿐입니다.
     *
     * <p>안 세는 자리가 셋입니다.
     * <ul>
     *   <li><b>손님</b> — 사람 번호가 없어 "하루 한 번" 을 셀 수 없습니다.
     *       아이피로 세면 자취를 쌓는 일이 됩니다</li>
     *   <li><b>내 팁</b> — 장소를 열 때마다 내 수가 오릅니다</li>
     *   <li><b>내려간 팁</b> — 신고가 쌓여 내려간 것이 쓰였다고 말하면
     *       안 됩니다. 목록이 이미 거르므로 여기 오지 않지만, 부르는 쪽이
     *       바뀌어도 안 새도록 여기서 한 번 더 봅니다</li>
     * </ul>
     *
     * <p>읽는 것과 나눠 둡니다. {@link #listOf} 는 읽기 전용이고, 세는 일은
     * 쓰기입니다. 한 메서드로 묶으면 손님이 목록을 볼 때마다 쓰기 거래가
     * 열립니다.
     */
    @Transactional
    public void countViews(String placeId, String meId) {
        if (meId == null) {
            return;
        }
        LocalDate today = LocalDate.now();
        for (PlaceTip tip : tips.findAllByPlaceIdAndHiddenFalseAndCreatedAtAfterOrderByCreatedAtDesc(
                placeId, Instant.now().minus(FRESH))) {
            if (tip.isHidden() || meId.equals(tip.getUserId())) {
                continue;
            }
            if (views.existsByTipIdAndUserIdAndOnDate(tip.getId(), meId, today)) {
                continue;
            }
            views.save(new PlaceTipView(tip.getId(), meId, today));
        }
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

    /**
     * 한 줄과 별점을 남깁니다.
     *
     * <p><b>둘 중 하나만 써도 됩니다</b>(G-11). 별만 주고 싶은 사람도 있고
     * 할 말만 있는 사람도 있습니다. 둘 다 비면 남길 것이 없습니다.
     */
    @Transactional
    public PlaceTip add(AuthPrincipal me, String placeId, String text, Integer stars) {
        if (placeId == null || placeId.isBlank()) {
            throw ApiException.badRequest("어느 장소인지 알 수 없어요.");
        }
        if (stars != null && (stars < 1 || stars > 5)) {
            throw ApiException.badRequest("별점은 1에서 5까지예요.");
        }
        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty() && stars == null) {
            throw ApiException.badRequest("별점을 주거나 한 줄을 남겨 주세요.");
        }
        if (clean.length() > MAX_LENGTH) {
            throw ApiException.badRequest("한 줄 팁은 " + MAX_LENGTH + "자까지예요.");
        }
        if (tips.countByUserIdAndPlaceIdAndCreatedAtAfter(
                me.id(), placeId, Instant.now().minus(Duration.ofDays(1))) >= MAX_PER_DAY) {
            throw ApiException.badRequest("같은 곳에는 하루 " + MAX_PER_DAY + "번까지 남길 수 있어요.");
        }

        PlaceTip tip = tips.save(PlaceTip.builder()
                .placeId(placeId)
                .userId(me.id())
                .text(clean)
                .stars(stars)
                .build());
        audit.log(me.id(), "tip.add", tip.getId());
        return tip;
    }

    @Transactional
    public void remove(AuthPrincipal me, String tipId) {
        PlaceTip tip = tips.findById(tipId)
                .orElseThrow(() -> ApiException.notFound("팁을 찾을 수 없어요."));
        boolean mine = tip.getUserId().equals(me.id());
        if (!mine && me.role() != Role.ADMIN) {
            throw ApiException.forbidden("내가 남긴 것만 지울 수 있어요.");
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
                .orElseThrow(() -> ApiException.notFound("팁을 찾을 수 없어요."));
        if (tip.getUserId().equals(me.id())) {
            throw ApiException.badRequest("내가 남긴 것은 신고할 수 없어요.");
        }
        if (reports.existsByTipIdAndUserId(tipId, me.id())) {
            throw ApiException.badRequest("이미 신고했어요.");
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
                .orElseThrow(() -> ApiException.notFound("팁을 찾을 수 없어요."));
        tip.setHidden(hidden);
        audit.log(me.id(), hidden ? "tip.hide" : "tip.unhide", tipId);
    }

    public Card cardOf(PlaceTip tip, String meId) {
        return new Card(tip.getId(), tip.getText(), tip.getStars(), nameOf(tip.getUserId()),
                tip.getUserId().equals(meId), tip.getCreatedAt());
    }

    public String nameOf(String userId) {
        return users.findById(userId).map(User::getName).orElse("알 수 없음");
    }

    /**
     * @param mine  내가 남긴 것인지. 지울 수 있는지를 이걸로 정합니다
     * @param stars 별 1~5. 안 준 것은 비어 있습니다 — 0 이 아닙니다
     */
    public record Card(String id, String text, Integer stars, String authorName,
                       boolean mine, Instant createdAt) {
    }

    /**
     * 장소마다 우리 별점.
     *
     * <p>구글 평점과 나란히 둡니다. 다르면 그것이 정보입니다 — 구글 4.2 에
     * 우리 4.6 이면 「우리 같은 사람들은 더 좋게 봤다」는 말이고, 그 반대면
     * 「소문보다 별로」입니다.
     *
     * @param average 1.0~5.0. 소수 한 자리까지만 씁니다
     * @param count   몇 명이 줬는지. 수가 적으면 화면이 평균을 덜 믿게 적습니다
     */
    public record Stars(double average, int count) {
    }

    /** 장소마다 우리 별점. 기한이 없습니다 — 별점은 안 늙습니다. */
    @Transactional(readOnly = true)
    public Map<String, Stars> starsOf(Collection<String> placeIds) {
        if (placeIds.isEmpty()) {
            return Map.of();
        }
        Map<String, Stars> out = new HashMap<>();
        for (Object[] row : tips.starsOf(placeIds)) {
            double avg = ((Number) row[1]).doubleValue();
            /* 소수 한 자리. 4.666… 을 그대로 내려보내면 화면마다 다르게
               자릅니다. */
            out.put((String) row[0],
                    new Stars(Math.round(avg * 10) / 10.0, ((Number) row[2]).intValue()));
        }
        return out;
    }
}
