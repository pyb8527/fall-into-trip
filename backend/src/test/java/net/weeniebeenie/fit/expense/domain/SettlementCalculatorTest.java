package net.weeniebeenie.fit.expense.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 이미 주고받은 돈을 넣고 세는 정산.
 *
 * <p>사용자 신고로 드러난 일입니다 — 1,900엔을 주고받은 뒤 500엔 지출을 하나
 * 더 적으면 「1,650 보내세요」가 떴습니다. 오간 돈이 셈에 안 들어가서입니다.
 * 그 셈을 여기서 못 박아 둡니다.
 */
class SettlementCalculatorTest {

    private final SettlementCalculator calculator = new SettlementCalculator();

    private static Expense spent(String payer, int amount) {
        return Expense.builder().tripId("t").payerId(payer).name("x")
                .amount(amount).currency("JPY").createdBy(payer).build();
    }

    @Test
    @DisplayName("다 주고받았으면 잔액도 송금 줄도 없다")
    void settledIsEmpty() {
        /* 가가 3,800엔을 내고 둘이 나눔 → 나가 1,900엔 빚. 그 1,900엔을 보냄. */
        Settlement made = calculator.calculate(List.of("a", "b"), List.of(spent("a", 3800)),
                e -> List.of(), List.of(new Settlement.Transfer("b", "a", 1900)));

        assertTrue(made.transfers().isEmpty());
        assertEquals(0, made.balances().get("a"));
        assertEquals(0, made.balances().get("b"));
    }

    @Test
    @DisplayName("주고받은 뒤 새 지출은 그 몫만 새 줄로 선다")
    void onlyTheNewRemainder() {
        /* 위 셈에 더해 나가 500엔을 내고 둘이 나눔 → 가가 나에게 250엔. */
        Settlement made = calculator.calculate(List.of("a", "b"),
                List.of(spent("a", 3800), spent("b", 500)),
                e -> List.of(), List.of(new Settlement.Transfer("b", "a", 1900)));

        assertEquals(List.of(new Settlement.Transfer("a", "b", 250)), made.transfers());
        assertEquals(-250, made.balances().get("a"));
        assertEquals(250, made.balances().get("b"));
    }

    @Test
    @DisplayName("낸 사람 혼자 나누는 지출은 새 줄을 세우지 않는다")
    void selfOnlyAddsNothing() {
        Settlement made = calculator.calculate(List.of("a", "b"),
                List.of(spent("a", 3800), spent("a", 500)),
                e -> e.getAmount() == 500 ? List.of("a") : List.of(),
                List.of(new Settlement.Transfer("b", "a", 1900)));

        assertTrue(made.transfers().isEmpty());
    }

    @Test
    @DisplayName("동행자 목록 밖의 사람과 주고받은 돈도 셈에 남는다")
    void outsiderPaymentKept() {
        /* 다(c)는 못 가게 되어 목록에 없지만 가에게 1,000엔을 받은 적이 있다.
           그 돈을 빼면 가가 1,000엔을 다시 돌려받을 것처럼 나온다. */
        Settlement made = calculator.calculate(List.of("a", "b"), List.of(),
                e -> List.of(), List.of(new Settlement.Transfer("a", "c", 1000)));

        assertEquals(List.of(new Settlement.Transfer("c", "a", 1000)), made.transfers());
    }
}
