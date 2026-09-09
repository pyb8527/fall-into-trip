package net.weeniebeenie.fit.community.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/** 댓글 신고 한 건. 한 사람이 한 댓글에 한 번. */
@Entity
@Table(name = "comment_reports")
@IdClass(CommentReport.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CommentReport {

    @Id
    @Column(name = "comment_id", length = 16)
    private String commentId;

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Column(length = 300)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public CommentReport(String commentId, String userId, String reason) {
        this.commentId = commentId;
        this.userId = userId;
        this.reason = reason;
        this.createdAt = Instant.now();
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String commentId;
        private String userId;
    }
}
