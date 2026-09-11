package net.weeniebeenie.fit.expense.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.expense.domain.*;
import net.weeniebeenie.fit.shared.domain.Versioned;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import net.weeniebeenie.fit.trip.domain.TripMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 누가 얼마를 냈고, 누가 누구에게 얼마를 주면 되는지.
 *
 * <h3>왜 이것이 필요한가</h3>
 *
 * <p>여행의 네 단계 중 이 앱이 유일하게 손대지 않던 곳입니다. 그런데
 * 동행자끼리 실제로 껄끄러워지는 자리는 여기입니다 — 누가 얼마를 냈는지
 * 서로 기억이 다르고, 돌아와서 정산하려면 카톡을 거슬러 올라가야 합니다.
 *
 * <h3>통화마다 따로 셉니다</h3>
 *
 * <p>엔으로 받을 돈과 원으로 낼 돈은 더해지지 않습니다. 환율로 합칠 수도
 * 있지만 그러면 "언제 환율로" 가 남고, 그 답은 사람마다 다릅니다. 통화마다
 * 따로 내놓고 어떻게 주고받을지는 사람이 정합니다.
 *
 * <h3>나눠 낼 사람을 안 정하면 전원입니다</h3>
 *
 * <p>여행 경비는 대개 다 같이 나눕니다. 매번 사람을 고르게 하면 그것이 일이
 * 됩니다. 한 사람 것(기념품 같은)일 때만 골라 줍니다.
 */
@Service
@RequiredArgsConstructor
public class ExpenseService {

    /** 한 여행에 적을 수 있는 건수. 이보다 많으면 가계부가 아니라 장부입니다. */
    private static final int MAX_PER_TRIP = 500;

    private final ExpenseRepository expenses;
    private final TripMemberRepository members;
    private final DayRepository days;
    private final PlaceRepository places;
    private final UserRepository users;
    private final TripAccessPolicy access;
    private final SettlementCalculator calculator;
    private final AuditService audit;
    private final ObjectMapper mapper;

    /* --------------------------------------------------------------- 읽기 */

