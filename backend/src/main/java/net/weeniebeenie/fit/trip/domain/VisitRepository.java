package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.trip.domain.Visit;
import net.weeniebeenie.fit.trip.domain.VisitId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VisitRepository extends JpaRepository<Visit, VisitId> {

    /** 내가 다녀온 곳만. 방문 체크는 사람마다 따로입니다. */
    @Query("""
           SELECT v.id.placeId FROM Visit v
           WHERE v.id.userId = :userId
             AND v.id.placeId IN (
                 SELECT p.id FROM Place p
                 WHERE p.dayId IN (SELECT d.id FROM Day d WHERE d.tripId = :tripId))
           """)
    List<String> findPlaceIdsOfTrip(@Param("userId") String userId, @Param("tripId") String tripId);
}
