package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TripCandidateRepository extends JpaRepository<TripCandidate, String> {

    List<TripCandidate> findAllByTripIdOrderByCreatedAtAsc(String tripId);

    long countByTripId(String tripId);
}
