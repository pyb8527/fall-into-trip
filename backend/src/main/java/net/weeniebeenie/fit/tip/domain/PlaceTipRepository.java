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

    /**
     * 장소마다 우리 별점의 평균과 몇 명이 줬는지.
     *
     * <h3>여기에는 기한이 없습니다</h3>
     *
     * <p>팁 <b>글</b>은 이레가 지나면 안 보여 줍니다 — "지금 대기 40분" 은
     * 다음 날이면 쓸모가 없고 두 달 전 것은 사람을 잘못 이끕니다
     * ({@code TipService.FRESH}).
     *
     * <p><b>별점은 안 늙습니다.</b> 「이치란이 4.6」은 두 달 뒤에도 맞는
     * 말입니다. 같은 기한을 걸면 평균이 이레치 몇 명으로 셈되어 한 사람이
     * 들어올 때마다 크게 흔들리고, 그 전에 쌓인 것은 모두 사라집니다 —
     * 「쌓입니다」라고 적어 둔 뜻이 없어집니다.
     *
     * <p>감춰진 글은 뺍니다. 신고로 내린 글의 별이 평균에 남아 있으면
     * 내린 뜻이 없습니다.
     */
    @Query("""
           SELECT t.placeId, avg(t.stars), count(t) FROM PlaceTip t
           WHERE t.placeId IN :placeIds AND t.hidden = false AND t.stars IS NOT NULL
           GROUP BY t.placeId
           """)
    List<Object[]> starsOf(@Param("placeIds") Collection<String> placeIds);

    /** 내가 남긴 것들. 마이페이지의 「리뷰 11」과 내 리뷰 목록이 씁니다. */
    List<PlaceTip> findAllByUserIdAndHiddenFalseOrderByCreatedAtDesc(String userId);

    long countByUserIdAndHiddenFalseAndStarsIsNotNull(String userId);

    /** 운영자가 봐야 할 것 — 신고가 들어왔거나 그래서 감춰진 팁. */
    @Query("""
           SELECT t FROM PlaceTip t
           WHERE t.hidden = true
              OR EXISTS (SELECT 1 FROM TipReport r WHERE r.tipId = t.id)
           ORDER BY t.hidden DESC, t.createdAt DESC
           """)
    Page<PlaceTip> findNeedingReview(Pageable pageable);
}
