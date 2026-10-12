package net.weeniebeenie.fit.expense.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SettlePaymentRepository extends JpaRepository<SettlePayment, String> {

    List<SettlePayment> findAllByTripIdOrderByConfirmedAtAsc(String tripId);
}
