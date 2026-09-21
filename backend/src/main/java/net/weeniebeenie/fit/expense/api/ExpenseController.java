package net.weeniebeenie.fit.expense.api;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import net.weeniebeenie.fit.trip.application.TripService;
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
    private final TripService trips;

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

    /**
     * 내가 볼 수 있는 여행들의 가계부 한눈에.
     *
     * <h3>왜 따로 있는가</h3>
     *
     * <p>가계부는 여행 하나에 딸려 있습니다. 그래서 「가계부」를 누르면
     * <b>여행 목록</b>이 떴고, 아래 갈래 띠는 그것을 보고 "내 여행" 에
     * 불이 들어왔습니다 — 가계부를 눌렀는데 내 여행에 있는 셈이었습니다.
     *
     * <p>가계부만의 목록을 둡니다. 같은 여행들이지만 <b>얼마나 썼는지</b>로
     * 세워 둔 목록이라, 여행을 짜러 가는 목록과는 다른 화면입니다.
     *
     * <p>여행마다 따로 묻지 않습니다. 마흔 개를 가진 사람에게는 그것이 곧
     * 마흔 번의 왕복입니다.
     */
    @GetMapping("/api/expenses/summary")
    public Map<String, Object> summary(@CurrentUser AuthPrincipal me) {
        List<TripService.TripSummary> mine = trips.listFor(me);
        Map<String, List<ExpenseService.Sum>> spent =
                expenses.spentBy(mine.stream().map(TripService.TripSummary::id).toList());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (TripService.TripSummary t : mine) {
            List<ExpenseService.Sum> sums = spent.getOrDefault(t.id(), List.of());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", t.id());
            row.put("title", t.title());
            row.put("theme", t.theme());
            row.put("emoji", t.emoji());
            row.put("startIso", t.startIso());
            row.put("endIso", t.endIso());
            row.put("sums", sums);
            /* 한 건도 안 적은 여행도 냅니다. 오히려 그쪽이 "여기 적어야
               하는데" 를 떠올리게 하는 자리입니다. */
            row.put("items", sums.stream().mapToLong(ExpenseService.Sum::items).sum());
            rows.add(row);
        }
        return Map.of("trips", rows);
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
