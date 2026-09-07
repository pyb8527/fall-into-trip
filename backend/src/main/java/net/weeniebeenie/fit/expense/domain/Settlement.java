package net.weeniebeenie.fit.expense.domain;

import java.util.List;
import java.util.Map;

/**
 * 정산 결과.
 *
 * @param balances 사람별 잔액. 양수면 받을 돈, 음수면 낼 돈입니다. 합은 0 입니다.
 * @param transfers 누가 누구에게 얼마를 보내면 되는지. 횟수가 가장 적은 조합입니다.
 */
public record Settlement(Map<String, Integer> balances, List<Transfer> transfers) {

    public record Transfer(String fromUserId, String toUserId, int amount) {
    }
}
