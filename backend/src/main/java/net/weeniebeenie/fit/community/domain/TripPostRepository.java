package net.weeniebeenie.fit.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TripPostRepository extends JpaRepository<TripPost, String> {

    Page<TripPost> findAllByAuthorIdOrderByCreatedAtDesc(String authorId, Pageable pageable);

    /**
     * 내가 추천을 눌러 둔 글.
     *
     * <p>구경하다 마음에 든 것을 눌러 두고는 나중에 다시 찾지 못했습니다.
     * 추천은 세는 데만 쓰이고 되찾는 길이 없었습니다.
     *
     * <p>감춰진 글은 뺍니다. 눌러 둔 뒤 신고로 내려간 글이 목록에 남아 있으면
     * 눌렀을 때 없는 글이 됩니다.
     */
    @Query("""
           SELECT p FROM TripPost p
           WHERE p.hidden = false
             AND p.visibility = net.weeniebeenie.fit.community.domain.Visibility.LISTED
             AND p.id IN (SELECT l.postId FROM PostLike l WHERE l.userId = :userId)
           ORDER BY p.createdAt DESC
           """)
    Page<TripPost> likedBy(@Param("userId") String userId, Pageable pageable);

    /**
     * 걸러 보기.
     *
     * <p>지역·기간·글자를 한 질의로 받습니다. 조건마다 메서드를 따로 두면
     * 조합이 늘 때마다 배로 늘어납니다.
     *
     * <p><b>비어 있는 조건에도 NULL 을 보내지 않습니다.</b> 값이 NULL 로만 오면
     * PostgreSQL 이 그 자리의 형을 알 수 없다고 거절합니다. 그래서 "아무거나"
     * 를 뜻하는 값을 대신 넣습니다. 지역은 빈 문자열, 기간은 아무 날짜나 담는
     * 범위, 글자는 무엇에나 걸리는 %% 입니다.
     *
     * <p>소개가 비어 있는 글도 제목으로는 찾혀야 하므로 NULL 을 빈 문자열로
     * 바꿔 놓고 봅니다. NULL 은 LIKE 에서 참도 거짓도 아니라 그 줄이 통째로
     * 빠집니다.
     *
     * <p>글자는 제목·소개·태그에서 찾습니다. 일정 안쪽(장소 이름)까지 뒤지려면
     * jsonb 를 훑어야 하는데, 그건 인덱스가 안 먹어 글이 늘수록 느려집니다.
     *
     * <p>태그를 글자로도 찾는 까닭은, 고를 수 있게 내주는 태그가 <b>많이 쓰인
     * 것</b>뿐이라서입니다. 한두 번 쓰인 태그는 목록에 없으니 판에서는 고를 수
     * 없고, 그러면 그 태그를 단 글은 아무도 못 찾습니다. 태그를 잇고 한 줄로
     * 보므로 "온천" 을 치면 제목에 없어도 태그에 있으면 걸립니다.
     *
     * <p>태그는 <b>하나만</b> 받습니다. 여럿을 받으면 "그중 아무거나" 인지
     * "전부 다" 인지를 화면이 정해 줘야 하는데, 둘러보기에서 좁히는 일은
     * 대개 한 번이면 충분합니다. 필요해지면 그때 늘립니다.
     *
     * <p>array_position 을 씁니다 — 배열 안에 그 값이 있으면 자리를, 없으면
     * NULL 을 줍니다. JPQL 에는 배열을 다루는 말이 없어서 함수로 넘깁니다.
     */
    @Query("""
           SELECT p FROM TripPost p
           WHERE p.hidden = false
             AND p.visibility = net.weeniebeenie.fit.community.domain.Visibility.LISTED
             AND (:region = '' OR p.region = :region)
             AND (:tag = '' OR FUNCTION('array_position', p.tags, :tag) IS NOT NULL)
             AND p.dayCount >= :minDays
             AND p.dayCount <= :maxDays
             AND (LOWER(p.title) LIKE :pattern
                  OR LOWER(COALESCE(p.summary, '')) LIKE :pattern
                  OR LOWER(FUNCTION('array_to_string', p.tags, ' ')) LIKE :pattern)
           """)
    Page<TripPost> search(@Param("region") String region,
                          @Param("tag") String tag,
                          @Param("minDays") int minDays,
                          @Param("maxDays") int maxDays,
                          @Param("pattern") String pattern,
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
     */
    @Query(value = """
           SELECT * FROM trip_posts p
           WHERE p.hidden = false
             AND p.visibility = 'LISTED'
             AND (:region = '' OR p.region = :region)
             AND (:tag = '' OR array_position(p.tags, :tag) IS NOT NULL)
             AND p.day_count >= :minDays
             AND p.day_count <= :maxDays
             AND (LOWER(p.title) LIKE :pattern
                  OR LOWER(COALESCE(p.summary, '')) LIKE :pattern
                  OR LOWER(array_to_string(p.tags, ' ')) LIKE :pattern)
           ORDER BY (p.like_count + 1)
                    / POWER(EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600 + 2, 1.5) DESC,
                    p.created_at DESC
           """,
           countQuery = """
           SELECT count(*) FROM trip_posts p
           WHERE p.hidden = false
             AND p.visibility = 'LISTED'
             AND (:region = '' OR p.region = :region)
             AND (:tag = '' OR array_position(p.tags, :tag) IS NOT NULL)
             AND p.day_count >= :minDays
             AND p.day_count <= :maxDays
             AND (LOWER(p.title) LIKE :pattern
                  OR LOWER(COALESCE(p.summary, '')) LIKE :pattern
                  OR LOWER(array_to_string(p.tags, ' ')) LIKE :pattern)
           """,
           nativeQuery = true)
    Page<TripPost> findHot(@Param("region") String region,
                           @Param("tag") String tag,
                           @Param("minDays") int minDays,
                           @Param("maxDays") int maxDays,
                           @Param("pattern") String pattern,
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

    /**
     * 지금 쓰이고 있는 태그와 그 수.
     *
     * <p>배열을 줄로 펴서(unnest) 셉니다. 숨긴 글은 빼고요 — 내려간 글의
     * 태그가 목록에 남아 있으면 눌러도 아무것도 안 나옵니다.
     *
     * <p>많이 쓰인 순서입니다. 같은 수면 이름 순으로 — 새로 고칠 때마다
     * 차례가 바뀌면 방금 본 것을 다시 찾게 됩니다.
     */
    @Query(value = """
           SELECT t AS tag, count(*) AS posts
           FROM trip_posts p, unnest(p.tags) AS t
           WHERE p.hidden = false
             AND p.visibility = 'LISTED'
           GROUP BY t
           ORDER BY posts DESC, tag ASC
           LIMIT :limit
           """, nativeQuery = true)
    List<Object[]> tagCounts(@Param("limit") int limit);
}
