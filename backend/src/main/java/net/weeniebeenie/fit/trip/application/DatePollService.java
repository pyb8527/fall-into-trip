package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.group.application.GroupService;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 언제 갈까 — 날짜 정하기 투표.
 *
 * <h3>날짜는 다수결이 아닙니다</h3>
 *
 * <p>가고 싶은 곳을 전원 동의로 정하는 것({@link CandidateService})과 같은
 * 결입니다. 많이 된다는 날이 아니라 <b>모두 되는 날</b>을 찾습니다. 그래서
 * 줄 세우는 순서가 셋입니다 — 가는 사람 모두 「돼요」인 날, 「안 돼요」가
 * 없는 날, 나머지.
 *
 * <p>「가는 사람」은 {@link TripAccessPolicy#peopleOf} 입니다. 「못 가요」라고
 * 한 사람은 날짜 셈에서도 빠집니다 — 안 가는 사람의 「안 돼요」가 날을 막으면
 * 안 됩니다.
 *
 * <h3>앱이 혼자 정하지 않습니다</h3>
 *
 * <p>마감도 기본값도 없습니다. 확정은 여행을 만든 사람이 누릅니다.
 * {@link RouteTidy} 가 동선을 제안만 하고 사람이 수락해야 바뀌는 것과
 * 같습니다.
 */
@Service
@RequiredArgsConstructor
public class DatePollService {

    /** 한 여행에 올릴 수 있는 후보 수. 열을 넘으면 고르는 일이 투표가 아니라 달력 넘기기가 됩니다. */
    private static final int MAX_OPTIONS = 10;

    private final DateOptionRepository options;
    private final DateAnswerRepository answers;
    private final DayRepository days;
    private final PlaceRepository places;
    private final TripRepository trips;
    private final TripAccessPolicy access;
    private final GroupService groups;
    private final UserRepository users;
    private final AuditService audit;

    /** 이 여행의 후보들, 줄 세운 차례로. */
    @Transactional(readOnly = true)
    public Poll pollOf(AuthPrincipal me, String tripId) {
        Trip trip = access.mine(tripId, me.id());
        List<DateOption> list = options.findAllByTripIdOrderByStartIsoAsc(tripId);
        List<String> people = access.peopleOf(trip);
        return new Poll(views(list, people, me.id()), people.size(),
                trip.getOwnerId().equals(me.id()));
    }

    /**
     * 모임의 여행들에 걸린 후보 — 모임 달력이 빗금 칸으로 그립니다.
     *
     * <p>확정된 여행의 후보는 안 냅니다. 이미 날이 정해졌는데 달력에 후보가
     * 남아 있으면 「아직 정하는 중인가」로 읽힙니다.
     */
    @Transactional(readOnly = true)
    public List<Open> openOfGroup(AuthPrincipal me, String groupId) {
        groups.requireMember(groupId, me.id());
        List<Trip> ours = trips.findAllByGroupIdIn(List.of(groupId));
        if (ours.isEmpty()) {
            return List.of();
        }
        Map<String, Trip> byId = ours.stream().collect(Collectors.toMap(Trip::getId, t -> t));
        List<DateOption> all = options.findAllByTripIdIn(byId.keySet());
        if (all.isEmpty()) {
            return List.of();
        }

        Set<String> settled = all.stream()
                .filter(o -> o.getConfirmedAt() != null)
                .map(DateOption::getTripId)
                .collect(Collectors.toSet());

        Map<String, DateChoice> mine = answers
                .findAllByIdOptionIdIn(all.stream().map(DateOption::getId).toList()).stream()
                .filter(a -> a.getId().getUserId().equals(me.id()))
                .collect(Collectors.toMap(a -> a.getId().getOptionId(), DateAnswer::getAnswer));

        return all.stream()
                .filter(o -> !settled.contains(o.getTripId()))
                .sorted(Comparator.comparing(DateOption::getStartIso))
                .map(o -> new Open(o.getId(), o.getTripId(), byId.get(o.getTripId()).getTitle(),
                        o.getStartIso(), o.endIso(), mine.get(o.getId())))
                .toList();
    }

    /**
     * 후보를 올립니다.
     *
     * <p>고칠 수 있는 사람이면 누구나 올립니다 — 「이날은 어때?」는 모임
     * 누구나 꺼내는 말입니다. 올린 사람의 답은 「돼요」로 깔아 둡니다. 되는
     * 날이니까 올렸을 것이고, 안 깔면 올린 사람이 제 후보에 또 답해야 합니다.
     */
    @Transactional
    public void propose(AuthPrincipal me, String tripId, String startIso, Integer nights) {
        access.requireCanEdit(tripId, me.id());
        LocalDate start = DayLabels.parse(startIso);
        int n = nights == null ? 0 : nights;
        if (n < 0 || n > 30) {
            throw ApiException.badRequest("0박에서 30박 사이로 정해 주세요.");
        }
        if (options.existsByTripIdAndStartIsoAndNights(tripId, start, n)) {
            throw ApiException.conflict("이미 올라온 날짜예요.");
        }
        if (options.countByTripId(tripId) >= MAX_OPTIONS) {
            throw ApiException.badRequest("후보는 " + MAX_OPTIONS + "개까지예요. 안 될 날을 지우고 올려 주세요.");
        }

        /* 확정한 뒤에 새 후보가 올라오면 다시 정하는 것입니다. 확정 표시를
           걷어야 모임 달력에 다시 「정하는 중」으로 뜹니다. */
        options.findAllByTripIdOrderByStartIsoAsc(tripId).forEach(o -> o.setConfirmedAt(null));

        DateOption made = options.save(new DateOption(tripId, start, n, me.id()));
        answers.save(new DateAnswer(made.getId(), me.id(), DateChoice.YES));
        audit.log(me.id(), "date.propose", tripId, Map.of("start", startIso, "nights", n));
    }

    /** 후보를 내립니다. 올린 사람이나 여행을 만든 사람만 합니다. */
    @Transactional
    public void withdraw(AuthPrincipal me, String tripId, String optionId) {
        Trip trip = access.mine(tripId, me.id());
        DateOption o = optionOf(tripId, optionId);
        if (!me.id().equals(o.getCreatedBy()) && !me.id().equals(trip.getOwnerId())) {
            throw ApiException.forbidden("올린 사람이나 여행을 만든 사람만 내릴 수 있어요.");
        }
        options.delete(o);
        audit.log(me.id(), "date.withdraw", tripId, Map.of("option", optionId));
    }

    /**
     * 내 답을 적습니다. 늘 부른 사람 제 줄입니다 — 참석 응답과 같습니다.
     *
     * <p>{@code null} 이면 답을 거둡니다. 잘못 누른 것을 「안 답함」으로 되돌릴
     * 길이 있어야 합니다.
     */
    @Transactional
    public void answer(AuthPrincipal me, String tripId, String optionId, DateChoice choice) {
        access.requireCanRead(tripId, me.id());
        DateOption o = optionOf(tripId, optionId);
        DateAnswerId key = new DateAnswerId(o.getId(), me.id());
        if (choice == null) {
            answers.findById(key).ifPresent(answers::delete);
            return;
        }
        DateAnswer row = answers.findById(key).orElseGet(() -> new DateAnswer(o.getId(), me.id(), choice));
        row.setAnswer(choice);
        row.setUpdatedAt(Instant.now());
        answers.save(row);
    }

    /**
     * 이 날로 정합니다. 여행을 만든 사람만 누릅니다.
     *
     * <h3>날짜만 옮기고 장소는 그대로 둡니다</h3>
     *
     * <p>첫째 날에 넣어 둔 장소는 새 첫째 날로 갑니다. 날마다 무엇을 할지는
     * 이미 짜 둔 것이고, 날짜가 바뀌었다고 그것을 다시 짜게 하면 안 됩니다.
     *
     * <h3>기간이 줄어 넘치는 날이 생기면 막습니다</h3>
     *
     * <p>사흘을 이틀로 줄였는데 셋째 날에 장소가 있으면, 그 장소를 어디로
     * 보낼지 앱이 정할 수 없습니다. 무엇이 넘치는지 말하고 막습니다 —
     * 사람이 그 날을 비우거나 다른 날로 옮긴 뒤 다시 누릅니다. 빈 날은
     * 그냥 걷습니다.
     */
    @Transactional
    public void confirm(AuthPrincipal me, String tripId, String optionId) {
        Trip trip = access.requireOwner(tripId, me.id());
        DateOption o = optionOf(tripId, optionId);

        List<Day> list = days.findAllByTripIdOrderBySortAsc(tripId);
        int want = o.getNights() + 1;

        if (want < list.size()) {
            List<Day> spill = list.subList(want, list.size());
            List<String> busy = spill.stream()
                    .filter(d -> !places.findAllByDayIdOrderBySortAsc(d.getId()).isEmpty())
                    .map(d -> d.getShortName() != null ? d.getShortName() : d.getLabel())
                    .toList();
            if (!busy.isEmpty()) {
                throw ApiException.conflict("기간이 줄면 " + String.join(", ", busy)
                        + "에 넣어 둔 장소가 갈 데가 없어요. 그 날을 비우거나 다른 날로 옮긴 뒤 정해 주세요.");
            }
            days.deleteAll(new ArrayList<>(spill));
            list = new ArrayList<>(list.subList(0, want));
        }

        for (int i = 0; i < want; i++) {
            LocalDate date = o.getStartIso().plusDays(i);
            if (i < list.size()) {
                list.get(i).setIso(date);
                list.get(i).setDate(DayLabels.display(date));
            } else {
                days.save(Day.builder()
                        .tripId(tripId)
                        .sort(i)
                        .label(DayLabels.labelOf(i))
                        .date(DayLabels.display(date))
                        .iso(date)
                        .color(DayLabels.colorOf(i))
                        .build());
            }
        }

        Instant now = Instant.now();
        options.findAllByTripIdOrderByStartIsoAsc(tripId)
                .forEach(x -> x.setConfirmedAt(x.getId().equals(o.getId()) ? now : null));

        audit.log(me.id(), "date.confirm", trip.getId(),
                Map.of("start", o.getStartIso().toString(), "nights", o.getNights()));
    }

    private DateOption optionOf(String tripId, String optionId) {
        return options.findById(optionId)
                .filter(o -> o.getTripId().equals(tripId))
                .orElseThrow(() -> ApiException.notFound("그런 날짜 후보가 없어요."));
    }

    /**
     * 후보마다 답을 모으고 줄 세웁니다.
     *
     * <p>사람마다의 답을 다 냅니다 — 누가 안 된다고 했는지 보여야 「그럼
     * 그 주는 빼자」를 말할 수 있습니다. 아직 안 답한 사람이 누구인지는
     * 내지 않습니다(눈치). 몇 명이 답했는지만 셉니다.
     */
    private List<OptionView> views(List<DateOption> list, List<String> people, String me) {
        if (list.isEmpty()) {
            return List.of();
        }
        Map<String, List<DateAnswer>> byOption = answers
                .findAllByIdOptionIdIn(list.stream().map(DateOption::getId).toList()).stream()
                .collect(Collectors.groupingBy(a -> a.getId().getOptionId()));

        Set<String> who = byOption.values().stream().flatMap(List::stream)
                .map(a -> a.getId().getUserId()).collect(Collectors.toSet());
        Map<String, String> names = new HashMap<>();
        users.findAllById(who).forEach(u -> names.put(u.getId(), u.getName()));

        Set<String> counted = new HashSet<>(people);
        List<OptionView> out = new ArrayList<>();
        for (DateOption o : list) {
            List<DateAnswer> got = byOption.getOrDefault(o.getId(), List.of());
            /* 가는 사람의 답만 셈에 넣습니다. 「못 가요」 한 사람이 남긴
               「안 돼요」가 날을 막으면 안 됩니다. */
            List<DateAnswer> ours = got.stream()
                    .filter(a -> counted.contains(a.getId().getUserId()))
                    .toList();
            long yes = ours.stream().filter(a -> a.getAnswer() == DateChoice.YES).count();
            long no = ours.stream().filter(a -> a.getAnswer() == DateChoice.NO).count();

            int tier = yes == people.size() ? 1 : no == 0 ? 2 : 3;
            DateChoice mine = got.stream().filter(a -> a.getId().getUserId().equals(me))
                    .map(DateAnswer::getAnswer).findFirst().orElse(null);

            out.add(new OptionView(
                    o.getId(), o.getStartIso(), o.endIso(), o.getNights(),
                    o.getCreatedBy(), o.getConfirmedAt() != null, tier,
                    (int) yes, (int) no, ours.size(), mine,
                    got.stream().map(a -> new Said(a.getId().getUserId(),
                            names.getOrDefault(a.getId().getUserId(), "누군가"),
                            a.getAnswer())).toList()));
        }
        out.sort(Comparator.comparingInt(OptionView::tier)
                .thenComparing(Comparator.comparingInt(OptionView::yes).reversed())
                .thenComparing(OptionView::startIso));
        return out;
    }

    /**
     * @param people  지금 「가는 사람」 수. 「모두 돼요」의 모두입니다
     * @param amOwner 확정 단추를 그릴지
     */
    public record Poll(List<OptionView> options, int people, boolean amOwner) {
    }

    /**
     * @param tier     1 모두 돼요 · 2 안 돼요 없음 · 3 나머지
     * @param answered 가는 사람 중 답한 수
     * @param mine     내 답. 안 답했으면 비어 있습니다
     */
    public record OptionView(String id, LocalDate startIso, LocalDate endIso, int nights,
                             String createdBy, boolean confirmed, int tier,
                             int yes, int no, int answered, DateChoice mine, List<Said> answers) {
    }

    public record Said(String userId, String name, DateChoice answer) {
    }

    /** 모임 달력의 빗금 칸 하나. */
    public record Open(String id, String tripId, String tripTitle,
                       LocalDate startIso, LocalDate endIso, DateChoice mine) {
    }
}
