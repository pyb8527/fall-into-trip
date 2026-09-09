package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * "나 지금 여기 카페임" — 잠깐 꽂아 두는 핀.
 *
 * <p>일정에 넣을 곳이 아니라 지금 있는 자리를 알리는 것이라 장소와 따로
 * 둡니다.
 *
 * <p>기한이 지나면 안 보입니다. 어제 꽂은 핀이 오늘 지도에 남아 있으면 거기
 * 있는 줄 압니다.
 */
@Entity
@Table(name = "trip_pins")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripPin {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    @Column(name = "user_id", nullable = false, length = 16)
    private String userId;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    @Column(length = 80)
    private String label;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Builder
    public TripPin(String tripId, String userId, double lat, double lng,
                   String label, Instant expiresAt) {
        this.id = Ids.next();
        this.tripId = tripId;
        this.userId = userId;
        this.lat = lat;
        this.lng = lng;
        this.label = label;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
    }
}
