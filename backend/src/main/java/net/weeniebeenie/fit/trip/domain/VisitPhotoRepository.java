package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VisitPhotoRepository extends JpaRepository<VisitPhoto, VisitPhoto.Key> {

    List<VisitPhoto> findAllByUserIdAndPlaceIdOrderBySortAsc(String userId, String placeId);

    /** 이 여행에 붙은 사진 전부. 같이 간 사람 것까지입니다. */
    @Query("""
           SELECT vp FROM VisitPhoto vp
           WHERE vp.placeId IN (
                 SELECT p.id FROM Place p
                 WHERE p.dayId IN (SELECT d.id FROM Day d WHERE d.tripId = :tripId))
           ORDER BY vp.sort ASC
           """)
    List<VisitPhoto> findAllOfTrip(@Param("tripId") String tripId);

    /** 이 사진이 아직 어딘가에 붙어 있는지. 지울 때 봅니다. */
    List<VisitPhoto> findAllByPhotoId(String photoId);

    void deleteAllByUserIdAndPlaceId(String userId, String placeId);
}
