package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface DateOptionRepository extends JpaRepository<DateOption, String> {

    List<DateOption> findAllByTripIdOrderByStartIsoAsc(String tripId);

    /** 모임 달력이 여러 여행의 후보를 한 번에 받을 때 씁니다. */
    List<DateOption> findAllByTripIdIn(Collection<String> tripIds);

    boolean existsByTripIdAndStartIsoAndNights(String tripId, LocalDate startIso, int nights);

    long countByTripId(String tripId);
}
