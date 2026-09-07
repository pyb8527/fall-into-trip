package net.weeniebeenie.fit.admin.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.AuditView;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.PageView;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.StatsView;
import net.weeniebeenie.fit.admin.application.AdminAuditService;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * 감사 로그 조회와 운영 요약.
 *
 * <p>기간은 {@code from} 이상 {@code to} 미만으로 봅니다. 날짜만 준 경우
 * (예: {@code 2026-09-01}) 그날 0시(UTC)로 읽습니다.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminAuditController {

    private final AdminAuditService audits;

    @GetMapping("/audit")
    public PageView<AuditView> list(@CurrentUser AuthPrincipal me,
                                    @RequestParam(name = "userId", required = false) String userId,
                                    @RequestParam(name = "action", required = false) String action,
                                    @RequestParam(name = "target", required = false) String target,
                                    @RequestParam(name = "from", required = false) String from,
                                    @RequestParam(name = "to", required = false) String to,
                                    @RequestParam(name = "page", defaultValue = "0") int page,
                                    @RequestParam(name = "size", defaultValue = "20") int size) {

        Page<AuditView> found = audits.search(me, userId, action, target,
                parseInstant(from, "from"), parseInstant(to, "to"),
                PageRequest.of(Math.max(page, 0), AdminPaging.size(size),
                        Sort.by(Sort.Direction.DESC, "at")));

        return PageView.of(found, Function.identity());
    }

    /** 필터로 고를 수 있는 활동 종류. */
    @GetMapping("/audit/actions")
    public Map<String, List<String>> actions(@CurrentUser AuthPrincipal me) {
        return Map.of("actions", audits.actions(me));
    }

    @GetMapping("/stats")
    public StatsView stats(@CurrentUser AuthPrincipal me) {
        return audits.stats(me);
    }

    /**
     * {@code 2026-09-01} 과 {@code 2026-09-01T09:30:00Z} 를 모두 받습니다.
     *
     * 화면에서는 날짜만 고르는 편이고, 다른 도구로 정확한 시각을 넣는 일도
     * 있습니다. 둘 중 하나만 받으면 나머지 쪽이 조용히 빈 결과를 냅니다.
     */
    private static Instant parseInstant(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            /* 날짜만 온 경우로 보고 다시 시도합니다. */
        }
        try {
            return LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest(field + " 의 날짜 형식이 올바르지 않습니다: " + raw);
        }
    }
}
