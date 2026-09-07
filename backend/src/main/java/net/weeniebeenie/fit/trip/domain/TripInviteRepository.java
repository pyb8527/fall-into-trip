package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TripInviteRepository extends JpaRepository<TripInvite, String> {

    Optional<TripInvite> findByTokenHash(String tokenHash);

    List<TripInvite> findAllByTripIdOrderByCreatedAtDesc(String tripId);
}
