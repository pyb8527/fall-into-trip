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

    /**
     * 목록에서 이 여행을 가리키는 색.
     *
     * <p>안 정했으면 비어 있습니다. 기본값을 억지로 주지 않습니다 — 그러면
     * 정한 것과 안 정한 것을 구별할 수 없고, 정하는 일 자체가 뜻을 잃습니다.
     *
     * <p>고를 수 있는 것은 {@link DayLabels#COLORS} 여덟 가지뿐입니다.
     * 아무 색이나 받으면 흰 글씨가 안 읽히는 색과 코랄에 붙는 색이 들어옵니다.
     */
    @Column(length = 7)
    private String theme;

    /** 이름 앞에 붙는 표식 하나. 안 정했으면 비어 있습니다. */
    @Column(length = 16)
    private String emoji;

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
