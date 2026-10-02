package net.weeniebeenie.fit.expense.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TripRateRepository extends JpaRepository<TripRate, TripRate.Key> {

    List<TripRate> findAllByTripId(String tripId);

    /**
     * 여러 여행의 환율을 한 번에.
     *
     * <p>가계부 목록이 씁니다. 여행 하나씩 물으면 여행 수만큼 왕복하는데,
     * 마흔 개를 가진 사람에게는 그것이 곧 마흔 번입니다.
     */
    List<TripRate> findAllByTripIdIn(List<String> tripIds);

    void deleteByTripIdAndCurrency(String tripId, String currency);
}
