package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Coordinates;
import net.weeniebeenie.fit.shared.domain.Versioned;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.support.push.PushService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** 장소를 더하고 고치고 지웁니다. */
@Service
@RequiredArgsConstructor
public class PlaceService {

    /** "09:30" 처럼 24시간 표기만 받습니다. */
    private static final Pattern TIME = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    private final PlaceRepository places;
    private final DayRepository days;
    private final TripMemberRepository members;
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
        List<String> people = members.findAllByIdTripId(tripId).stream()
                .map(m -> m.getId().getUserId())
                .toList();
        push.tell(people, me.id(), tripId, me.name() + " 님이 일정을 고쳤습니다", what,
                "/trip/" + tripId);
    }

    @Transactional
    public Place create(AuthPrincipal me, String dayId, PlaceDraft draft) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanEdit(day.getTripId(), me.id());

        String name = requireName(draft.name());
        Coordinates at = Coordinates.of(draft.lat(), draft.lng());
        String time = normalizeTime(draft.time());

        Place place = places.save(Place.builder()
                .dayId(day.getId())
                .sort(places.findAllByDayIdOrderBySortAsc(day.getId()).size())
                .name(name)
                .ja(blankToNull(draft.ja()))
                .en(blankToNull(draft.en()))
                .lat(at.lat())
                .lng(at.lng())
                .cat(blankToNull(draft.cat()))
                .time(time)
                .cost(blankToNull(draft.cost()))
                .note(blankToNull(draft.note()))
                .url(blankToNull(draft.url()))
                .radius(draft.radius())
                .fit(draft.fit())
                .move(blankToNull(draft.move()))
                .placeId(blankToNull(draft.placeId()))
                .icon(blankToNull(draft.icon()))
                .updatedBy(me.id())
                .build());

        resort(day.getId());
        audit.log(me.id(), "place.create", place.getId(), Map.of("name", name, "day", day.getLabel()));
        announce(me, day.getTripId(), day.getLabel() + "에 「" + name + "」 를 넣었습니다.");
        return place;
    }

    @Transactional
    public Place update(AuthPrincipal me, String placeId, PlaceDraft draft) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없습니다."));
        Day day = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanEdit(day.getTripId(), me.id());
        Versioned.check(draft.version(), place.getVersion());

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
        if (draft.note() != null) place.setNote(blankToNull(draft.note()));
        if (draft.url() != null) place.setUrl(blankToNull(draft.url()));
        if (draft.radius() != null) place.setRadius(draft.radius());
        if (draft.move() != null) place.setMove(blankToNull(draft.move()));
        if (draft.fit() != null) place.setFit(draft.fit());

        /* 날짜를 옮기는 것도 수정으로 봅니다. 하루 늦춰졌을 때 지웠다 다시
           넣게 하면 방문기록과 지출이 딸려 사라집니다. */
        if (draft.dayId() != null && !draft.dayId().equals(place.getDayId())) {
            Day target = days.findById(draft.dayId())
                    .orElseThrow(() -> ApiException.notFound("옮길 날짜를 찾을 수 없습니다."));
            if (!target.getTripId().equals(day.getTripId())) {
                throw ApiException.badRequest("다른 여행의 날짜로는 옮길 수 없습니다.");
            }
            String from = place.getDayId();
            place.setDayId(target.getId());
            resort(from);
        }

        place.touch(me.id());
        resort(place.getDayId());
        audit.log(me.id(), "place.update", place.getId(), Map.of("name", place.getName()));
        days.findById(place.getDayId()).ifPresent(d ->
                announce(me, d.getTripId(), "「" + place.getName() + "」 를 고쳤습니다."));
        return place;
    }

    @Transactional
    public void delete(AuthPrincipal me, String placeId) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없습니다."));
        Day day = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanEdit(day.getTripId(), me.id());

        places.delete(place);
        resort(day.getId());
        audit.log(me.id(), "place.delete", place.getId(), Map.of("name", place.getName()));
        announce(me, day.getTripId(), "「" + place.getName() + "」 를 뺐습니다.");
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
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
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
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanEdit(day.getTripId(), me.id());

        List<Place> current = places.findAllByDayIdOrderBySortAsc(dayId);
        for (int i = 0; i < orderedIds.size(); i++) {
            String id = orderedIds.get(i);
            Place p = current.stream().filter(x -> x.getId().equals(id)).findFirst()
                    .orElseThrow(() -> ApiException.badRequest("이 날짜에 없는 장소가 섞여 있습니다."));
            p.setSort(i);
        }
        audit.log(me.id(), "place.reorder", dayId);
        announce(me, day.getTripId(), day.getLabel() + " 순서를 바꿨습니다.");
    }

    /**
     * 시간이 적힌 것을 앞에 두고 시간순으로 세웁니다.
     *
     * 시간을 비워 둔 장소는 원래 순서를 지킨 채 뒤로 갑니다. "언제 갈지는
     * 아직 모르지만 이 날 어딘가" 인 곳을 넣어 두는 쓰임이 있어서입니다.
     */
    private void resort(String dayId) {
        List<Place> list = places.findAllByDayIdOrderBySortAsc(dayId);
        List<Place> sorted = list.stream()
                .sorted(Comparator
                        .comparing((Place p) -> p.getTime() == null)      // 시간 있는 것 먼저
                        .thenComparing(p -> p.getTime() == null ? "" : p.getTime())
                        .thenComparing(Place::getSort))
                .toList();
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

    public record PlaceDraft(String dayId, String name, Double lat, Double lng,
                             String ja, String en, String cat, String time, String cost,
                             String note, String url, Integer radius, Boolean fit, String move,
                             String placeId, String icon, Long version) {
    }
}
