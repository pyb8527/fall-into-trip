package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

/** 여행 하나와 사람 하나. */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class TripGoingId implements Serializable {

    @Column(name = "trip_id", length = 16)
    private String tripId;

    @Column(name = "user_id", length = 16)
    private String userId;
}
