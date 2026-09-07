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
public class VisitId implements Serializable {

    @Column(name = "user_id", length = 16)
    private String userId;

    @Column(name = "place_id", length = 16)
    private String placeId;
}
