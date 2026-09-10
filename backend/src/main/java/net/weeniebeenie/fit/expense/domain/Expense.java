package net.weeniebeenie.fit.expense.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * 지출 한 건.
 *
 * <p>amount 는 그 통화의 <b>가장 작은 단위</b>로 센 정수입니다 — 엔·원은 1,
 * 달러는 1센트. 소수를 쓰면 정산에서 반올림 오차가 쌓입니다.
 *
 * <p>통화가 다르면 서로 상계할 수 없습니다. 엔으로 받을 돈과 원으로 낼 돈은
 * 더해지지 않으므로, 정산은 통화마다 따로 냅니다.
 *
 * <p>share 는 이 지출을 나눠 낼 사람들의 user_id 배열입니다. 비어 있으면
 * 동행자 전원이 나눠 내는 것으로 봅니다 — 여행 경비는 대개 그렇습니다.
 */
@Entity
@Table(name = "expenses")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Expense {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    @Column(name = "day_id", length = 16)
    private String dayId;

    @Column(name = "place_id", length = 16)
    private String placeId;

    @Column(name = "payer_id", nullable = false, length = 16)
    private String payerId;

    @Column(length = 40)
    private String cat;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    private int amount;

    /** ISO 4217 세 글자. 자릿수는 JDK 가 통화별로 알고 있습니다. */
    @Column(nullable = false, length = 3)
    private String currency;

    @Column(length = 40)
    private String pay;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String share;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", nullable = false, length = 16)
    private String createdBy;

    @Version
    @Column(nullable = false)
    private long version;

    @Builder
    public Expense(String tripId, String dayId, String placeId, String payerId,
                   String cat, String name, int amount, String currency, String pay,
                   String share, String createdBy) {
        this.id = Ids.next();
        this.tripId = tripId;
        this.dayId = dayId;
        this.placeId = placeId;
        this.payerId = payerId;
        this.cat = cat;
        this.name = name;
        this.amount = amount;
        this.currency = currency;
        this.pay = pay;
        this.share = share;
        this.createdAt = Instant.now();
        this.createdBy = createdBy;
    }
}
