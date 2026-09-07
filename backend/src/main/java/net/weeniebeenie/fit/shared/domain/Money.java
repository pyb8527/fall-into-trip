package net.weeniebeenie.fit.shared.domain;

import net.weeniebeenie.fit.shared.error.ApiException;

/**
 * 엔 단위 금액.
 *
 * 정수로만 다룹니다. 소수를 쓰면 나눠 낼 때 반올림 오차가 쌓여 합이 맞지
 * 않습니다. 나머지는 버리지 않고 앞사람부터 1엔씩 더 얹어 총액을 지킵니다.
 */
public record Money(int yen) implements Comparable<Money> {

    public static final Money ZERO = new Money(0);

    public Money {
        if (yen < 0) {
            throw ApiException.badRequest("금액은 0 이상이어야 합니다.");
        }
    }

    public static Money of(int yen) {
        return new Money(yen);
    }

    public Money plus(Money other) {
        return new Money(this.yen + other.yen);
    }

    /**
     * n 명이 나눠 낼 때 각자의 몫.
     *
     * 총액이 100엔이고 3명이면 34, 33, 33 을 돌려줍니다. 합은 언제나 원래
     * 금액과 같습니다.
     */
    public int[] splitBy(int n) {
        if (n <= 0) {
            throw ApiException.badRequest("나눠 낼 사람이 없습니다.");
        }
        int base = yen / n;
        int rest = yen % n;
        int[] shares = new int[n];
        for (int i = 0; i < n; i++) {
            shares[i] = base + (i < rest ? 1 : 0);
        }
        return shares;
    }

    @Override
    public int compareTo(Money o) {
        return Integer.compare(this.yen, o.yen);
    }
}
