package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 날짜 후보 하나 — 「10월 3일부터 2박」.
 *
 * <p>확정해도 지우지 않습니다. 확정된 날에 「안 돼요」였던 사람에게
 * 「못 가요로 바꿀까요?」를 물어야 하는데, 후보와 답이 남아 있어야 그
 * 사람이 누구인지 압니다.
 */
@Entity
@Table(name = "date_options")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DateOption {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    @Column(name = "start_iso", nullable = false)
    private LocalDate startIso;

    /** 0 이면 당일치기. */
    @Column(nullable = false)
    private int nights;

    @Column(name = "created_by", length = 16)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    /** 확정된 후보면 그 시각. 여행마다 하나만 채워집니다. */
    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    public DateOption(String tripId, LocalDate startIso, int nights, String createdBy) {
        this.id = Ids.next();
        this.tripId = tripId;
        this.startIso = startIso;
        this.nights = nights;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }

    public LocalDate endIso() {
        return startIso.plusDays(nights);
    }
}
