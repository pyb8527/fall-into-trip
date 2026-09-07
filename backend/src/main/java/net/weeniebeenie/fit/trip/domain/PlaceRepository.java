package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.trip.domain.Place;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlaceRepository extends JpaRepository<Place, String> {

    List<Place> findAllByDayIdOrderBySortAsc(String dayId);

    List<Place> findAllByDayIdIn(List<String> dayIds);

    /** 여행 하나에 달린 장소를 날짜 순서대로 한 번에 가져옵니다. */
    @Query("""
           SELECT p FROM Place p
           WHERE p.dayId IN (SELECT d.id FROM Day d WHERE d.tripId = :tripId)
           ORDER BY p.sort ASC
           """)
    List<Place> findAllOfTrip(@Param("tripId") String tripId);

    @Query("""
           SELECT count(p) FROM Place p
           WHERE p.dayId IN (SELECT d.id FROM Day d WHERE d.tripId = :tripId)
           """)
    long countOfTrip(@Param("tripId") String tripId);
}
