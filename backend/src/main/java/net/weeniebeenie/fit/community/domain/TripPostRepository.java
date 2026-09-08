package net.weeniebeenie.fit.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TripPostRepository extends JpaRepository<TripPost, String> {

    Page<TripPost> findAllByAuthorIdOrderByCreatedAtDesc(String authorId, Pageable pageable);

    /**
     * 걸러 보기.
     *
     * <p>지역·기간·글자를 한 질의로 받습니다. 조건마다 메서드를 따로 두면
     * 조합이 늘 때마다 배로 늘어납니다. 비어 있는 조건은 통과시킵니다.
     *
     * <p>글자는 제목과 소개에서만 찾습니다. 일정 안쪽(장소 이름)까지 뒤지려면
     * jsonb 를 훑어야 하는데, 그건 인덱스가 안 먹어 글이 늘수록 느려집니다.
     */
    @Query("""
           SELECT p FROM TripPost p
           WHERE p.hidden = false
             AND (:region IS NULL OR p.region = :region)
             AND (:minDays IS NULL OR p.dayCount >= :minDays)
             AND (:maxDays IS NULL OR p.dayCount <= :maxDays)
             AND (:q IS NULL
                  OR LOWER(p.title) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(p.summary) LIKE LOWER(CONCAT('%', :q, '%')))
           """)
    Page<TripPost> search(@Param("region") String region,
                          @Param("minDays") Integer minDays,
                          @Param("maxDays") Integer maxDays,
                          @Param("q") String q,
                          Pageable pageable);

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
     *
     * <p>거르는 조건은 위 search 와 같아야 합니다. 정렬만 다르고 보는 범위가
     * 달라지면 띠를 바꿀 때마다 결과가 널뜁니다.
     *
     * <p>비어 있는 조건에 형을 붙여 둡니다. 네이티브 질의에서 값이 NULL 로만
     * 오면 PostgreSQL 이 그 자리의 형을 알 수 없다고 거절합니다.
     */
    @Query(value = """
           SELECT * FROM trip_posts p
           WHERE p.hidden = false
             AND (CAST(:region AS varchar) IS NULL OR p.region = CAST(:region AS varchar))
             AND (CAST(:minDays AS integer) IS NULL OR p.day_count >= CAST(:minDays AS integer))
             AND (CAST(:maxDays AS integer) IS NULL OR p.day_count <= CAST(:maxDays AS integer))
             AND (CAST(:q AS varchar) IS NULL
                  OR p.title ILIKE CONCAT('%', CAST(:q AS varchar), '%')
                  OR p.summary ILIKE CONCAT('%', CAST(:q AS varchar), '%'))
           ORDER BY (p.like_count + 1)
                    / POWER(EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600 + 2, 1.5) DESC,
                    p.created_at DESC
           """,
           countQuery = """
           SELECT count(*) FROM trip_posts p
           WHERE p.hidden = false
             AND (CAST(:region AS varchar) IS NULL OR p.region = CAST(:region AS varchar))
             AND (CAST(:minDays AS integer) IS NULL OR p.day_count >= CAST(:minDays AS integer))
             AND (CAST(:maxDays AS integer) IS NULL OR p.day_count <= CAST(:maxDays AS integer))
             AND (CAST(:q AS varchar) IS NULL
                  OR p.title ILIKE CONCAT('%', CAST(:q AS varchar), '%')
                  OR p.summary ILIKE CONCAT('%', CAST(:q AS varchar), '%'))
           """,
           nativeQuery = true)
    Page<TripPost> findHot(@Param("region") String region,
                           @Param("minDays") Integer minDays,
                           @Param("maxDays") Integer maxDays,
                           @Param("q") String q,
                           Pageable pageable);

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
