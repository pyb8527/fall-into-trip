package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.trip.domain.Trip;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TripRepository extends JpaRepository<Trip, String> {

    List<Trip> findAllByOrderByCreatedAtAsc();

    Optional<Trip> findFirstByOrderByCreatedAtAsc();
}
