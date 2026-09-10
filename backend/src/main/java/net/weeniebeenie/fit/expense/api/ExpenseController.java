package net.weeniebeenie.fit.expense.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.expense.application.ExpenseService;
import net.weeniebeenie.fit.expense.application.ExpenseService.Draft;
import net.weeniebeenie.fit.expense.domain.Currencies;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 가계부.
 *
 * <p>지출은 여행에 딸립니다. 동행자면 누구나 적고 고칠 수 있습니다 — 돈을
 * 낸 사람만 적을 수 있게 하면 "내가 낸 것 좀 적어 줘" 를 서로 부탁하게
 * 됩니다.
 */
@RestController
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenses;

    @GetMapping("/api/trips/{tripId}/expenses")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        return Map.of(
                "expenses", expenses.listOf(me, tripId),
                /* 고르는 화면이 쓸 목록. 여기 없는 통화도 받습니다. */
                "currencies", Currencies.COMMON);
    }

    /** 누가 누구에게 얼마를 주면 되는지. 통화마다 하나씩 옵니다. */
    @GetMapping("/api/trips/{tripId}/settlement")
    public Map<String, Object> settle(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        return Map.of("books", expenses.settle(me, tripId));
    }

    @PostMapping("/api/trips/{tripId}/expenses")
    public Map<String, Object> add(@CurrentUser AuthPrincipal me,
                                   @PathVariable String tripId,
                                   @Valid @RequestBody Draft draft) {
        return Map.of("id", expenses.add(me, tripId, draft).getId());
    }

    @PatchMapping("/api/expenses/{expenseId}")
    public Map<String, Object> update(@CurrentUser AuthPrincipal me,
                                      @PathVariable String expenseId,
                                      @RequestBody Draft draft) {
        expenses.update(me, expenseId, draft);
        return Map.of("ok", true);
    }

    @DeleteMapping("/api/expenses/{expenseId}")
    public Map<String, Object> delete(@CurrentUser AuthPrincipal me,
                                      @PathVariable String expenseId) {
        expenses.delete(me, expenseId);
        return Map.of("ok", true);
    }
}
