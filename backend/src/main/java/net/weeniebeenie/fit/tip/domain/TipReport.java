package net.weeniebeenie.fit.tip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/** 팁 신고 한 건. 한 사람이 한 팁에 한 번. */
@Entity
@Table(name = "tip_reports")
@IdClass(TipReport.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TipReport {

    @Id
    @Column(name = "tip_id", length = 16)
    private String tipId;

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Column(length = 300)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public TipReport(String tipId, String userId, String reason) {
        this.tipId = tipId;
        this.userId = userId;
        this.reason = reason;
        this.createdAt = Instant.now();
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String tipId;
        private String userId;
    }
}
