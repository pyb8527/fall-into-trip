package net.weeniebeenie.fit.expense.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 실제로 주고받은 돈 한 건 — 「가가 나에게 1,900엔」.
 *
 * <h3>왜 표시({@link SettleMark})로 두지 않나</h3>
 *
 * <p>송금 줄은 지출로 다시 셉니다. 「주고받았어요」를 그 줄에 붙여 두면, 지출이
 * 하나 늘었을 때 줄이 바뀌면서 이미 오간 돈이 셈에서 사라지거나(「1,650
 * 보내세요」), 금액이 우연히 같으면 끝나지 않은 줄에 옛 표시가 그대로
 * 남았습니다. 오간 돈은 셈의 <b>입력</b>이어야 합니다 — 지출과 나란히 들어가야
 * 다시 세어도 「아직 남은 것」만 나옵니다({@link SettlementCalculator}).
 *
 * <p>양쪽이 다 눌렀을 때만 생깁니다. 한쪽만 누른 동안은 여전히 표시입니다.
 */
@Entity
@Table(name = "settle_payments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SettlePayment {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    @Column(name = "from_id", nullable = false, length = 16)
    private String fromId;

    @Column(name = "to_id", nullable = false, length = 16)
    private String toId;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false)
    private int amount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "confirmed_at", nullable = false)
    private Instant confirmedAt;

    public SettlePayment(String tripId, String fromId, String toId, String currency,
                         int amount, Instant confirmedAt) {
        this.id = Ids.next();
        this.tripId = tripId;
        this.fromId = fromId;
        this.toId = toId;
        this.currency = currency;
        this.amount = amount;
        this.confirmedAt = confirmedAt;
    }
}
