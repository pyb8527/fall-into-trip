package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Coordinates;
import net.weeniebeenie.fit.shared.domain.Versioned;
import net.weeniebeenie.fit.expense.domain.Currencies;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.shared.text.Josa;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.support.push.PushService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/** 장소를 더하고 고치고 지웁니다. */
@Service
@RequiredArgsConstructor
public class PlaceService {

    /** "09:30" 처럼 24시간 표기만 받습니다. */
    private static final Pattern TIME = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    private final PlaceRepository places;
    private final DayRepository days;
    private final TripAccessPolicy access;
    private final AuditService audit;
    private final PushService push;

    /**
     * 함께 짜는 사람들에게 "누가 무엇을 고쳤다" 고 알립니다.
     *
     * <p>고친 사람에게는 가지 않고, 한동안은 여행마다 한 번만 갑니다 —
     * 자세한 것은 {@link PushService#tell}.
     *
     * <p>알림이 실패해도 고친 것은 이미 저장되어 있습니다. 알리는 일 때문에
     * 고치는 일이 막히면 앞뒤가 바뀝니다.
     */
    private void announce(AuthPrincipal me, String tripId, String what) {
        List<String> people = access.peopleOf(tripId);
        push.tell(people, me.id(), tripId, me.name() + " 님이 일정을 고쳤어요", what,
                "/trip/" + tripId);
    }

    @Transactional
    public Place create(AuthPrincipal me, String dayId, PlaceDraft draft) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanEdit(day.getTripId(), me.id());

        String name = requireName(draft.name());
        Coordinates at = Coordinates.of(draft.lat(), draft.lng());
        String time = normalizeTime(draft.time());
        CostMoney money = CostMoney.of(draft.costAmount(), draft.costCurrency());

        Place place = places.save(Place.builder()
                .dayId(day.getId())
                .sort(slotFor(day.getId(), draft.after()))
                .name(name)
                .ja(blankToNull(draft.ja()))
                .en(blankToNull(draft.en()))
                .lat(at.lat())
                .lng(at.lng())
                .cat(blankToNull(draft.cat()))
                .time(time)
                .cost(blankToNull(draft.cost()))
                .costAmount(money.amount())
                .costCurrency(money.currency())
                .note(blankToNull(draft.note()))
                .url(blankToNull(draft.url()))
                .radius(draft.radius())
                .fit(draft.fit())
                .move(Leg.clean(draft.move()))
                .placeId(blankToNull(draft.placeId()))
                .icon(blankToNull(draft.icon()))
                .updatedBy(me.id())
                .build());

