package net.weeniebeenie.fit.expense.domain;

import net.weeniebeenie.fit.expense.domain.Expense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, String> {

    List<Expense> findAllByTripIdOrderByCreatedAtAsc(String tripId);
}
