package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.trip.domain.TripRole;

@Entity
@Table(name = "trip_members")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripMember {

    @EmbeddedId
    private TripMemberId id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TripRole role = TripRole.EDITOR;

    public TripMember(String tripId, String userId, TripRole role) {
        this.id = new TripMemberId(tripId, userId);
        this.role = role == null ? TripRole.EDITOR : role;
    }

    public String getTripId() {
        return id.getTripId();
    }

    public String getUserId() {
        return id.getUserId();
    }
}
