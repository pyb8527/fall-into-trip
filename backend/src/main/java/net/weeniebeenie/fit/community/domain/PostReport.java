package net.weeniebeenie.fit.community.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/**
 * 신고 한 건.
 *
 * <p>댓글을 두지 않아 남이 쓴 글이 통째로 문제가 되는 경우만 남습니다.
 * 운영자가 감사 화면에서 보고 글을 내립니다.
 */
@Entity
@Table(name = "trip_post_reports")
@IdClass(PostReport.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PostReport {

    @Id
    @Column(name = "post_id", length = 16)
    private String postId;

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Column(length = 300)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public PostReport(String postId, String userId, String reason) {
        this.postId = postId;
        this.userId = userId;
        this.reason = reason;
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
