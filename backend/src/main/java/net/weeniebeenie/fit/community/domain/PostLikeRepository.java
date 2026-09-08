package net.weeniebeenie.fit.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PostLikeRepository extends JpaRepository<PostLike, PostLike.Key> {

    boolean existsByPostIdAndUserId(String postId, String userId);

    void deleteByPostIdAndUserId(String postId, String userId);

    /** 목록에서 "내가 누른 것" 을 한 번에 표시하기 위해. */
    @Query("SELECT l.postId FROM PostLike l WHERE l.userId = :userId AND l.postId IN :postIds")
    List<String> minesIn(@Param("userId") String userId,
                         @Param("postIds") Collection<String> postIds);
}
