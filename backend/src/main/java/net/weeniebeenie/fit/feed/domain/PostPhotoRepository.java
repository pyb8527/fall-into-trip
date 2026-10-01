package net.weeniebeenie.fit.feed.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostPhotoRepository extends JpaRepository<PostPhoto, PostPhoto.Key> {

    List<PostPhoto> findAllByPostIdOrderBySortAsc(String postId);

    /** 여러 글의 사진을 한 번에. 목록에서 글마다 묻지 않으려고 둡니다. */
    List<PostPhoto> findAllByPostIdInOrderBySortAsc(List<String> postIds);

    /** 사진 한 장을 지울 때, 실려 있던 자리에서 뗍니다. */
    List<PostPhoto> findAllByPhotoId(String photoId);

    void deleteAllByPostId(String postId);
}
