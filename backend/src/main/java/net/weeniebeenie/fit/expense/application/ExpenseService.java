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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
 * <p>그 "언제 환율로" 를 <b>쓰는 사람이 적어 둡니다</b>({@link TripRate}) —
 * 환전할 때 영수증에 찍힌 값입니다. 그러면 「대충 얼마 썼나」를 원화 한
 * 덩어리로 보여 줄 수 있습니다.
 *
 * <p>다만 <b>보낼 금액은 합치지 않습니다.</b> 합계가 조금 틀리는 것은
 * 「대충」이라 괜찮지만, 「민수가 나한테 89,000원 보내」가 틀리면 누군가
 * 그만큼 손해입니다. 적어 둔 환율은 환전소 하나의 값이고 카드로 긁은 것은
 * 비자·마스터의 환율이라, 둘이 같을 이유가 없습니다.
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
    private final TripRateRepository rates;
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

        List<String> memberIds = access.peopleOf(tripId);
        Map<String, String> names = namesOf(tripId);

        /* 적어 둔 환율. 통화별 장부마다 "원화로 얼마" 를 얹는 데 씁니다. */
        Map<String, BigDecimal> noted = rates.findAllByTripId(tripId).stream()
                .collect(Collectors.toMap(TripRate::getCurrency, TripRate::getRate));

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
            /*
              이 통화 합계가 원화로 얼마인지.

              <p>통화별 장부에 한 줄씩 얹습니다. 화면이 "￥54,200" 아래에
              "≈ 497,000원" 을 적을 수 있게 하려는 것인데, <b>보낼 금액에는
              안 씁니다</b> — 위 머리말의 까닭입니다.

              <p>환율을 안 적어 두었으면 {@code null} 입니다. 0 을 넣으면
              화면이 「0원」을 그럴듯하게 띄웁니다.
            */
            Long krw = Exchange.toKrw(total, currency, noted.get(currency));
            out.add(new Books(currency, Currencies.decimals(currency), total, krw, owes, sends));
        });
        return out;
    }

    /* --------------------------------------------------------------- 쓰기 */

    @Transactional
    public Expense add(AuthPrincipal me, String tripId, Draft draft) {
        access.requireCanEdit(tripId, me.id());

        if (expenses.countByTripId(tripId) >= MAX_PER_TRIP) {
            throw ApiException.badRequest("한 여행에 " + MAX_PER_TRIP + "건까지 적을 수 있어요.");
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
            throw ApiException.badRequest("이 여행을 같이 보는 사람이 아니에요.");
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
    /**
     * 적어 둔 것을 고칩니다.
     *
     * <p><b>보낸 것만 바뀝니다.</b> {@code null} 인 칸은 손대지 않습니다 —
     * 화면이 칸 하나만 고쳐 보낼 수 있어야 합니다.
     *
     * <p>그래서 <b>비우는 것은 빈 글("")과 빈 목록([])</b>로 보냅니다.
     * {@code null} 로 보내면 비워지는 것이 아니라 옛 값이 그대로 남습니다.
     * 보석함 메모도 같은 약속을 씁니다.
     */
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
                throw ApiException.badRequest("이 여행을 같이 보는 사람이 아니에요.");
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
                .orElseThrow(() -> ApiException.notFound("그런 지출이 없어요."));
    }

    private List<String> memberIdsOf(String tripId) {
        return access.peopleOf(tripId);
    }

    private Map<String, String> namesOf(String tripId) {
        Map<String, String> out = new LinkedHashMap<>();
        access.peopleOf(tripId).forEach(id -> users.findById(id)
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
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없어요."));
        Day day = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        if (!day.getTripId().equals(tripId)) {
            throw ApiException.badRequest("이 여행의 장소가 아니에요.");
        }
        return placeId;
    }

    /** 이 여행의 날짜인지 확인합니다. 남의 여행 날짜에 지출을 달 수 없습니다. */
    private String dayIn(String tripId, String dayId) {
        if (dayId == null || dayId.isBlank()) {
            return null;
        }
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        if (!day.getTripId().equals(tripId)) {
            throw ApiException.badRequest("이 여행의 날짜가 아니에요.");
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
            throw ApiException.badRequest("나눠 낼 사람을 알아듣지 못했어요.");
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
            throw ApiException.badRequest("금액은 0 이상이어야 해요.");
        }
        /* 20억을 넘으면 int 가 넘칩니다. 원화로도 그만한 여행 경비는 없습니다. */
        if (raw > 2_000_000_000) {
            throw ApiException.badRequest("금액이 너무 커요.");
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
    /**
     * 여행마다 얼마나 썼는지.
     *
     * <p>가계부 목록 화면이 씁니다. 볼 수 있는 여행만 넘겨받으므로 여기서
     * 다시 권한을 보지 않습니다 — 부르는 쪽이 이미 걸렀습니다.
     */
    @Transactional(readOnly = true)
    public Map<String, List<Sum>> spentBy(List<String> tripIds) {
        if (tripIds.isEmpty()) {
            return Map.of();
        }
        Map<String, List<Sum>> out = new LinkedHashMap<>();
        for (ExpenseRepository.TripSpend row : expenses.sumByTrip(tripIds)) {
            out.computeIfAbsent(row.getTripId(), k -> new ArrayList<>())
                    .add(new Sum(row.getCurrency(),
                            Currencies.decimals(row.getCurrency()),
                            row.getTotal(),
                            row.getItems()));
        }
        return out;
    }

    /** 한 여행에서 한 통화로 쓴 것. */
    public record Sum(String currency, int decimals, long total, long items) {
    }

    /* ----------------------------------------------------------- 환율 */

    /**
     * 이 여행에 적어 둔 환율들.
     *
     * <p>적어 둘 자리가 <b>있어야 하는</b> 통화도 같이 냅니다. 적어 둔 것만
     * 내놓으면 화면이 「무엇을 적어야 하는지」를 모릅니다 — 처음에는 적어 둔
     * 것이 하나도 없는데, 그때가 바로 물어봐야 할 때입니다.
     */
    @Transactional(readOnly = true)
    public Rates ratesOf(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());

        Map<String, BigDecimal> noted = rates.findAllByTripId(tripId).stream()
                .collect(Collectors.toMap(TripRate::getCurrency, TripRate::getRate));

        /* 이 여행에서 실제로 쓴 통화들. 안 쓴 통화의 환율을 물어보면
           화면이 쓸데없는 칸으로 길어집니다. */
        List<String> used = expenses.findAllByTripIdOrderByCreatedAtAsc(tripId).stream()
                .map(Expense::getCurrency)
                .distinct()
                .sorted()
                .toList();

        return new Rates(
                used.stream()
                        .filter(c -> !"KRW".equals(c))
                        .map(c -> new Noted(c, Currencies.decimals(c), noted.get(c)))
                        .toList(),
                Exchange.missing(used, noted));
    }

    /**
     * 환전했을 때의 환율을 적습니다.
     *
     * <p>고칠 수 있는 사람만 적습니다. 같이 가는 여행에서 한 사람이 환전하고
     * 나머지가 그 환율을 보는 것이 보통이라, 보기만 하는 사람이 고치면 남의
     * 합계가 바뀝니다.
     */
    @Transactional
    public void noteRate(AuthPrincipal me, String tripId, String rawCurrency, BigDecimal rate) {
        access.requireCanEdit(tripId, me.id());

        String currency = Currencies.clean(rawCurrency);
        if ("KRW".equals(currency)) {
            throw ApiException.badRequest("원화는 환율을 적지 않아요. 1원은 1원이에요.");
        }
        if (rate == null || rate.signum() <= 0) {
            throw ApiException.badRequest("환율은 0보다 커야 해요.");
        }
        /*
          터무니없는 값을 막습니다.

          <p>1엔을 9.17 이 아니라 917 로 적는 일(소수점을 잊는 것)이 가장
          흔한 실수입니다. 그러면 합계가 백 배로 뜨는데, 그 숫자를 보고
          「환율을 잘못 적었구나」로 돌아오기까지가 멉니다.

          <p>세상의 통화는 1 단위가 0.00001원(짐바브웨)부터 4,400원
          (쿠웨이트)까지입니다. 그 바깥은 적으려던 값이 아닙니다.
        */
        if (rate.compareTo(new BigDecimal("100000")) > 0) {
            throw ApiException.badRequest("환율이 너무 커요. 1" + currency + " 가 몇 원인지 적어 주세요.");
        }

        TripRate row = rates.findById(new TripRate.Key(tripId, currency))
                .orElseGet(() -> new TripRate(tripId, currency, rate));
        row.setRate(rate);
        row.setNotedAt(java.time.Instant.now());
        rates.save(row);

        audit.log(me.id(), "trip.rate.note", tripId,
                Map.of("currency", currency, "rate", rate.toPlainString()));
    }

    /** 적어 둔 환율을 지웁니다. 다시 「대충 얼마」가 안 나옵니다. */
    @Transactional
    public void dropRate(AuthPrincipal me, String tripId, String rawCurrency) {
        access.requireCanEdit(tripId, me.id());
        rates.deleteByTripIdAndCurrency(tripId, Currencies.clean(rawCurrency));
    }

    /**
     * 이 여행에 적어 둔 환율들과, 아직 안 적어 둔 통화들.
     *
     * @param needed 이것이 비어 있지 않으면 원화 합계를 낼 수 없습니다
     */
    public record Rates(List<Noted> rates, List<String> needed) {
    }

    /** 한 통화의 환율. {@code rate} 가 비어 있으면 아직 안 적어 둔 것입니다. */
    public record Noted(String currency, int decimals, BigDecimal rate) {
    }

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

    /**
     * 통화 하나의 장부.
     *
     * @param krw 이 통화 합계를 적어 둔 환율로 원화로 바꾼 값. 환율을 안
     *            적어 두었으면 {@code null} — 「대충 얼마」로만 씁니다
     */
    public record Books(String currency, int decimals, int total, Long krw,
                        List<Owed> balances, List<Send> transfers) {
    }
}
