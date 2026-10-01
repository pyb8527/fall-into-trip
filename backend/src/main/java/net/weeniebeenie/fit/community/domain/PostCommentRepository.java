package net.weeniebeenie.fit.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PostCommentRepository extends JpaRepository<PostComment, String> {

    List<PostComment> findAllByPostIdAndKindAndHiddenFalseOrderByCreatedAtAsc(
            String postId, CommentKind kind);

    /**
     * 감춰진 것까지 전부.
     *
     * <p>장소를 뺄 때 댓글의 번호를 함께 옮기는 데 씁니다. 감춰진 것을 빼놓고
     * 옮기면, 운영자가 나중에 풀었을 때 그것만 엉뚱한 장소에 붙습니다.
     */
    List<PostComment> findAllByPostId(String postId);

    long countByPostIdAndKindAndHiddenFalse(String postId, CommentKind kind);

    long countByUserIdAndPostId(String userId, String postId);

    /**
     * 글 하나에 달린 것 전부. 글을 지울 때 함께 치웁니다.
     *
     * <p>{@code post_id} 에 외래키가 없어서 DB 가 안 해 줍니다
     * ({@link CommentKind}). 감춰진 것까지 지웁니다 — 글이 없는데 댓글만
     * 남아 운영 화면에 뜨면 열어 볼 글이 없습니다.
     */
    void deleteAllByPostId(String postId);

    /** 여러 글의 것을 한 번에. 그룹을 지울 때 그 안의 글들을 치웁니다. */
    void deleteAllByPostIdIn(List<String> postIds);

    /** 글마다 몇 개인지. 목록에서 글마다 묻지 않으려고 둡니다. */
    @Query("""
           SELECT c.postId, COUNT(c) FROM PostComment c
           WHERE c.postId IN :postIds AND c.kind = :kind AND c.hidden = false
           GROUP BY c.postId
           """)
    List<Object[]> countsOf(@org.springframework.data.repository.query.Param("postIds")
                            List<String> postIds,
                            @org.springframework.data.repository.query.Param("kind")
                            CommentKind kind);

    /** 운영자가 봐야 할 것 — 신고가 들어왔거나 그래서 감춰진 댓글. */
    @Query("""
           SELECT c FROM PostComment c
           WHERE c.hidden = true
              OR EXISTS (SELECT 1 FROM CommentReport r WHERE r.commentId = c.id)
           ORDER BY c.hidden DESC, c.createdAt DESC
           """)
    Page<PostComment> findNeedingReview(Pageable pageable);
}
