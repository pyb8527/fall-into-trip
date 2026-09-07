package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.trip.domain.Day;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DayRepository extends JpaRepository<Day, String> {

    List<Day> findAllByTripIdOrderBySortAsc(String tripId);

    long countByTripId(String tripId);
}
