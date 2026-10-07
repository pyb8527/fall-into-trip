package net.weeniebeenie.fit.feed.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/**
 * 피드 글 신고 한 건. 한 사람이 한 글에 한 번.
 *
 * <p>여행기({@code PostReport}) · 팁({@code TipReport})과 같은 꼴입니다. 표가
 * 다른 까닭은 글이 다른 표에 있어서입니다 — {@code posts} 와
 * {@code trip_posts} 는 이름만 닮았습니다.
 */
@Entity
@Table(name = "feed_reports")
@IdClass(FeedReport.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FeedReport {

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

    public FeedReport(String postId, String userId, String reason) {
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
