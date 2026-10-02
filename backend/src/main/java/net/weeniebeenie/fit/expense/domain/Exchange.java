package net.weeniebeenie.fit.expense.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * 적어 둔 환율로 원화로 바꾸는 자리.
 *
 * <h3>왜 한 군데에 모아 두는가</h3>
 *
 * <p>이 셈에는 틀리기 쉬운 자리가 둘 있습니다.
 *
 * <p>첫째, {@code amount} 는 <b>그 통화의 가장 작은 단위</b>입니다 — 엔·원은
 * 1, 달러는 1센트. 그래서 1,200 이 엔이면 1,200엔이지만 달러면 12달러입니다.
 * 환율을 곱하기 전에 자릿수를 먼저 되돌려야 합니다. 안 되돌리면 달러 지출이
 * 백 배로 셈됩니다.
 *
 * <p>둘째, 반올림입니다. 지출마다 원화로 바꿔 반올림한 뒤 더하면, 서른 건이면
 * 서른 번 반올림한 오차가 쌓입니다. 합계를 낼 때는 <b>원래 통화로 다 더한 뒤</b>
 * 한 번만 바꿉니다.
 *
 * <p>두 군데에 흩어 두면 한쪽만 고쳐지고, 돈 셈에서 그런 어긋남은 「왜 천 원이
 * 모자라지」로 돌아옵니다.
 */
public final class Exchange {

    private Exchange() {
    }

    /**
     * 그 통화 금액을 원화로.
     *
     * @param amount   그 통화의 가장 작은 단위로 센 값
     * @param currency 세 글자 코드
     * @param rate     1 단위가 몇 원인지. {@code null} 이면 적어 두지 않은 것
     * @return 원 단위 금액. 환율을 안 적어 두었으면 {@code null}
     */
    public static Long toKrw(long amount, String currency, BigDecimal rate) {
        /* 원화는 바꿀 것이 없습니다. 환율을 안 적어 두어도 원화 지출은 셈에
           들어가야 합니다 — 안 넣으면 원화로만 쓴 여행의 합계가 0 이 됩니다. */
        if ("KRW".equals(currency)) {
            return amount;
        }
        if (rate == null) {
            return null;
        }

        int decimals = Currencies.decimals(currency);
        /* 가장 작은 단위를 제 단위로 되돌립니다 — 1200센트 → 12.00달러. */
        BigDecimal major = BigDecimal.valueOf(amount).movePointLeft(decimals);

        /* 원은 소수점 아래를 안 씁니다. HALF_UP 은 사람이 손으로 셈할 때
           하는 반올림이라, 화면에 뜬 값과 어긋나지 않습니다. */
        return major.multiply(rate).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    /**
     * 통화별 합계를 원화 한 덩어리로.
     *
     * <h3>하나라도 비면 안 냅니다</h3>
     *
     * <p>엔 환율은 적어 두었고 달러는 안 적어 둔 여행에서, 엔만 바꿔 더한 값을
     * 「합계」로 내놓으면 <b>실제보다 적은 금액</b>이 그럴듯한 숫자로 뜹니다.
     * 모르는 것은 적게 세는 것보다 안 보여 주는 편이 낫습니다 — 화면은 대신
     * 「달러 환율을 적어 주세요」를 띄웁니다.
     *
     * @param totals 통화 → 그 통화로 더한 합계(가장 작은 단위)
     * @param rates  통화 → 적어 둔 환율
     * @return 원 단위 합계. 환율이 빈 통화가 있으면 {@code null}
     */
    public static Long sumKrw(Map<String, Long> totals, Map<String, BigDecimal> rates) {
        long sum = 0;
        for (Map.Entry<String, Long> e : totals.entrySet()) {
            Long won = toKrw(e.getValue(), e.getKey(), rates.get(e.getKey()));
            if (won == null) {
                return null;
            }
            sum += won;
        }
        return sum;
    }

    /**
     * 환율을 아직 안 적어 둔 통화들.
     *
     * <p>화면이 「무엇을 적어야 합계가 나오는지」를 말할 때 씁니다. 그냥
     * 「합계를 낼 수 없어요」 하면 무엇을 해야 하는지 알 수가 없습니다.
     */
    public static java.util.List<String> missing(java.util.Collection<String> currencies,
                                                 Map<String, BigDecimal> rates) {
        return currencies.stream()
                .filter(c -> !"KRW".equals(c))
                .filter(c -> !rates.containsKey(c))
                .distinct()
                .sorted()
                .toList();
    }
}
