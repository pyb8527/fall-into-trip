package net.weeniebeenie.fit.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentReportRepository extends JpaRepository<CommentReport, CommentReport.Key> {

    boolean existsByCommentIdAndUserId(String commentId, String userId);

    long countByCommentId(String commentId);
}
