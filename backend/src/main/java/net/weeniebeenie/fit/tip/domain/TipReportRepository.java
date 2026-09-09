package net.weeniebeenie.fit.tip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TipReportRepository extends JpaRepository<TipReport, TipReport.Key> {

    boolean existsByTipIdAndUserId(String tipId, String userId);

    long countByTipId(String tipId);
}
