package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** 방문 체크는 사람마다 따로 남습니다. */
@Entity
@Table(name = "visits")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Visit {

    @EmbeddedId
    private VisitId id;

    @Column(name = "visited_at", nullable = false)
    private Instant visitedAt = Instant.now();

    public Visit(String userId, String placeId) {
        this.id = new VisitId(userId, placeId);
        this.visitedAt = Instant.now();
    }
}
