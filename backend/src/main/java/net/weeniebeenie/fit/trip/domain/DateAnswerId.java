package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

/** 후보 하나와 사람 하나. */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class DateAnswerId implements Serializable {

    @Column(name = "option_id", length = 16)
    private String optionId;

    @Column(name = "user_id", length = 16)
    private String userId;
}
