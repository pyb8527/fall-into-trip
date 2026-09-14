package net.weeniebeenie.fit.tip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface PlaceTipViewRepository extends JpaRepository<PlaceTipView, PlaceTipView.Key> {

    boolean existsByTipIdAndUserIdAndOnDate(String tipId, String userId, LocalDate onDate);
}
