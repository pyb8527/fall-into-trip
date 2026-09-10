package net.weeniebeenie.fit.shared.domain;

import net.weeniebeenie.fit.shared.error.ApiException;

/**
 * 나눠 낼 수 있는 금액.
 *
 * <p>그 통화의 <b>가장 작은 단위</b>로 셉니다 — 엔·원은 1, 달러는 1센트.
 * 정수로만 다룹니다. 소수를 쓰면 나눠 낼 때 반올림 오차가 쌓여 합이 맞지
 * 않습니다. 나머지는 버리지 않고 앞사람부터 하나씩 더 얹어 총액을 지킵니다.
 *
 * <p>통화 이름은 여기 없습니다. 여기서 하는 일은 나누기 하나뿐이고, 그 일에
 * 통화는 필요 없습니다 — 어느 통화끼리 셀지는 부르는 쪽이 이미 갈라 놓고
 * 옵니다.
 */
public record Money(int units) implements Comparable<Money> {

    public static final Money ZERO = new Money(0);

    public Money {
        if (units < 0) {
            throw ApiException.badRequest("금액은 0 이상이어야 합니다.");
        }
    }

    public static Money of(int units) {
        return new Money(units);
    }

    public Money plus(Money other) {
        return new Money(this.units + other.units);
    }

    /**
     * n 명이 나눠 낼 때 각자의 몫.
     *
     * 총액이 100이고 3명이면 34, 33, 33 을 돌려줍니다. 합은 언제나 원래
     * 금액과 같습니다.
     */
    public int[] splitBy(int n) {
        if (n <= 0) {
            throw ApiException.badRequest("나눠 낼 사람이 없습니다.");
        }
        int base = units / n;
        int rest = units % n;
        int[] shares = new int[n];
        for (int i = 0; i < n; i++) {
            shares[i] = base + (i < rest ? 1 : 0);
        }
        return shares;
    }

    @Override
    public int compareTo(Money o) {
        return Integer.compare(this.units, o.units);
    }
}
