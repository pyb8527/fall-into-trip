package net.weeniebeenie.fit.community.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/** 추천 한 번. 한 사람이 한 글에 하나뿐이라 두 값이 곧 열쇠입니다. */
@Entity
@Table(name = "trip_post_likes")
@IdClass(PostLike.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PostLike {

    @Id
    @Column(name = "post_id", length = 16)
    private String postId;

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public PostLike(String postId, String userId) {
        this.postId = postId;
        this.userId = userId;
        this.createdAt = Instant.now();
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String postId;
        private String userId;
    }
}