    @Transactional(readOnly = true)
    public List<View> listOf(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());
        Map<String, String> names = namesOf(tripId);
        return expenses.findAllByTripIdOrderByCreatedAtAsc(tripId).stream()
                .map(e -> viewOf(e, names))
                .toList();
    }

    /**
     * 통화마다 하나씩, 누가 누구에게 얼마를 주면 되는지.
     *
     * <p>계산은 저장하지 않습니다. 지출이 하나 바뀌면 답이 달라지는데, 저장해
     * 두면 그 둘이 어긋난 채로 남습니다. 볼 때마다 셉니다 — 몇십 건짜리
     * 계산이라 그 편이 쌉니다.
     */
    @Transactional(readOnly = true)
    public List<Books> settle(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());

        List<String> memberIds = members.findAllByIdTripId(tripId).stream()
                .map(m -> m.getId().getUserId())
                .toList();
        Map<String, String> names = namesOf(tripId);

        /* 통화별로 갈라 놓고 각각 셉니다. */
        Map<String, List<Expense>> byCurrency = new LinkedHashMap<>();
        for (Expense e : expenses.findAllByTripIdOrderByCreatedAtAsc(tripId)) {
            byCurrency.computeIfAbsent(e.getCurrency(), c -> new ArrayList<>()).add(e);
        }

        List<Books> out = new ArrayList<>();
        byCurrency.forEach((currency, list) -> {
            Settlement made = calculator.calculate(memberIds, list, this::sharesOf);

            List<Owed> owes = made.balances().entrySet().stream()
                    .map(b -> new Owed(b.getKey(), names.getOrDefault(b.getKey(), "나간 사람"),
                            b.getValue()))
                    .toList();
            List<Send> sends = made.transfers().stream()
                    .map(t -> new Send(
                            t.fromUserId(), names.getOrDefault(t.fromUserId(), "나간 사람"),
                            t.toUserId(), names.getOrDefault(t.toUserId(), "나간 사람"),
                            t.amount()))
                    .toList();

            int total = list.stream().mapToInt(Expense::getAmount).sum();
            out.add(new Books(currency, Currencies.decimals(currency), total, owes, sends));
        });
        return out;
    }

    /* --------------------------------------------------------------- 쓰기 */

    @Transactional
    public Expense add(AuthPrincipal me, String tripId, Draft draft) {
        access.requireCanEdit(tripId, me.id());

        if (expenses.countByTripId(tripId) >= MAX_PER_TRIP) {
            throw ApiException.badRequest("한 여행에 " + MAX_PER_TRIP + "건까지 적을 수 있습니다.");
        }

        String name = requireName(draft.name());
        int amount = requireAmount(draft.amount());
        String currency = Currencies.clean(draft.currency());
        List<String> memberIds = memberIdsOf(tripId);

        /* 낸 사람을 안 적었으면 적는 사람이 낸 것으로 봅니다. 대개 그렇습니다. */
        String payer = draft.payerId() == null || draft.payerId().isBlank()
                ? me.id()
                : draft.payerId();
        if (!memberIds.contains(payer)) {
            throw ApiException.badRequest("이 여행의 동행자가 아닙니다.");
        }

        Expense made = expenses.save(Expense.builder()
                .tripId(tripId)
                .dayId(dayIn(tripId, draft.dayId()))
                .placeId(placeIn(tripId, draft.placeId()))
                .payerId(payer)
                .cat(blankToNull(draft.cat()))
                .name(name)
                .amount(amount)
                .currency(currency)
                .pay(blankToNull(draft.pay()))
                .share(shareJson(draft.share(), memberIds))
                .createdBy(me.id())
                .build());

        audit.log(me.id(), "expense.add", made.getId(),
                Map.of("trip", tripId, "amount", amount, "currency", currency));
        return made;
    }

    @Transactional
    public void update(AuthPrincipal me, String expenseId, Draft draft) {
        Expense expense = read(expenseId);
        access.requireCanEdit(expense.getTripId(), me.id());
        /* 인자 순서가 뒤집혀 있었습니다. 앞자리는 "화면이 본 판"(없을 수
           있음)이고 뒷자리가 실제 판입니다. 뒤집힌 채로는 판 번호를 안 보낼
           때 null 을 long 으로 풀다가 터졌습니다 — 500 입니다. 화면에 지출
           고치기가 없어 아무도 안 밟던 자리입니다. */
        Versioned.check(draft.version(), expense.getVersion());

        List<String> memberIds = memberIdsOf(expense.getTripId());

        if (draft.name() != null) {
            expense.setName(requireName(draft.name()));
        }
        if (draft.amount() != null) {
            expense.setAmount(requireAmount(draft.amount()));
        }
        if (draft.currency() != null) {
            expense.setCurrency(Currencies.clean(draft.currency()));
        }
        if (draft.payerId() != null) {
            if (!memberIds.contains(draft.payerId())) {
                throw ApiException.badRequest("이 여행의 동행자가 아닙니다.");
            }
            expense.setPayerId(draft.payerId());
        }
        if (draft.cat() != null) {
            expense.setCat(blankToNull(draft.cat()));
        }
        if (draft.pay() != null) {
            expense.setPay(blankToNull(draft.pay()));
        }
        if (draft.dayId() != null) {
            expense.setDayId(dayIn(expense.getTripId(), draft.dayId()));
        }
        if (draft.placeId() != null) {
            expense.setPlaceId(placeIn(expense.getTripId(), draft.placeId()));
        }
        if (draft.share() != null) {
            expense.setShare(shareJson(draft.share(), memberIds));
        }

        audit.log(me.id(), "expense.update", expense.getId(), Map.of("name", expense.getName()));
    }

    @Transactional
    public void delete(AuthPrincipal me, String expenseId) {
        Expense expense = read(expenseId);
        access.requireCanEdit(expense.getTripId(), me.id());
        expenses.delete(expense);
        audit.log(me.id(), "expense.delete", expenseId, Map.of("name", expense.getName()));
    }

    /* --------------------------------------------------------------- 조각 */

    private Expense read(String expenseId) {
        return expenses.findById(expenseId)
                .orElseThrow(() -> ApiException.notFound("그런 지출이 없습니다."));
    }

    private List<String> memberIdsOf(String tripId) {
        return members.findAllByIdTripId(tripId).stream()
                .map(m -> m.getId().getUserId())
                .toList();
    }

    private Map<String, String> namesOf(String tripId) {
        Map<String, String> out = new LinkedHashMap<>();
        members.findAllByIdTripId(tripId).forEach(m -> users.findById(m.getId().getUserId())
                .ifPresent(u -> out.put(u.getId(), u.getName())));
        return out;
    }

    /**
     * 이 여행의 장소인지 확인합니다.
     *
     * <p>지금까지 이 칸은 서버에 깔려만 있고 화면이 한 번도 안 보냈습니다.
     * 아무도 안 보내서 드러나지 않던 자리라, 보내기 시작하는 김에 막습니다 —
     * 남의 여행 장소 번호를 넣어 보내면 그대로 저장됐습니다.
     *
     * <p>장소는 날짜에 딸려 있으므로 그 날짜의 여행을 봅니다.
     */
    private String placeIn(String tripId, String placeId) {
        if (placeId == null || placeId.isBlank()) {
            return null;
        }
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없습니다."));
        Day day = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        if (!day.getTripId().equals(tripId)) {
            throw ApiException.badRequest("이 여행의 장소가 아닙니다.");
        }
        return placeId;
    }

    /** 이 여행의 날짜인지 확인합니다. 남의 여행 날짜에 지출을 달 수 없습니다. */
    private String dayIn(String tripId, String dayId) {
        if (dayId == null || dayId.isBlank()) {
            return null;
        }
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        if (!day.getTripId().equals(tripId)) {
            throw ApiException.badRequest("이 여행의 날짜가 아닙니다.");
        }
        return dayId;
    }

    /**
     * 나눠 낼 사람들을 적어 둡니다.
     *
     * <p>동행자가 아닌 번호는 걸러 냅니다. 빈 목록이면 아예 적지 않습니다 —
     * "아무도 안 나눔" 과 "정하지 않음" 을 구별해야 하는데, 전자는 뜻이
     * 없습니다. 정하지 않으면 전원이 나눕니다.
     */
    private String shareJson(List<String> share, List<String> memberIds) {
        if (share == null) {
            return null;
        }
        List<String> kept = share.stream().filter(memberIds::contains).distinct().toList();
        if (kept.isEmpty() || kept.size() == memberIds.size()) {
            /* 전원이면 굳이 적지 않습니다. 나중에 동행자가 늘면 새 사람도
               자연히 끼는 편이 맞습니다. */
            return null;
        }
        try {
            return mapper.writeValueAsString(kept);
        } catch (Exception e) {
            throw ApiException.badRequest("나눠 낼 사람을 알아듣지 못했습니다.");
        }
    }

    /** 적어 둔 것을 되읽습니다. 없으면 빈 목록이고, 그때는 전원이 나눕니다. */
    private List<String> sharesOf(Expense expense) {
        if (expense.getShare() == null || expense.getShare().isBlank()) {
            return List.of();
        }
        try {
            return mapper.readValue(expense.getShare(),
                    mapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            /* 옛 판에서 이상하게 들어간 것이 있으면 전원으로 봅니다. 한 건
               때문에 정산 전체가 막히면 안 됩니다. */
            return List.of();
        }
    }

    private View viewOf(Expense e, Map<String, String> names) {
        return new View(e.getId(), e.getTripId(), e.getDayId(), e.getPlaceId(),
                e.getPayerId(), names.getOrDefault(e.getPayerId(), "나간 사람"),
                e.getCat(), e.getName(), e.getAmount(), e.getCurrency(),
                Currencies.decimals(e.getCurrency()), e.getPay(),
                sharesOf(e), e.getCreatedAt().toString(), e.getVersion());
    }

    private static String requireName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) {
            throw ApiException.badRequest("무엇에 쓴 돈인지 적어 주세요.");
        }
        return name.length() > 120 ? name.substring(0, 120) : name;
    }

    private static int requireAmount(Integer raw) {
        if (raw == null) {
            throw ApiException.badRequest("금액을 넣어 주세요.");
        }
        if (raw < 0) {
            throw ApiException.badRequest("금액은 0 이상이어야 합니다.");
        }
        /* 20억을 넘으면 int 가 넘칩니다. 원화로도 그만한 여행 경비는 없습니다. */
        if (raw > 2_000_000_000) {
            throw ApiException.badRequest("금액이 너무 큽니다.");
        }
        return raw;
    }

    private static String blankToNull(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    /* --------------------------------------------------------------- 모양 */

    /**
     * 적거나 고칠 때 받는 것.
     *
     * <p>고칠 때는 비운 칸을 건드리지 않습니다 — null 은 "손대지 마라" 이고,
     * 빈 문자열이 "지워라" 입니다.
     */
    public record Draft(String dayId, String placeId, String payerId, String cat,
                        String name, Integer amount, String currency, String pay,
                        List<String> share, Long version) {
    }

    /**
     * 화면에 내보내는 지출 한 건.
     *
     * @param decimals 이 통화가 소수점 아래 몇 자리를 쓰는지. 화면이 1250 을
     *                 "$12.50" 으로 보여 줄 때 씁니다.
     * @param share    나눠 낼 사람들. 비어 있으면 전원입니다.
     */
    public record View(String id, String tripId, String dayId, String placeId,
                       String payerId, String payerName, String cat, String name,
                       int amount, String currency, int decimals, String pay,
                       List<String> share, String createdAt, long version) {
    }

    /** 한 사람의 잔액. 양수면 받을 돈, 음수면 낼 돈입니다. */
    public record Owed(String userId, String name, int balance) {
    }

    /** 누가 누구에게 얼마를. */
    public record Send(String fromUserId, String fromName,
                       String toUserId, String toName, int amount) {
    }

    /** 통화 하나의 장부. */
    public record Books(String currency, int decimals, int total,
                        List<Owed> balances, List<Send> transfers) {
    }
}
