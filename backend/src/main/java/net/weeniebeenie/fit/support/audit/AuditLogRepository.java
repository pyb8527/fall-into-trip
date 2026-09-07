package net.weeniebeenie.fit.support.audit;

import net.weeniebeenie.fit.support.audit.AuditLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findAllByOrderByAtDesc(Pageable pageable);
}