        resort(day.getId());
        audit.log(me.id(), "place.create", place.getId(), Map.of("name", name, "day", day.getLabel()));
        announce(me, day.getTripId(), day.getLabel() + "에 " + Josa.quoted(name, "을", "를") + " 넣었어요.");
        return place;
    }

    @Transactional
    public Place update(AuthPrincipal me, String placeId, PlaceDraft draft) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없어요."));
        Day day = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanEdit(day.getTripId(), me.id());
        Versioned.check(draft.version(), place.getVersion());

        /* 적어 둔 시각이 실제로 바뀌었는지. 아래에서 차례를 다시 셀지 말지를
           이것 하나로 정합니다 — 메모만 고쳤는데 순서가 움직이면 안 됩니다. */
        String wasTime = place.getTime();

        if (draft.name() != null) place.setName(requireName(draft.name()));
        if (draft.lat() != null || draft.lng() != null) {
            Coordinates at = Coordinates.of(
                    draft.lat() == null ? place.getLat() : draft.lat(),
                    draft.lng() == null ? place.getLng() : draft.lng());
            place.setLat(at.lat());
            place.setLng(at.lng());
        }
        if (draft.time() != null) place.setTime(normalizeTime(draft.time()));
        if (draft.ja() != null) place.setJa(blankToNull(draft.ja()));
        if (draft.en() != null) place.setEn(blankToNull(draft.en()));
        if (draft.cat() != null) place.setCat(blankToNull(draft.cat()));
        /* 빈 문자열은 "그림 없애기" 입니다. null 은 "손대지 마라" 라서 둘을
           갈라야 골라 둔 그림을 도로 뺄 수 있습니다. */
        if (draft.icon() != null) place.setIcon(PlaceKind.clean(draft.icon()));
        /* 다른 곳을 다시 고르면 번호도 따라 바뀌어야 합니다. 그래야 영업시간을
           엉뚱한 가게 것으로 보여 주지 않습니다. */
        if (draft.placeId() != null) place.setPlaceId(blankToNull(draft.placeId()));
        if (draft.cost() != null) place.setCost(blankToNull(draft.cost()));
        /* 금액과 통화는 짝입니다. 하나만 와도 둘 다 다시 세웁니다 — 한쪽만
           남으면 "얼마인지 모르는 값" 이나 "값 없는 통화" 가 됩니다. */
        if (draft.costAmount() != null || draft.costCurrency() != null) {
            CostMoney money = CostMoney.of(draft.costAmount(), draft.costCurrency());
            place.setCostAmount(money.amount());
            place.setCostCurrency(money.currency());
        }
        if (draft.note() != null) place.setNote(blankToNull(draft.note()));
        if (draft.url() != null) place.setUrl(blankToNull(draft.url()));
        if (draft.radius() != null) place.setRadius(draft.radius());
        if (draft.move() != null) place.setMove(Leg.clean(draft.move()));
        if (draft.fit() != null) place.setFit(draft.fit());

        /* 날짜를 옮기는 것도 수정으로 봅니다. 하루 늦춰졌을 때 지웠다 다시
           넣게 하면 방문기록과 지출이 딸려 사라집니다. */
        boolean moved = false;
        if (draft.dayId() != null && !draft.dayId().equals(place.getDayId())) {
            Day target = days.findById(draft.dayId())
                    .orElseThrow(() -> ApiException.notFound("옮길 날짜를 찾을 수 없어요."));
            if (!target.getTripId().equals(day.getTripId())) {
                throw ApiException.badRequest("다른 여행의 날짜로는 옮길 수 없어요.");
            }
            String from = place.getDayId();
            place.setDayId(target.getId());
            /* 옮겨 간 날의 맨 뒤에 섭니다. 들고 온 번호를 그대로 두면 그 날에
               이미 그 번호를 쓰는 곳과 겹쳐, 둘 중 누가 앞인지가 운에 달립니다.
               아래 resort 가 시각을 보고 제자리를 찾아 줍니다. */
            place.setSort(Integer.MAX_VALUE);
            resort(from);
            moved = true;
        }

        place.touch(me.id());
        /* 순서를 건드릴 일이 있을 때만 건드립니다. 끌어서 옮겨 둔 자리는
           그것 말고는 아무것도 흔들 수 없습니다. */
        if (moved || !Objects.equals(wasTime, place.getTime())) {
            resort(place.getDayId());
        }
        audit.log(me.id(), "place.update", place.getId(), Map.of("name", place.getName()));
        days.findById(place.getDayId()).ifPresent(d ->
                announce(me, d.getTripId(), Josa.quoted(place.getName(), "을", "를") + " 고쳤어요."));
        return place;
    }

    @Transactional
    public void delete(AuthPrincipal me, String placeId) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없어요."));
        Day day = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanEdit(day.getTripId(), me.id());

        places.delete(place);
        resort(day.getId());
        audit.log(me.id(), "place.delete", place.getId(), Map.of("name", place.getName()));
        announce(me, day.getTripId(), Josa.quoted(place.getName(), "을", "를") + " 뺐어요.");
    }

    /**
     * 이렇게 돌면 덜 걷습니다 — 하는 제안.
     *
     * <p>저장하지 않습니다. 사람이 보고 받아들일지 정합니다. 받아들이면
     * 화면이 {@link #reorder} 를 부릅니다 — 손으로 끌어 옮긴 것과 똑같은
     * 길로 들어가므로, 저장하는 자리는 여전히 하나뿐입니다.
     */
    @Transactional(readOnly = true)
    public RouteTidy.Tidied tidy(AuthPrincipal me, String dayId) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanRead(day.getTripId(), me.id());

        /* 하루는 자던 자리에서 시작합니다. 숙소를 적어 두었으면 거기서
           출발한다고 보고 세웁니다. */
        Coordinates from = day.getStayLat() != null && day.getStayLng() != null
                ? new Coordinates(day.getStayLat(), day.getStayLng())
                : null;
        return RouteTidy.tidy(places.findAllByDayIdOrderBySortAsc(dayId), from);
    }

    /** 손으로 끌어 옮긴 순서를 그대로 저장합니다. */
    @Transactional
    public void reorder(AuthPrincipal me, String dayId, List<String> orderedIds) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanEdit(day.getTripId(), me.id());

        List<Place> current = places.findAllByDayIdOrderBySortAsc(dayId);
        for (int i = 0; i < orderedIds.size(); i++) {
            String id = orderedIds.get(i);
            Place p = current.stream().filter(x -> x.getId().equals(id)).findFirst()
                    .orElseThrow(() -> ApiException.badRequest("이 날짜에 없는 장소가 섞여 있어요."));
            p.setSort(i);
        }
        audit.log(me.id(), "place.reorder", dayId);
        announce(me, day.getTripId(), day.getLabel() + " 순서를 바꿨어요.");
    }

    /**
     * 그 날의 차례를 다시 세웁니다.
     *
     * <p>어떻게 세우는지는 {@link PlaceOrder} 가 압니다 — 시간이 적힌 곳은
     * 제 시각에, 시간 없는 곳은 제가 따라다니던 곳 뒤에.
     *
     * <p>부르는 자리를 골라 둡니다. 장소가 늘거나 줄었을 때, 적어 둔 시각이
     * 바뀌었을 때, 날짜를 옮겼을 때뿐입니다. 메모나 비용만 고쳤는데 순서가
     * 흔들리면 고친 사람은 자기가 무엇을 건드렸는지 모릅니다.
     */
    /**
     * 새 장소가 들어갈 자리.
     *
     * <h3>왜 맨 뒤가 아닌가</h3>
     *
     * <p>넣는 길이 날짜마다의 <b>＋</b> 하나뿐이라, 무엇을 넣든 그 날 맨
     * 뒤에 붙었습니다. 그런데 일정을 짜다 보면 "이치란 다음에 커피 한 잔"
     * 처럼 <b>어느 곳 다음</b>이 정해져 있는 때가 훨씬 많습니다. 맨 뒤에
     * 붙여 놓고 끌어서 올리는 것은 스무 곳짜리 날에서 할 짓이 아닙니다.
     *
     * <h3>뒤를 한 칸씩 밉니다</h3>
     *
     * <p>이 날의 순서는 시각이 정합니다(PlaceOrder). 시간을 안 적은 곳은
     * <b>앞의 시간 있는 곳을 따라다니므로</b>, 끼워 넣을 자리 뒤를 한 칸씩
     * 밀어 두면 arrange 가 그 자리를 지켜 줍니다.
     *
     * @param after 이 장소 다음에. 없거나 이 날의 것이 아니면 맨 뒤
     */
    private int slotFor(String dayId, String after) {
        List<Place> here = places.findAllByDayIdOrderBySortAsc(dayId);
        if (after == null || after.isBlank()) {
            return here.size();
        }
        int at = -1;
        for (int i = 0; i < here.size(); i++) {
            if (here.get(i).getId().equals(after)) {
                at = i;
                break;
            }
        }
        if (at < 0) {
            /* 가리킨 곳이 이 날에 없습니다. 지워졌거나 다른 날의 것입니다.
               맨 뒤에 둡니다 — 엉뚱한 자리에 끼우는 것보다 낫습니다. */
            return here.size();
        }
        /* 뒤에 있는 것들을 한 칸씩 밉니다. 안 밀면 같은 번호가 둘이 되어
           둘 중 어느 것이 먼저인지 정해지지 않습니다. */
        for (int i = at + 1; i < here.size(); i++) {
            here.get(i).setSort(here.get(i).getSort() + 1);
        }
        return here.get(at).getSort() + 1;
    }

    private void resort(String dayId) {
        List<Place> sorted = PlaceOrder.arrange(places.findAllByDayIdOrderBySortAsc(dayId));
        for (int i = 0; i < sorted.size(); i++) {
            sorted.get(i).setSort(i);
        }
    }

    private static String requireName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) {
            throw ApiException.badRequest("장소 이름을 넣어 주세요.");
        }
        return name;
    }

    private static String normalizeTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String time = raw.trim();
        if (!TIME.matcher(time).matches()) {
            throw ApiException.badRequest("시간은 09:30 처럼 적어 주세요.");
        }
        return time;
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /**
     * 셈할 수 있는 비용 — 금액과 통화.
     *
     * <p>둘은 짝으로만 뜻이 있습니다. 금액만 있으면 얼마인지 모르고, 통화만
     * 있으면 적은 것이 아닙니다. 그래서 한쪽만 오면 거절합니다.
     *
     * <p>둘 다 비어 있으면 "안 적었다" 입니다 — 그건 거절할 일이 아닙니다.
     */
    record CostMoney(Integer amount, String currency) {

        static CostMoney of(Integer amount, String rawCurrency) {
            String currency = rawCurrency == null || rawCurrency.isBlank() ? null : rawCurrency;
            if (amount == null && currency == null) {
                return new CostMoney(null, null);
            }
            if (amount == null || currency == null) {
                throw ApiException.badRequest("비용은 금액과 통화를 함께 넣어 주세요.");
            }
            if (amount < 0) {
                throw ApiException.badRequest("비용은 0보다 작을 수 없어요.");
            }
            /* 모르는 통화는 여기서 걸립니다. 가계부가 쓰는 것과 같은 자리라
               두 화면이 같은 통화만 받습니다. */
            return new CostMoney(amount, Currencies.clean(currency));
        }
    }

    public record PlaceDraft(String dayId, String name, Double lat, Double lng,
                             String ja, String en, String cat, String time, String cost,
                             Integer costAmount, String costCurrency,
                             String note, String url, Integer radius, Boolean fit, String move,
                             String placeId, String icon, Long version,
                             /**
                              * 이 장소 다음에 넣습니다. 넣을 때만 씁니다.
                              *
                              * <p>없으면 그 날 맨 뒤입니다 — 지금까지의
                              * 동작이고, 날짜의 ＋ 로 넣을 때가 그렇습니다.
                              */
                             String after) {
    }
}
