package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.trip.domain.Visit;
import net.weeniebeenie.fit.trip.domain.VisitId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VisitRepository extends JpaRepository<Visit, VisitId> {

    /**
     * 이 여행에서 남긴 것 전부.
     *
     * <p><b>사람을 안 가립니다.</b> 같은 일정을 같이 다녔으니 서로 무엇을
     * 남겼는지 볼 수 있어야 합니다 — 안 보이면 셋이 간 여행의 기록이 셋으로
     * 흩어져 아무 데도 온전한 것이 없습니다.
     */
    @Query("""
           SELECT v FROM Visit v
           WHERE v.id.placeId IN (
                 SELECT p.id FROM Place p
                 WHERE p.dayId IN (SELECT d.id FROM Day d WHERE d.tripId = :tripId))
           """)
    List<Visit> findAllOfTrip(@Param("tripId") String tripId);

    /**
     * 이 사람이 찍은 도장 전부.
     *
     * <p>글을 올릴 때 씁니다 — 올리는 날짜가 여행의 일부일 수 있어서 여행
     * 번호로 좁히면 고른 날 밖의 도장이 빠집니다. 부르는 쪽이 장소 번호로
     * 다시 거릅니다.
     */
    List<Visit> findAllByIdUserId(String userId);
}
