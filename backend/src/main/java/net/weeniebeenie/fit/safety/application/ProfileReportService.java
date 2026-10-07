package net.weeniebeenie.fit.safety.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.safety.domain.ProfileReport;
import net.weeniebeenie.fit.safety.domain.ProfileReportRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * 프로필 신고 — 이름 · 한 줄 소개 · 얼굴 사진.
 *
 * <h3>세 사람이면 소개와 사진을 감춥니다</h3>
 *
 * <p>여행기 · 댓글 · 팁과 같은 수입니다. 혼자 운영하는 서비스라 확인까지 몇
 * 시간이 걸릴 수 있는데, 그동안 문제되는 사진이 모임 사람들 화면에 걸려 있으면
 * 안 됩니다.
 *
 * <p><b>이름은 안 감춥니다.</b> 이름까지 비우면 모임 안에서 누가 누구인지
 * 모르게 되고, 일정 · 가계부의 「누가」 칸이 깨집니다. 이름에 든 욕은 올릴 때
 * 이미 막습니다({@code BadWords}).
 *
 * <h3>감춤을 칸으로 두지 않습니다</h3>
 *
 * <p>신고 줄의 <b>수</b>가 곧 감춤입니다({@link #held}). 운영자가 「괜찮다」고
 * 하면 줄을 지우고({@link #clear}), 그러면 저절로 다시 보입니다. 칸을 따로
 * 두면 그 칸과 줄이 어긋나는 날이 옵니다.
 */
@Service
@RequiredArgsConstructor
public class ProfileReportService {

    /** 서로 다른 사람이 이만큼 신고하면 사람이 볼 때까지 소개와 사진을 감춥니다. */
    static final long HOLD_AT_REPORTS = 3;

    private final ProfileReportRepository reports;
    private final UserRepository users;
    private final AuditService audit;

    @Transactional
    public void report(AuthPrincipal me, String userId, String reason) {
        if (me.id().equals(userId)) {
            throw ApiException.badRequest("나는 신고할 수 없어요.");
        }
        if (!users.existsById(userId)) {
            throw ApiException.notFound("찾을 수 없어요.");
        }
        if (reports.existsByUserIdAndReporterId(userId, me.id())) {
            throw ApiException.badRequest("이미 신고했어요.");
        }
        reports.save(new ProfileReport(userId, me.id(),
                reason == null || reason.isBlank() ? null : reason.trim()));
        audit.log(me.id(), "profile.report", userId);
    }

    /** 소개와 사진을 남에게 감출 때인가. */
    @Transactional(readOnly = true)
    public boolean held(String userId) {
        return reports.countByUserId(userId) >= HOLD_AT_REPORTS;
    }

    /* ------------------------------------------------------------- 운영 */

    @Transactional(readOnly = true)
    public Page<Row> needingReview(Pageable pageable) {
        return reports.needingReview(pageable).map(r -> {
            String userId = (String) r[0];
            long count = ((Number) r[1]).longValue();
            User u = users.findById(userId).orElse(null);
            List<String> reasons = reports.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                    .map(ProfileReport::getReason)
                    .filter(s -> s != null && !s.isBlank())
                    .toList();
            return new Row(userId,
                    u == null ? "알 수 없음" : u.getName(),
                    u == null ? null : u.getBio(),
                    u == null ? null : u.getPhotoId(),
                    count, count >= HOLD_AT_REPORTS, reasons, (Instant) r[2]);
        });
    }

    /**
     * 괜찮다고 보고 신고를 거둡니다. 감춰져 있었으면 다시 보입니다.
     *
     * <p>몇 사람이 짜고 신고하면 멀쩡한 프로필도 비워집니다 — 되살릴 수
     * 없으면 신고가 곧 지우기가 됩니다.
     */
    @Transactional
    public void clear(AuthPrincipal me, String userId) {
        reports.deleteAllOf(userId);
        audit.log(me.id(), "profile.clear", userId);
    }

    /**
     * 문제가 맞다고 보고 소개와 사진을 비웁니다. 신고도 함께 거둡니다.
     *
     * <p>사진 파일은 안 지웁니다 — 그 사람의 보관함에 남고, 얼굴 자리에서만
     * 떨어집니다. 이름은 두는데, 이름은 올릴 때 이미 거릅니다.
     *
     * <p>신고를 거두는 까닭은 비운 뒤에도 감춤이 남지 않게 하려는 것입니다 —
     * 남아 있으면 그 사람이 새로 적은 멀쩡한 소개도 계속 감춰집니다.
     */
    @Transactional
    public void wipe(AuthPrincipal me, String userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("찾을 수 없어요."));
        user.setBio(null);
        user.setPhotoId(null);
        reports.deleteAllOf(userId);
        audit.log(me.id(), "profile.wipe", userId);
    }

    /**
     * 운영 화면 한 줄.
     *
     * @param held    감춰져 있는지 — 세 건이 넘었는지
     * @param reasons 신고하며 적은 까닭. 비워 보낸 것은 뺍니다
     */
    public record Row(String userId, String name, String bio, String photoId,
                      long reportCount, boolean held, List<String> reasons, Instant lastAt) {
    }
}
