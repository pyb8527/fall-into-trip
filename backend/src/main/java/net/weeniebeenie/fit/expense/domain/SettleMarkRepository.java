package net.weeniebeenie.fit.expense.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SettleMarkRepository extends JpaRepository<SettleMark, SettleMark.Key> {

    List<SettleMark> findAllByTripId(String tripId);
}
