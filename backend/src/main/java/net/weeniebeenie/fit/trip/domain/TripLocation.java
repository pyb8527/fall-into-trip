package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/**
 * 지금 어디 있는지.
 *
 * <p>열쇠가 (여행, 사람)이라 한 사람당 <b>한 줄</b>입니다. 새 자리가 오면
 * 덮어씁니다. 줄을 쌓으면 그것은 다닌 자취가 되고, 자취는 우리가 들고 있을
 * 값이 아닙니다.
 *
 * <p>expiresAt 이 지나면 안 보입니다. 켠 것을 잊어도 계속 새어 나가지 않습니다.
 */
@Entity
@Table(name = "trip_locations")
@IdClass(TripLocation.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripLocation {

    @Id
    @Column(name = "trip_id", length = 16)
    private String tripId;

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    /** 이 반경 안쪽 어딘가라는 뜻. 미터. */
    private Double accuracy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    public TripLocation(String tripId, String userId) {
        this.tripId = tripId;
        this.userId = userId;
    }

    /** 자리를 갈아 끼우고 기한을 다시 셉니다. */
    public void moveTo(double lat, double lng, Double accuracy, Instant until) {
        this.lat = lat;
        this.lng = lng;
        this.accuracy = accuracy;
        this.updatedAt = Instant.now();
        this.expiresAt = until;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String tripId;
        private String userId;
    }
}
