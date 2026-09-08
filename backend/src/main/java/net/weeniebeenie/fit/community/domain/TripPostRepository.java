package net.weeniebeenie.fit.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TripPostRepository extends JpaRepository<TripPost, String> {

    Page<TripPost> findAllByHiddenFalseOrderByCreatedAtDesc(Pageable pageable);

    Page<TripPost> findAllByHiddenFalseOrderByLikeCountDescCreatedAtDesc(Pageable pageable);

    Page<TripPost> findAllByAuthorIdOrderByCreatedAtDesc(String authorId, Pageable pageable);

    /**
     * 인기 순.
     *
     * <p>추천만으로 줄을 세우면 오래된 글이 영영 위에 남습니다. 새 글은 아무리
     * 좋아도 이미 쌓인 표를 따라잡지 못해, 게시판이 한 번 굳으면 다시 움직이지
     * 않습니다.
     *
     * <p>그래서 나이로 나눕니다. 같은 추천 수라면 최근 글이 위로 옵니다. 분모의
     * 2는 갓 올린 글이 0으로 나뉘어 튀는 것을 막고, 1.5제곱은 하루 이틀 지난
     * 글이 자연스럽게 내려가는 기울기입니다.
     *
     * <p>조회수는 넣지 않았습니다. 조회는 제목이 자극적이면 올라가지만 추천은
     * 끝까지 읽어야 누릅니다. 둘을 섞으면 자극적인 제목이 이깁니다.
     */
    @Query(value = """
           SELECT * FROM trip_posts p
           WHERE p.hidden = false
           ORDER BY (p.like_count + 1)
                    / POWER(EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600 + 2, 1.5) DESC,
                    p.created_at DESC
           """,
           countQuery = "SELECT count(*) FROM trip_posts WHERE hidden = false",
           nativeQuery = true)
    Page<TripPost> findHot(Pageable pageable);

    /**
     * 운영자가 봐야 할 글.
     *
     * <p>신고가 들어온 글과 그래서 감춰진 글입니다. 감춰진 것이 먼저 옵니다 —
     * 지금 안 보이는 상태라 되돌릴지 말지를 먼저 정해야 합니다.
     */
    @Query("""
           SELECT p FROM TripPost p
           WHERE p.hidden = true
              OR EXISTS (SELECT 1 FROM PostReport r WHERE r.postId = p.id)
           ORDER BY p.hidden DESC, p.updatedAt DESC
           """)
    Page<TripPost> findNeedingReview(Pageable pageable);

    /*
      세어 둔 값은 읽고 쓰는 사이에 남이 끼어들 수 있습니다. 두 사람이 동시에
      추천하면 하나가 사라집니다. 데이터베이스가 직접 더하게 맡깁니다.
    */
    @Modifying
    @Query("UPDATE TripPost p SET p.likeCount = p.likeCount + :delta WHERE p.id = :id")
    void addLike(@Param("id") String id, @Param("delta") int delta);

    @Modifying
    @Query("UPDATE TripPost p SET p.viewCount = p.viewCount + 1 WHERE p.id = :id")
    void addView(@Param("id") String id);
}
