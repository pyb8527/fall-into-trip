package net.weeniebeenie.fit.admin.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.AuditView;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.StatsView;
import net.weeniebeenie.fit.expense.domain.ExpenseRepository;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripRepository;
import net.weeniebeenie.fit.support.audit.AuditLog;
import net.weeniebeenie.fit.support.audit.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 감사 로그 읽기.
 *
 * <p>쓰는 쪽은 {@link net.weeniebeenie.fit.support.audit.AuditService} 가
 * 맡고, 여기서는 읽기만 합니다. 운영자 말고는 아무도 볼 수 없어야 하므로
 * 모든 입구에서 {@link AdminGuard} 를 지납니다.
 */
@Service
@RequiredArgsConstructor
public class AdminAuditService {

    /** 요약에 얹을 상위 활동 개수. 너무 많이 보여 주면 오히려 눈에 안 들어옵니다. */
    private static final int TOP_ACTIONS = 5;

    /**
     * 기간을 안 고른 쪽에 넣어 줄 열린 끝.
     *
     * null 을 그대로 넘기면 PostgreSQL 이 시각 파라미터의 타입을 알아내지
     * 못해 조회가 실패합니다. 어차피 감사 로그는 이 서비스가 처음 뜬 뒤에만
     * 쌓이므로, 아래 두 값 밖에는 아무것도 없습니다.
     */
    private static final Instant OPEN_START = Instant.EPOCH;
    private static final Instant OPEN_END = Instant.parse("9999-12-31T00:00:00Z");

    private final AuditLogRepository auditLogs;
    private final UserRepository users;
    private final TripRepository trips;
    private final PlaceRepository places;
    private final ExpenseRepository expenses;
    private final ObjectMapper mapper;
    private final AdminGuard guard;

    @Transactional(readOnly = true)
    public Page<AuditView> search(AuthPrincipal me, String userId, String action, String target,
                                  Instant from, Instant to, Pageable pageable) {
        guard.requireAdmin(me);

        Page<AuditLog> page = auditLogs.search(
                blankToNull(userId), blankToNull(action), blankToNull(target),
                from == null ? OPEN_START : from,
                to == null ? OPEN_END : to,
                pageable);

        /* 줄마다 사람 이름을 물어보면 한 페이지에 스무 번을 묻게 됩니다.
           한 번에 모아 읽고 붙입니다. */
        List<String> ids = page.getContent().stream()
                .map(AuditLog::getUserId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        Map<String, String> names = ids.isEmpty()
                ? Map.of()
                : users.findAllById(ids).stream()
                        .collect(Collectors.toMap(User::getId, User::getName));

        return page.map(log -> AuditView.of(log, names.get(log.getUserId()), mapper));
    }

    /** 필터 드롭다운을 채웁니다. */
    @Transactional(readOnly = true)
    public List<String> actions(AuthPrincipal me) {
        guard.requireAdmin(me);
        return auditLogs.distinctActions();
    }

    /** 운영 첫 화면의 요약. */
    @Transactional(readOnly = true)
    public StatsView stats(AuthPrincipal me) {
        guard.requireAdmin(me);

        Instant since = Instant.now().minus(Duration.ofHours(24));
        Map<String, Long> top = new LinkedHashMap<>();
        for (Object[] row : auditLogs.countByActionSince(since, PageRequest.of(0, TOP_ACTIONS))) {
            top.put((String) row[0], ((Number) row[1]).longValue());
        }

        return new StatsView(
                users.count(),
                users.countByRole(Role.ADMIN),
                users.countByDisabledTrue(),
                trips.count(),
                places.count(),
                expenses.count(),
                auditLogs.countByAtAfter(since),
                top);
    }

    private static String blankToNull(String raw) {
        return (raw == null || raw.isBlank()) ? null : raw.trim();
    }
}
