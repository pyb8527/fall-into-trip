package net.weeniebeenie.fit.safety.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/** 프로필 신고 한 건. 한 사람이 한 사람에게 한 번. */
@Entity
@Table(name = "profile_reports")
@IdClass(ProfileReport.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProfileReport {

    /** 신고당한 사람. */
    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Id
    @Column(name = "reporter_id", length = 16)
    private String reporterId;

    @Column(length = 300)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public ProfileReport(String userId, String reporterId, String reason) {
        this.userId = userId;
        this.reporterId = reporterId;
        this.reason = reason;
        this.createdAt = Instant.now();
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String userId;
        private String reporterId;
    }
}
