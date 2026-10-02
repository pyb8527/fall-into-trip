package net.weeniebeenie.fit.feed.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, String> {

    /**
     * 한 그룹의 피드.
     *
     * <p>태그를 주면 그것이 달린 글만. 빈 글이면 전부입니다 — 「안 거름」을
     * null 로 두면 질의가 두 벌이 됩니다.
     *
     * <p>태그가 있는지는 {@code array_position(...) > 0} 으로 묻습니다.
     * {@code IS NOT NULL} 로 물으면 <b>안 걸러집니다</b> — 하이버네이트가
     * 모르는 함수의 값을 못 비어 있는 int 로 보고 {@code coalesce(..., 0)}
     * 으로 감싸서, 그 값이 영영 NULL 이 아니게 됩니다. 없으면 0, 있으면
     * 1부터이므로 {@code > 0} 은 감싸든 안 감싸든 맞습니다.
     */
    @Query("""
           SELECT p FROM Post p
           WHERE p.groupId = :groupId
             AND p.hidden = false
             AND (:tag = '' OR FUNCTION('array_position', p.tags, :tag) > 0)
           ORDER BY p.createdAt DESC
           """)
    Page<Post> ofGroup(@Param("groupId") String groupId,
                       @Param("tag") String tag,
                       Pageable pageable);

    /** 내가 올린 것 전부 — 그룹에 올린 것도 함께입니다. */
    @Query("""
           SELECT p FROM Post p
           WHERE p.authorId = :authorId
             AND p.hidden = false
             AND (:tag = '' OR FUNCTION('array_position', p.tags, :tag) > 0)
           ORDER BY p.createdAt DESC
           """)
    Page<Post> ofAuthor(@Param("authorId") String authorId,
                        @Param("tag") String tag,
                        Pageable pageable);

    /**
     * 한 사람이 <b>이 모임들에</b> 올린 것. 남의 페이지의 피드 칸이 씁니다.
     *
     * <p>모임 번호가 비어 있는 글(그룹 없이 올린 내 피드)은 안 걸립니다 —
     * {@code IN} 이 null 과 같지 않습니다. 그 글은 올린 사람만 보는 자리입니다.
     */
    @Query("""
           SELECT p FROM Post p
           WHERE p.authorId = :authorId
             AND p.groupId IN :groupIds
             AND p.hidden = false
             AND (:tag = '' OR FUNCTION('array_position', p.tags, :tag) > 0)
           ORDER BY p.createdAt DESC
           """)
    Page<Post> ofAuthorIn(@Param("authorId") String authorId,
                          @Param("groupIds") java.util.Collection<String> groupIds,
                          @Param("tag") String tag,
                          Pageable pageable);

    /** 그 여행에 붙은 글들. 여행기에 실을 것을 고를 때도 씁니다. */
    List<Post> findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(String tripId);

    long countByAuthorId(String authorId);

    /** 그룹을 지울 때 댓글을 먼저 치우려고 번호만 걷습니다. */
    @Query("SELECT p.id FROM Post p WHERE p.groupId = :groupId")
    List<String> idsOfGroup(@Param("groupId") String groupId);

    /** 운영자가 봐야 할 것 — 감춰진 글. */
    Page<Post> findAllByHiddenTrueOrderByCreatedAtDesc(Pageable pageable);
}
