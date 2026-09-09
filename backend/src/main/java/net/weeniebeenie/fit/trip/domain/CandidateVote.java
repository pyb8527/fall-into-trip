package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/**
 * 후보 하나에 대한 한 사람의 표.
 *
 * <p>표를 아예 안 던진 것과 싫다고 한 것은 다릅니다. 안 던진 사람이 있으면
 * 아직 정해지지 않은 것이라, 없는 줄을 "싫다" 로 세면 안 됩니다.
 */
@Entity
@Table(name = "candidate_votes")
@IdClass(CandidateVote.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CandidateVote {

    @Id
    @Column(name = "candidate_id", length = 16)
    private String candidateId;

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Column(nullable = false)
    private boolean yes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public CandidateVote(String candidateId, String userId, boolean yes) {
        this.candidateId = candidateId;
        this.userId = userId;
        this.yes = yes;
        this.createdAt = Instant.now();
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String candidateId;
        private String userId;
    }
}
