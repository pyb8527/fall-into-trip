package net.weeniebeenie.fit.feed.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedReportRepository extends JpaRepository<FeedReport, FeedReport.Key> {

    boolean existsByPostIdAndUserId(String postId, String userId);

    long countByPostId(String postId);
}
