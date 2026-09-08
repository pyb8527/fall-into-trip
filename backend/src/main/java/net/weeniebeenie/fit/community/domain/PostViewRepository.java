package net.weeniebeenie.fit.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface PostViewRepository extends JpaRepository<PostView, PostView.Key> {

    boolean existsByPostIdAndUserIdAndOnDate(String postId, String userId, LocalDate onDate);
}
