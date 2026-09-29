package net.weeniebeenie.fit.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PostCommentRepository extends JpaRepository<PostComment, String> {

    List<PostComment> findAllByPostIdAndHiddenFalseOrderByCreatedAtAsc(String postId);

    /**
     * 감춰진 것까지 전부.
     *
     * <p>장소를 뺄 때 댓글의 번호를 함께 옮기는 데 씁니다. 감춰진 것을 빼놓고
     * 옮기면, 운영자가 나중에 풀었을 때 그것만 엉뚱한 장소에 붙습니다.
     */
    List<PostComment> findAllByPostId(String postId);

    long countByPostIdAndHiddenFalse(String postId);

    long countByUserIdAndPostId(String userId, String postId);

    /** 운영자가 봐야 할 것 — 신고가 들어왔거나 그래서 감춰진 댓글. */
    @Query("""
           SELECT c FROM PostComment c
           WHERE c.hidden = true
              OR EXISTS (SELECT 1 FROM CommentReport r WHERE r.commentId = c.id)
           ORDER BY c.hidden DESC, c.createdAt DESC
           """)
    Page<PostComment> findNeedingReview(Pageable pageable);
}
