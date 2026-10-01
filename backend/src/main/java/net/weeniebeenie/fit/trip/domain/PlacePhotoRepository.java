package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlacePhotoRepository extends JpaRepository<PlacePhoto, PlacePhoto.Key> {

    List<PlacePhoto> findAllByPlaceIdOrderBySortAsc(String placeId);

    /** 이 여행에 챙겨 둔 사진 전부. */
    @Query("""
           SELECT pp FROM PlacePhoto pp
           WHERE pp.placeId IN (
                 SELECT p.id FROM Place p
                 WHERE p.dayId IN (SELECT d.id FROM Day d WHERE d.tripId = :tripId))
           ORDER BY pp.sort ASC
           """)
    List<PlacePhoto> findAllOfTrip(@Param("tripId") String tripId);

    /** 이 사진이 아직 어딘가에 붙어 있는지. 지울 때 봅니다. */
    List<PlacePhoto> findAllByPhotoId(String photoId);

    void deleteAllByPlaceId(String placeId);
}
