package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 챙길 것 하나.
 *
 * <p>누가 챙길지를 함께 적습니다. 그것이 없으면 목록이 "각자 알아서" 가 되고,
 * 그러면 어댑터가 셋이거나 없거나 둘 중 하나가 됩니다.
 *
 * <p>날짜에 매이지 않습니다. 떠나기 전에 챙기는 것이라 며칟날의 일이
 * 아닙니다.
 */
@Entity
@Table(name = "trip_items")
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class TripItem {

    @Id
    @Builder.Default
    private String id = Ids.next();

    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    @Column(nullable = false, length = 80)
    private String name;

    /** 누가 챙길지. 비어 있으면 아직 안 정한 것입니다. */
    @Column(name = "owner_id", length = 16)
    private String ownerId;

    @Column(nullable = false)
    @Builder.Default
    private boolean done = false;

    @Column(nullable = false)
    private int sort;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", nullable = false, length = 16)
    private String createdBy;
}
