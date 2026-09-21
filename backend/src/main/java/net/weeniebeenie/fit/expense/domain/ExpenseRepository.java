package net.weeniebeenie.fit.expense.domain;

import net.weeniebeenie.fit.expense.domain.Expense;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, String> {

    List<Expense> findAllByTripIdOrderByCreatedAtAsc(String tripId);

    /**
     * 여행마다 얼마나 썼는지, 통화별로.
     *
     * <p>가계부 목록이 씁니다. 여행 하나씩 물으면 여행 수만큼 왕복하게
     * 되는데, 마흔 개를 가진 사람에게는 그것이 곧 마흔 번입니다.
     *
     * <p>통화를 합치지 않습니다. 엔과 원을 더하려면 "언제 환율로" 가
     * 남고, 그 답은 사람마다 다릅니다 — 정산 화면이 이미 같은 이유로
     * 통화마다 한 장씩 냅니다.
     */
    @Query("""
            SELECT e.tripId AS tripId, e.currency AS currency,
                   SUM(e.amount) AS total, COUNT(e) AS items
            FROM Expense e
            WHERE e.tripId IN :tripIds
            GROUP BY e.tripId, e.currency
            """)
    List<TripSpend> sumByTrip(@Param("tripIds") List<String> tripIds);

    /** 한 여행의 한 통화. */
    interface TripSpend {
        String getTripId();

        String getCurrency();

        long getTotal();

        long getItems();
    }

    long countByTripId(String tripId);
}
