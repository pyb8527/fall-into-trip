package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface TripPinRepository extends JpaRepository<TripPin, String> {

    List<TripPin> findAllByTripIdAndExpiresAtAfterOrderByCreatedAtDesc(String tripId, Instant now);

    long countByTripIdAndUserIdAndExpiresAtAfter(String tripId, String userId, Instant now);

    /**
     * 기한이 지난 핀을 치웁니다.
     *
     * <p>안 보이기만 하고 쌓아 두면 결국 자취가 됩니다. 다음에 그 여행을 열 때
     * 함께 치웁니다 — 따로 도는 일감을 두지 않아도 됩니다.
     */
    @Modifying
    @Query("DELETE FROM TripPin p WHERE p.tripId = :tripId AND p.expiresAt <= :now")
    void sweep(@Param("tripId") String tripId, @Param("now") Instant now);
}
