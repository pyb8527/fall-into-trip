package net.weeniebeenie.fit.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PostCommentRepository extends JpaRepository<PostComment, String> {

    List<PostComment> findAllByPostIdAndHiddenFalseOrderByCreatedAtAsc(String postId);

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
