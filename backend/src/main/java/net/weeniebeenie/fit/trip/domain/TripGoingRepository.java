package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TripGoingRepository extends JpaRepository<TripGoing, TripGoingId> {

    List<TripGoing> findAllByIdTripId(String tripId);

    /** 이 여행에서 「못 가요」라고 한 사람들. 셈에서 뺄 때 씁니다. */
    List<TripGoing> findAllByIdTripIdAndAnswer(String tripId, GoingAnswer answer);

    /** 이 사람이 「못 가요」라고 한 여행들. 캘린더 구독에서 뺄 때 씁니다. */
    List<TripGoing> findAllByIdUserIdAndAnswer(String userId, GoingAnswer answer);
}
