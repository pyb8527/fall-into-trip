package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class TripMemberId implements Serializable {

    @Column(name = "trip_id", length = 16)
    private String tripId;

    @Column(name = "user_id", length = 16)
    private String userId;
}
