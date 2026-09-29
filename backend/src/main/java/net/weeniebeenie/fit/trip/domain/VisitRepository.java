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

    /**
     * 도장 줄 통째로.
     *
     * <p>사진·별점·한 줄이 붙으면서 "다녀왔다" 만으로는 모자라게 됐습니다.
     * 번호만 세는 쪽(위)은 그대로 둡니다 — 여행 중 화면은 몇 군데 찍었는지만
     * 보는 자리가 있고, 그때 사진까지 읽어 올 이유가 없습니다.
     */
    @Query("""
           SELECT v FROM Visit v
           WHERE v.id.userId = :userId
             AND v.id.placeId IN (
                 SELECT p.id FROM Place p
                 WHERE p.dayId IN (SELECT d.id FROM Day d WHERE d.tripId = :tripId))
           """)
    List<Visit> findAllOfTrip(@Param("userId") String userId, @Param("tripId") String tripId);

    /**
     * 이 사람이 찍은 도장 전부.
     *
     * <p>글을 올릴 때 씁니다 — 올리는 날짜가 여행의 일부일 수 있어서 여행
     * 번호로 좁히면 고른 날 밖의 도장이 빠집니다. 부르는 쪽이 장소 번호로
     * 다시 거릅니다.
     */
    List<Visit> findAllByIdUserId(String userId);
}
