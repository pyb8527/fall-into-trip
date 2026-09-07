package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.trip.domain.TripMember;
import net.weeniebeenie.fit.trip.domain.TripMemberId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TripMemberRepository extends JpaRepository<TripMember, TripMemberId> {

    List<TripMember> findAllByIdTripId(String tripId);

    List<TripMember> findAllByIdUserId(String userId);

    Optional<TripMember> findByIdTripIdAndIdUserId(String tripId, String userId);

    void deleteByIdTripIdAndIdUserId(String tripId, String userId);
}
