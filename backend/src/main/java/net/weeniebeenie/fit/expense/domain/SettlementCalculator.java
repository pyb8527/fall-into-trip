package net.weeniebeenie.fit.expense.domain;

import net.weeniebeenie.fit.shared.domain.Money;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 누가 누구에게 얼마를 보내면 되는지 계산합니다.
 *
 * <p>돈 계산이라 전부 정수(엔)로만 다룹니다. 100엔을 셋이 나누면 34·33·33 으로
 * 쪼개고 합을 원래 금액과 맞춥니다. 실수로 나눈 뒤 마지막에 반올림하면 사람
 * 수와 항목 수가 늘수록 총액이 어긋납니다.
 *
 * <p>송금 횟수는 큰 채권자와 큰 채무자를 차례로 상계해 줄입니다. 최소 횟수를
 * 보장하는 방법은 아니지만(그 문제는 NP-hard 입니다) 실제 여행 인원에서는
 * 사실상 최소와 같고, 무엇보다 결과를 사람이 납득할 수 있습니다.
 */
@Component
public class SettlementCalculator {

    /**
     * @param memberIds 이 여행의 동행자. 이 목록에 없는 사람은 계산에서 뺍니다.
     * @param expenses  지출 목록
     * @param sharesOf  지출 하나를 나눠 낼 사람들. 비어 있으면 동행자 전원으로 봅니다.
     * @param paid      이미 주고받은 돈({@link SettlePayment}). 같은 통화의 것만 넘깁니다.
     */
    public Settlement calculate(List<String> memberIds,
                                List<Expense> expenses,
                                java.util.function.Function<Expense, List<String>> sharesOf,
                                List<Settlement.Transfer> paid) {

        Map<String, Integer> balances = new LinkedHashMap<>();
        for (String id : memberIds) {
            balances.put(id, 0);
        }

        for (Expense e : expenses) {
            List<String> share = new ArrayList<>(sharesOf.apply(e));
            share.removeIf(id -> !balances.containsKey(id));
            if (share.isEmpty()) {
                share = new ArrayList<>(memberIds);      // 지정이 없으면 전원 균등
            }
            if (share.isEmpty()) {
                continue;
            }

            /* 낸 사람은 낸 만큼 받을 게 생기고, 나눠 낼 사람들은 제 몫만큼 빚집니다. */
            if (balances.containsKey(e.getPayerId())) {
                balances.merge(e.getPayerId(), e.getAmount(), Integer::sum);
            }
            int[] each = Money.of(e.getAmount()).splitBy(share.size());
            for (int i = 0; i < share.size(); i++) {
                balances.merge(share.get(i), -each[i], Integer::sum);
            }
        }

        /*
          이미 주고받은 돈을 셈에 넣습니다 — 송금 줄을 세기 <b>전에</b>.

          <p>보낸 사람은 그만큼 덜 줄 것이 되고(+), 받은 사람은 그만큼 덜 받을
          것이 됩니다(−). 지출로 생긴 빚을 돈이 오가며 갚은 것이라, 지출과 같은
          장부에 들어가야 합니다. 셈이 끝난 줄에 「주고받았어요」를 붙이는
          식으로는 지출이 하나 늘어 줄이 다시 서는 순간 오간 돈이 셈에서
          사라졌습니다(V62).

          <p>잔액도 남은 것으로 나갑니다. 「받을 / 줄」은 이제 <b>아직</b> 받을
          것과 줄 것입니다.

          <p>동행자 목록에 없는 사람이어도 넣습니다(못 가게 된 사람, 탈퇴한
          사람 자리). 빼면 그 사람에게 보낸 돈이 셈에서 사라집니다. 다만 「전원이
          나누는」 지출의 몫은 매기지 않습니다 — 위에서 이미 memberIds 로만
          나눴습니다.
        */
        for (Settlement.Transfer p : paid) {
            balances.merge(p.fromUserId(), p.amount(), Integer::sum);
            balances.merge(p.toUserId(), -p.amount(), Integer::sum);
        }

        return new Settlement(balances, transfersOf(balances));
    }

    private List<Settlement.Transfer> transfersOf(Map<String, Integer> balances) {
        Deque<Map.Entry<String, Integer>> creditors = balances.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .map(e -> Map.entry(e.getKey(), e.getValue()))
                .collect(java.util.stream.Collectors.toCollection(ArrayDeque::new));

        Deque<Map.Entry<String, Integer>> debtors = balances.entrySet().stream()
                .filter(e -> e.getValue() < 0)
                .sorted(Map.Entry.comparingByValue())
                .map(e -> Map.entry(e.getKey(), -e.getValue()))
                .collect(java.util.stream.Collectors.toCollection(ArrayDeque::new));

        List<Settlement.Transfer> transfers = new ArrayList<>();
        var debtor = debtors.poll();
        var creditor = creditors.poll();
        while (debtor != null && creditor != null) {
            int amount = Math.min(debtor.getValue(), creditor.getValue());
            if (amount > 0) {
                transfers.add(new Settlement.Transfer(debtor.getKey(), creditor.getKey(), amount));
            }
            int debtLeft = debtor.getValue() - amount;
            int credLeft = creditor.getValue() - amount;

            debtor = debtLeft > 0 ? Map.entry(debtor.getKey(), debtLeft) : debtors.poll();
            creditor = credLeft > 0 ? Map.entry(creditor.getKey(), credLeft) : creditors.poll();
        }
        return transfers;
    }
}
