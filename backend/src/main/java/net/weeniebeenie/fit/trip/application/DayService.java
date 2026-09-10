package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Versioned;
import net.weeniebeenie.fit.shared.domain.Coordinates;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** 여행 안의 날짜를 더하고 고치고 지웁니다. */
@Service
@RequiredArgsConstructor
public class DayService {

    private final DayRepository days;
    private final TripService trips;
    private final TripAccessPolicy access;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<Day> listOf(String tripId) {
        return days.findAllByTripIdOrderBySortAsc(tripId);
    }

    /** 날짜를 하나 덧붙입니다. 날짜를 주지 않으면 마지막 다음 날로 잡습니다. */
    @Transactional
    public Day append(AuthPrincipal me, String tripId, String iso, String label, String shortName) {
        Trip trip = trips.resolveFor(me, tripId);
        access.requireCanEdit(trip.getId(), me.id());

        List<Day> existing = days.findAllByTripIdOrderBySortAsc(trip.getId());
        LocalDate date = (iso == null || iso.isBlank())
                ? existing.stream().reduce((a, b) -> b).map(Day::getIso).map(d -> d.plusDays(1)).orElse(null)
                : DayLabels.parse(iso);

        int sort = existing.size();
        Day day = days.save(Day.builder()
                .tripId(trip.getId())
                .sort(sort)
                .label(label == null || label.isBlank() ? DayLabels.labelOf(sort) : label.trim())
                .shortName(blankToNull(shortName))
                .iso(date)
                .date(DayLabels.display(date))
                .color(DayLabels.colorOf(sort))
                .build());

        audit.log(me.id(), "day.create", day.getId(), Map.of("trip", trip.getId()));
        return day;
    }

    @Transactional
    public Day update(AuthPrincipal me, String dayId, DayPatch patch) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanEdit(day.getTripId(), me.id());
        Versioned.check(patch.version(), day.getVersion());

        if (patch.label() != null) {
            String label = patch.label().trim();
            if (label.isEmpty()) {
                throw ApiException.badRequest("날짜 이름이 비어 있습니다.");
            }
            day.setLabel(label);
        }
        if (patch.shortName() != null) day.setShortName(blankToNull(patch.shortName()));
        if (patch.theme() != null) day.setTheme(blankToNull(patch.theme()));
        if (patch.color() != null) day.setColor(blankToNull(patch.color()));
        if (patch.budget() != null) day.setBudget(blankToNull(patch.budget()));
        if (patch.flight() != null) day.setFlight(blankToNull(patch.flight()));

        /*
          숙소.

          이름만 지우면 좌표가 남아 "이름 없는 어딘가" 가 됩니다. 이름을
          비우는 것은 "숙소 없음" 이라는 뜻이므로 좌표도 함께 걷습니다.
         */
        if (patch.stayName() != null) {
            String name = blankToNull(patch.stayName());
            day.setStayName(name);
            if (name == null) {
                day.setStayLat(null);
                day.setStayLng(null);
                day.setStayPlaceId(null);
                day.setStayNote(null);
            }
        }
        if (patch.stayLat() != null && patch.stayLng() != null) {
            Coordinates at = Coordinates.of(patch.stayLat(), patch.stayLng());
            day.setStayLat(at.lat());
            day.setStayLng(at.lng());
        }
        if (patch.stayPlaceId() != null) day.setStayPlaceId(blankToNull(patch.stayPlaceId()));
        if (patch.stayNote() != null) day.setStayNote(blankToNull(patch.stayNote()));

        /*
          같은 데서 이어 자는 날들.

          이박 삼일이면 첫날과 둘째 날이 같은 숙소입니다. 날마다 다시 찾아
          넣게 하면 그것이 일이 되고, 한 곳만 고쳐 두고 다른 날은 옛것으로
          남는 일이 생깁니다.

          <b>비어 있는 날만</b> 채웁니다. 이미 다른 숙소를 적어 둔 날을
          덮어쓰면, 옮겨 자는 일정에서 조용히 하나가 사라집니다.
         */
        if (Boolean.TRUE.equals(patch.stayForward()) && day.getStayName() != null) {
            for (Day later : days.findAllByTripIdOrderBySortAsc(day.getTripId())) {
                if (later.getSort() > day.getSort() && later.getStayName() == null) {
                    later.setStayName(day.getStayName());
                    later.setStayLat(day.getStayLat());
                    later.setStayLng(day.getStayLng());
                    later.setStayPlaceId(day.getStayPlaceId());
                    later.setStayNote(day.getStayNote());
                }
            }
        }
        if (patch.iso() != null && !patch.iso().isBlank()) {
            LocalDate date = DayLabels.parse(patch.iso());
            day.setIso(date);
            day.setDate(DayLabels.display(date));
        }

        audit.log(me.id(), "day.update", day.getId());
        return day;
    }

    /**
     * 날짜를 지웁니다. 그 날의 장소도 함께 사라집니다.
     *
     * 마지막 하나는 남겨 둡니다. 날짜가 없는 여행은 화면이 그릴 게 없습니다.
     */
    @Transactional
    public void delete(AuthPrincipal me, String dayId) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanEdit(day.getTripId(), me.id());

        if (days.countByTripId(day.getTripId()) <= 1) {
            throw ApiException.badRequest("마지막 날짜는 지울 수 없습니다.");
        }
        days.delete(day);

        /* 지운 자리를 메워 순번을 다시 촘촘하게 만듭니다. */
        List<Day> rest = days.findAllByTripIdOrderBySortAsc(day.getTripId());
        for (int i = 0; i < rest.size(); i++) {
            rest.get(i).setSort(i);
        }
        audit.log(me.id(), "day.delete", day.getId(), Map.of("label", day.getLabel()));
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /**
     * @param stayForward 이후 날들 중 숙소가 비어 있는 날에도 같은 곳을 채울지.
     */
    public record DayPatch(String label, String shortName, String iso, String theme,
                           String color, String budget, String flight,
                           String stayName, Double stayLat, Double stayLng,
                           String stayPlaceId, String stayNote, Boolean stayForward,
                           Long version) {
    }
}
