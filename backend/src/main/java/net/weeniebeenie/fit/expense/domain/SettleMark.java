package net.weeniebeenie.fit.expense.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/**
 * 송금 줄 하나에 단 「보냈어요 / 받았어요」.
 *
 * <p>송금 줄은 저장하지 않고 볼 때마다 셉니다. 그래서 표시는 (누가 → 누구에게,
 * 통화)로 묶고 그때 금액을 같이 적습니다. 다시 센 금액이 다르면 이 표시는
 * 없는 것으로 봅니다.
 */
@Entity
@Table(name = "settle_marks")
@IdClass(SettleMark.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SettleMark {

    @Id
    @Column(name = "trip_id", length = 16)
    private String tripId;

    @Id
    @Column(name = "from_id", length = 16)
    private String fromId;

    @Id
    @Column(name = "to_id", length = 16)
    private String toId;

    @Id
    @Column(length = 3)
    private String currency;

    @Column(nullable = false)
    private int amount;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "received_at")
    private Instant receivedAt;

    public SettleMark(String tripId, String fromId, String toId, String currency, int amount) {
        this.tripId = tripId;
        this.fromId = fromId;
        this.toId = toId;
        this.currency = currency;
        this.amount = amount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String tripId;
        private String fromId;
        private String toId;
        private String currency;
    }
}
