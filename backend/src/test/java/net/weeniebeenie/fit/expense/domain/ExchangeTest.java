package net.weeniebeenie.fit.expense.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 적어 둔 환율로 원화로 바꾸는 셈.
 *
 * <p>여기서 틀리면 화면에 그럴듯한 숫자가 뜹니다 — 터지지 않으므로 아무도
 * 모릅니다. 그래서 자릿수와 반올림을 못으로 박아 둡니다.
 */
class ExchangeTest {

    @Test
    @DisplayName("엔은 자릿수가 0 이라 그대로 곱한다")
    void yen() {
        /* 1,200엔 × 9.17 = 11,004원 */
        assertEquals(11004L, Exchange.toKrw(1200, "JPY", new BigDecimal("9.17")));
    }

    @Test
    @DisplayName("달러는 센트로 세어 둔 것이라 100 으로 되돌려야 한다")
    void dollarIsCents() {
        /*
          이것이 이 파일이 있는 까닭입니다.

          <p>1200 이 달러면 12달러입니다. 자릿수를 안 되돌리고 그냥 곱하면
          1,631,388원이 나옵니다 — 백 배입니다.
        */
        assertEquals(16314L, Exchange.toKrw(1200, "USD", new BigDecimal("1359.49")));
    }

    @Test
    @DisplayName("원화는 환율을 안 적어 두어도 그대로 센다")
    void krwNeedsNoRate() {
        assertEquals(80000L, Exchange.toKrw(80000, "KRW", null));
    }

    @Test
    @DisplayName("환율을 안 적어 두었으면 0 이 아니라 비운다")
    void missingRateIsNull() {
        /* 0 을 돌려주면 화면이 「0원」을 그럴듯하게 띄웁니다. */
        assertNull(Exchange.toKrw(1200, "JPY", null));
    }

    @Test
    @DisplayName("동처럼 아주 작은 값도 담는다")
    void dong() {
        /* 500,000동 × 0.0524 = 26,200원 */
        assertEquals(26200L, Exchange.toKrw(500000, "VND", new BigDecimal("0.0524")));
    }

    @Test
    @DisplayName("반올림은 사람이 손으로 하는 쪽으로")
    void halfUp() {
        /* 1엔 × 9.5 = 9.5 → 10원. 버리면 9원이 되어 영수증과 어긋납니다. */
        assertEquals(10L, Exchange.toKrw(1, "JPY", new BigDecimal("9.5")));
    }

    @Test
    @DisplayName("합계는 통화별로 다 더한 뒤 한 번만 바꾼다")
    void sumThenConvert() {
        /*
          지출마다 바꿔 반올림한 뒤 더하면 건수만큼 오차가 쌓입니다.
          1엔짜리 셋을 9.5 로: 하나씩 바꾸면 10+10+10 = 30, 더한 뒤
          바꾸면 3 × 9.5 = 28.5 → 29.
        */
        assertEquals(29L, Exchange.toKrw(3, "JPY", new BigDecimal("9.5")));
    }

    @Test
    @DisplayName("여러 통화를 원화 한 덩어리로")
    void sumKrw() {
        Long won = Exchange.sumKrw(
                Map.of("JPY", 54200L, "KRW", 80000L),
                Map.of("JPY", new BigDecimal("9.17")));
        /* 54,200 × 9.17 = 497,014 + 80,000 */
        assertEquals(577014L, won);
    }

    @Test
    @DisplayName("환율이 빈 통화가 하나라도 있으면 합계를 안 낸다")
    void oneMissingBreaksTheSum() {
        /*
          엔만 바꿔 더한 값을 「합계」로 내놓으면 <b>실제보다 적은 금액</b>이
          그럴듯하게 뜹니다. 모르는 것은 적게 세는 것보다 안 보여 주는 편이
          낫습니다.
        */
        Long won = Exchange.sumKrw(
                Map.of("JPY", 54200L, "USD", 1200L),
                Map.of("JPY", new BigDecimal("9.17")));
        assertNull(won);
    }

    @Test
    @DisplayName("무엇을 적어야 하는지 알려 준다")
    void missing() {
        List<String> need = Exchange.missing(
                List.of("JPY", "KRW", "USD", "JPY"),
                Map.of("JPY", new BigDecimal("9.17")));
        /* 원화는 안 묻고, 겹친 것은 한 번만, 이름 차례대로. */
        assertEquals(List.of("USD"), need);
    }

    @Test
    @DisplayName("원화만 쓴 여행은 적을 것이 없다")
    void krwOnly() {
        assertEquals(List.of(), Exchange.missing(List.of("KRW"), Map.of()));
        assertEquals(80000L, Exchange.sumKrw(Map.of("KRW", 80000L), Map.of()));
    }
}
