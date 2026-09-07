package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

@Entity
@Table(name = "trips")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Trip {

    @Id
    @Column(length = 16)
    private String id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "owner_id", nullable = false, length = 16)
    private String ownerId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Version
    @Column(nullable = false)
    private long version;

    @Builder
    public Trip(String title, String ownerId) {
        this.id = Ids.next();
        this.title = title;
        this.ownerId = ownerId;
        this.createdAt = Instant.now();
    }
}
