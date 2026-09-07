package net.weeniebeenie.fit.support.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.support.audit.AuditLog;
import net.weeniebeenie.fit.support.audit.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/** 누가 무엇을 했는지 남깁니다. 기록에 실패해도 본 작업을 막지는 않습니다. */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository repository;
    private final ObjectMapper mapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String userId, String action, String target, Map<String, ?> detail) {
        try {
            repository.save(AuditLog.builder()
                    .userId(userId)
                    .action(action)
                    .target(target)
                    .detail(detail == null ? null : mapper.writeValueAsString(detail))
                    .build());
        } catch (Exception e) {
            log.warn("감사 로그를 남기지 못했습니다: {} {}", action, target, e);
        }
    }

    public void log(String userId, String action, String target) {
        log(userId, action, target, null);
    }
}
