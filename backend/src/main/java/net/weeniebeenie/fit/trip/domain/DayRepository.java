package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.trip.domain.Day;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DayRepository extends JpaRepository<Day, String> {

    List<Day> findAllByTripIdOrderBySortAsc(String tripId);

    /** 그날에 해당하는 모든 여행의 날. 내일 일정을 미리 알릴 때 씁니다. */
    List<Day> findAllByIso(java.time.LocalDate iso);

    long countByTripId(String tripId);
}
