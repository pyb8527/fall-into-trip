package net.weeniebeenie.fit.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PostReportRepository extends JpaRepository<PostReport, PostReport.Key> {

    boolean existsByPostIdAndUserId(String postId, String userId);

    long countByPostId(String postId);
}
