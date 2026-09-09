package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 가고 싶은 곳 후보.
 *
 * <p>일정에 바로 넣으면 아직 정하지도 않은 것이 확정처럼 보이고, 빼자고 말하기도
 * 어려워집니다. 후보로 올려 두고 각자 좋아요를 누른 뒤, 다 좋다고 한 것만
 * 일정으로 옮깁니다.
 */
@Entity
@Table(name = "trip_candidates")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripCandidate {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    @Column(name = "place_id", length = 255)
    private String placeId;

    @Column(length = 40)
    private String cat;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "added_by", nullable = false, length = 16)
    private String addedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Builder
    public TripCandidate(String tripId, String name, double lat, double lng,
                         String placeId, String cat, String note, String addedBy) {
        this.id = Ids.next();
        this.tripId = tripId;
        this.name = name;
        this.lat = lat;
        this.lng = lng;
        this.placeId = placeId;
        this.cat = cat;
        this.note = note;
        this.addedBy = addedBy;
        this.createdAt = Instant.now();
    }
}
