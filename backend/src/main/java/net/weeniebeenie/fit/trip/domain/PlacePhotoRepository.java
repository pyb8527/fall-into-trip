package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlacePhotoRepository extends JpaRepository<PlacePhoto, PlacePhoto.Key> {

    List<PlacePhoto> findAllByPlaceIdOrderBySortAsc(String placeId);

    /** 여러 장소의 것을 한 번에. 여행기에 실을 사진을 고를 때 씁니다. */
    List<PlacePhoto> findAllByPlaceIdInOrderByPlaceIdAscSortAsc(List<String> placeIds);

    /** 이 여행에 챙겨 둔 사진 전부. */
    @Query("""
           SELECT pp FROM PlacePhoto pp
           WHERE pp.placeId IN (
                 SELECT p.id FROM Place p
                 WHERE p.dayId IN (SELECT d.id FROM Day d WHERE d.tripId = :tripId))
           ORDER BY pp.sort ASC
           """)
    List<PlacePhoto> findAllOfTrip(@Param("tripId") String tripId);

    /**
     * 여행마다 <b>일정 차례로 가장 앞에 놓인 사진 한 장</b>.
     *
     * <h3>왜 한 번에 묻는가</h3>
     *
     * <p>여행 목록이 씁니다. 여행마다 따로 물으면 목록 한 번에 여행 수만큼
     * 왕복하고, 그것이 목록을 느리게 만드는 가장 흔한 꼴입니다.
     *
     * <h3>왜 {@code DISTINCT ON} 인가</h3>
     *
     * <p>필요한 것이 여행마다 <b>첫 줄 하나</b>인데, JPQL 에는 묶음마다 하나만
     * 집는 말이 없습니다. 사진 전부를 받아 와 코드에서 첫 장만 고르는 길도
     * 있지만, 그러면 쓰지도 않을 수백 줄이 DB 와 메모리를 지나갑니다.
     * PostgreSQL 의 {@code DISTINCT ON} 은 정렬한 뒤 묶음의 첫 줄만 남깁니다 —
     * 여행 수만큼의 줄로 끝납니다.
     *
     * <p>차례는 일정을 읽는 차례입니다 — 첫날, 그 날의 첫 장소, 그 장소의 첫
     * 사진. 올린 시각 순으로 두면 「첫 사진」이 아니라 「마지막에 올린 사진」이
     * 됩니다.
     *
     * @param tripIds 비어 있으면 부르지 마세요 — {@code IN ()} 은 SQL 이 아닙니다
     * @return {@code (여행 번호, 사진 번호)} 한 줄씩. 사진이 없는 여행은 안 나옵니다
     */
    @Query(value = """
           SELECT DISTINCT ON (d.trip_id) d.trip_id, pp.photo_id
           FROM place_photos pp
           JOIN places pl ON pl.id = pp.place_id
           JOIN days d ON d.id = pl.day_id
           WHERE d.trip_id IN (:tripIds)
           ORDER BY d.trip_id, d.sort, pl.sort, pp.sort
           """, nativeQuery = true)
    List<Object[]> firstPhotoOfTrips(@Param("tripIds") java.util.Collection<String> tripIds);

    /** 이 사진이 아직 어딘가에 붙어 있는지. 지울 때 봅니다. */
    List<PlacePhoto> findAllByPhotoId(String photoId);

    void deleteAllByPlaceId(String placeId);
}
