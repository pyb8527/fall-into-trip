package net.weeniebeenie.fit.tip.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface PlaceTipRepository extends JpaRepository<PlaceTip, String> {

    /**
     * 한 장소의 최근 팁.
     *
     * <p>오래된 것은 값이 없습니다. "지금 대기 40분" 은 어제 것도 이미 쓸모가
     * 없고, 두 달 전 것은 사람을 잘못 이끕니다.
     */
    List<PlaceTip> findAllByPlaceIdAndHiddenFalseAndCreatedAtAfterOrderByCreatedAtDesc(
            String placeId, Instant since);

    /** 여러 장소의 팁 수를 한 번에. 장소마다 물으면 그 수만큼 질의가 붙습니다. */
    @Query("""
           SELECT t.placeId, count(t) FROM PlaceTip t
           WHERE t.placeId IN :placeIds AND t.hidden = false AND t.createdAt > :since
           GROUP BY t.placeId
           """)
    List<Object[]> countsOf(@Param("placeIds") Collection<String> placeIds,
                            @Param("since") Instant since);

    long countByUserIdAndPlaceIdAndCreatedAtAfter(String userId, String placeId, Instant since);

    /** 운영자가 봐야 할 것 — 신고가 들어왔거나 그래서 감춰진 팁. */
    @Query("""
           SELECT t FROM PlaceTip t
           WHERE t.hidden = true
              OR EXISTS (SELECT 1 FROM TipReport r WHERE r.tipId = t.id)
           ORDER BY t.hidden DESC, t.createdAt DESC
           """)
    Page<PlaceTip> findNeedingReview(Pageable pageable);
}
