package net.weeniebeenie.fit.expense.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 환전했을 때의 환율 하나.
 *
 * <h3>왜 받아 오지 않고 적어 두는가</h3>
 *
 * <p>어디서 받아 오는 환율은 <b>중간값</b>입니다. 그 값으로 셈하면 늘 조금씩
 * 틀립니다 — 공항 환전은 중간값보다 한참 나쁘고, 카드는 비자·마스터의 환율에
 * 수수료가 또 붙습니다. 「대충 얼마 썼나」를 보려고 띄우는 숫자인데, 그 숫자가
 * 실제로 나간 돈과 다르면 보여 주는 뜻이 없습니다.
 *
 * <p>환전할 때 영수증에 찍힌 값이 그 사람이 <b>실제로 겪은</b> 환율입니다.
 * 받아 오지 않고 적어 둡니다. 덤으로 바깥 서비스에 기대지 않게 되고, 지난
 * 여행을 열 때마다 합계가 달라지는 일도 없습니다.
 *
 * <h3>여행마다, 통화마다 하나</h3>
 *
 * <p>지출마다 두지 않습니다. 환전은 여행 한 번에 한두 번 하는 일이고, 밥값마다
 * 환율을 적게 하면 <b>아무도 안 적습니다.</b> 적지 않은 칸이 늘면 합계는
 * 어차피 안 나옵니다.
 *
 * <p>두 번 환전해 환율이 달랐다면 나중에 적은 것이 이깁니다. 어느 지출이 어느
 * 환전에서 나온 돈인지 가리는 일은, 그것을 적을 사람이 없습니다.
 */
@Entity
@Table(name = "trip_rates")
@IdClass(TripRate.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripRate {

    @Id
    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    /** ISO 4217 세 글자. 원화는 안 담습니다 — 1원은 1원입니다. */
    @Id
    @Column(nullable = false, length = 3)
    private String currency;

    /**
     * 이 통화 1 단위가 몇 원인지. 1엔 = 9.17원이면 {@code 9.170000}.
     *
     * <p>{@link BigDecimal} 입니다. 돈을 셈하는 값에 {@code double} 을 쓰면
     * 0.1 을 정확히 담을 수가 없어 합계가 한두 원씩 어긋나고, 그 어긋남은
     * 「왜 1원이 모자라지」로 돌아옵니다.
     */
    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal rate;

    /** 언제 적었는지. 환율이 많이 달라졌을 때 다시 물어볼 수 있게 남깁니다. */
    @Column(name = "noted_at", nullable = false)
    private Instant notedAt = Instant.now();

    public TripRate(String tripId, String currency, BigDecimal rate) {
        this.tripId = tripId;
        this.currency = currency;
        this.rate = rate;
    }

    /** 복합 열쇠. 한 여행에서 한 통화에 하나입니다. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String tripId;
        private String currency;
    }
}
