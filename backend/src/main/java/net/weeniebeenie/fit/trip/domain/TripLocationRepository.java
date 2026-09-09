package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface TripLocationRepository extends JpaRepository<TripLocation, TripLocation.Key> {

    List<TripLocation> findAllByTripIdAndExpiresAtAfter(String tripId, Instant now);

    void deleteByTripIdAndUserId(String tripId, String userId);

    /** 기한이 지난 자리는 치웁니다. 안 보이는 채로 남겨 둘 이유가 없습니다. */
    @Modifying
    @Query("DELETE FROM TripLocation l WHERE l.tripId = :tripId AND l.expiresAt <= :now")
    void sweep(@Param("tripId") String tripId, @Param("now") Instant now);
}
