package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** 후보 하나에 한 사람이 단 답. 줄이 없으면 아직 안 답한 것입니다. */
@Entity
@Table(name = "date_answers")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DateAnswer {

    @EmbeddedId
    private DateAnswerId id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private DateChoice answer;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public DateAnswer(String optionId, String userId, DateChoice answer) {
        this.id = new DateAnswerId(optionId, userId);
        this.answer = answer;
        this.updatedAt = Instant.now();
    }
}
