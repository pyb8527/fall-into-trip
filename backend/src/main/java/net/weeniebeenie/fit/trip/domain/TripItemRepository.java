package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TripItemRepository extends JpaRepository<TripItem, String> {

    List<TripItem> findAllByTripIdOrderBySortAscCreatedAtAsc(String tripId);

    long countByTripId(String tripId);
}
