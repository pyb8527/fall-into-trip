package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 여행 만들기·고치기·지우기.
 *
 * <p>여행을 만들면 날짜도 함께 깔아 둡니다. 빈 여행을 만들어 놓고 날짜를 하나씩
 * 더하게 하면 손이 많이 가서, 며칠짜리인지만 받아 한 번에 준비합니다.
 */
@Service
@RequiredArgsConstructor
public class TripService {

    private static final int MAX_NIGHTS = 30;

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final DayRepository days;
    private final PlaceRepository places;
    private final TripAccessPolicy access;
    private final AuditService audit;

    /** 내가 볼 수 있는 여행 목록. 관리자는 전부 봅니다. */
    @Transactional(readOnly = true)
    public List<TripSummary> listFor(AuthPrincipal me) {
        List<Trip> visible = members.findAllByIdUserId(me.id()).stream()
                .map(m -> trips.findById(m.getTripId()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .sorted(java.util.Comparator.comparing(Trip::getCreatedAt))
                .toList();

        return visible.stream().map(trip -> {
            List<Day> dayList = days.findAllByTripIdOrderBySortAsc(trip.getId());
            return new TripSummary(
                    trip.getId(), trip.getTitle(), trip.getOwnerId(),
                    dayList.isEmpty() ? null : dayList.get(0).getIso(),
                    dayList.isEmpty() ? null : dayList.get(dayList.size() - 1).getIso(),
                    dayList.size(),
                    (int) places.countOfTrip(trip.getId()));
        }).toList();
    }

    /**
     * 다녀온 여행을 밑그림 삼아 새로 하나.
     *
     * <p>같은 데를 또 가는 일은 흔합니다. 매년 가는 곳, 이번엔 다른 사람과
     * 가는 곳. 그때마다 스무 곳을 다시 찾아 넣게 하면 그 자체가 일입니다.
     *
     * <p>날짜는 새로 받습니다. 지난 날짜를 그대로 물려받으면 만들자마자 이미
     * 다녀온 여행이 됩니다. 첫날만 정하면 나머지가 그 간격 그대로 따라옵니다 —
     * 2박 3일이었으면 새것도 2박 3일입니다.
     *
     * <p>가져오지 않는 것이 셋 있습니다. <b>동행자</b>는 부르지 않습니다. 지난
     * 여행을 함께한 사람이 이번에도 간다는 보장이 없고, 무엇보다 남을 말없이
     * 새 여행에 끌어들이는 일이 됩니다. <b>다녀온 표시</b>도 지웁니다 — 아직
     * 가지 않은 여행입니다. <b>깃발과 위치</b>는 그때 그 자리의 것이라 옮길
     * 뜻이 없습니다.
     */
    @Transactional
    public Trip duplicate(AuthPrincipal me, String tripId, String title, String startIso) {
        /* 볼 수 있으면 베낄 수 있습니다. 동행자로 들어가 함께 짠 여행을 내
           것으로 하나 떠 두는 것은 자연스러운 일입니다. */
        access.requireCanRead(tripId, me.id());
        Trip origin = trips.findById(tripId)
                .orElseThrow(() -> ApiException.notFound("그런 여행이 없습니다."));

        String cleanTitle = title == null || title.isBlank()
                ? origin.getTitle() + " (사본)"
                : title.trim();
        if (cleanTitle.length() > 120) {
            throw ApiException.badRequest("여행 이름이 너무 깁니다.");
        }
        LocalDate start = DayLabels.parse(startIso);

        Trip made = trips.save(Trip.builder().title(cleanTitle).ownerId(me.id()).build());
        members.save(new TripMember(made.getId(), me.id(), TripRole.EDITOR));

        List<Day> originDays = days.findAllByTripIdOrderBySortAsc(tripId);
        for (int i = 0; i < originDays.size(); i++) {
            Day from = originDays.get(i);
            LocalDate date = start.plusDays(i);
            Day day = days.save(Day.builder()
                    .tripId(made.getId())
                    .sort(i)
                    .label(DayLabels.labelOf(i))
                    .shortName(from.getShortName())
                    .date(DayLabels.display(date))
                    .iso(date)
                    .theme(from.getTheme())
                    .color(from.getColor() == null ? DayLabels.colorOf(i) : from.getColor())
                    .budget(from.getBudget())
                    /* 비행기 편은 옮기지 않습니다. 날짜가 달라지면 그 편도
                       달라지는데, 남아 있으면 예약한 줄 알고 지나칩니다. */
                    .build());

            for (Place p : places.findAllByDayIdOrderBySortAsc(from.getId())) {
                places.save(Place.builder()
                        .dayId(day.getId())
                        .sort(p.getSort())
                        .name(p.getName())
                        .ja(p.getJa())
                        .en(p.getEn())
                        .lat(p.getLat())
                        .lng(p.getLng())
                        .cat(p.getCat())
                        .icon(p.getIcon())
                        .time(p.getTime())
                        .cost(p.getCost())
                        .costAmount(p.getCostAmount())
                        .costCurrency(p.getCostCurrency())
                        .note(p.getNote())
                        .url(p.getUrl())
                        .radius(p.getRadius())
                        .fit(p.isFit())
                        .move(p.getMove())
                        .placeId(p.getPlaceId())
                        .updatedBy(me.id())
                        .build());
            }
        }

        audit.log(me.id(), "trip.duplicate", made.getId(),
                Map.of("from", tripId, "title", cleanTitle, "startIso", startIso));
        return made;
    }

    /**
     * 여행 하나를 집습니다.
     *
     * id 를 생략하면 내가 속한 여행 중 가장 먼저 만들어진 것을 봅니다. 예전처럼
     * 전체에서 첫 여행을 집으면 남의 여행이 걸리므로 반드시 나를 기준으로
     * 찾아야 합니다.
     */
    @Transactional(readOnly = true)
    public Trip resolveFor(AuthPrincipal me, String tripId) {
        if (tripId != null && !tripId.isBlank()) {
            return trips.findById(tripId)
                    .orElseThrow(() -> ApiException.notFound("여행을 찾을 수 없습니다."));
        }
        return members.findAllByIdUserId(me.id()).stream()
                .map(m -> trips.findById(m.getTripId()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .min(java.util.Comparator.comparing(Trip::getCreatedAt))
                .orElseThrow(() -> ApiException.notFound("아직 여행이 없습니다."));
    }

    @Transactional
    public Trip create(AuthPrincipal me, String title, String startIso, int nights) {
        String cleanTitle = title == null ? "" : title.trim();
        if (cleanTitle.isEmpty()) {
            throw ApiException.badRequest("여행 이름을 지어 주세요.");
        }
        LocalDate start = DayLabels.parse(startIso);
        int nightCount = Math.max(0, Math.min(MAX_NIGHTS, nights));

        Trip trip = trips.save(Trip.builder().title(cleanTitle).ownerId(me.id()).build());
        members.save(new TripMember(trip.getId(), me.id(), TripRole.EDITOR));

        /* 0박이면 당일치기라 하루, 3박이면 나흘입니다. */
        for (int i = 0; i <= nightCount; i++) {
            LocalDate date = start.plusDays(i);
            days.save(Day.builder()
                    .tripId(trip.getId())
                    .sort(i)
                    .label(DayLabels.labelOf(i))
                    .date(DayLabels.display(date))
                    .iso(date)
                    .color(DayLabels.colorOf(i))
                    .build());
        }

        audit.log(me.id(), "trip.create", trip.getId(),
                Map.of("title", cleanTitle, "startIso", startIso, "nights", nightCount));
        return trip;
    }

    /**
     * 이름과 시작일을 고칩니다.
     *
     * 시작일을 옮기면 나머지 날짜도 같은 간격으로 따라 움직입니다. 하루만
     * 밀렸는데 날짜를 전부 다시 잡게 하면 번거롭기 때문입니다.
     */
    @Transactional
    public void update(AuthPrincipal me, String tripId, String title, String startIso) {
        Trip trip = resolveFor(me, tripId);
        access.requireCanEdit(trip.getId(), me.id());

        if (title != null) {
            String cleanTitle = title.trim();
            if (cleanTitle.isEmpty()) {
                throw ApiException.badRequest("여행 이름이 비어 있습니다.");
            }
            trip.setTitle(cleanTitle);
        }

        if (startIso != null && !startIso.isBlank()) {
            LocalDate start = DayLabels.parse(startIso);
            List<Day> dayList = days.findAllByTripIdOrderBySortAsc(trip.getId());
            for (int i = 0; i < dayList.size(); i++) {
                LocalDate moved = start.plusDays(i);
                dayList.get(i).setIso(moved);
                dayList.get(i).setDate(DayLabels.display(moved));
            }
        }
        audit.log(me.id(), "trip.update", trip.getId(),
                Map.of("title", String.valueOf(title), "startIso", String.valueOf(startIso)));
    }

    /**
     * 여행을 지웁니다. 날짜·장소·가계부·동행자가 함께 사라집니다.
     *
     * 만든 사람만 지울 수 있습니다. 동행자는 나가는 것으로 끝냅니다 —
     * 남의 여행을 통째로 없앨 수 있으면 안 됩니다.
     */
    @Transactional
    public void delete(AuthPrincipal me, String tripId) {
        Trip trip = access.requireOwner(tripId, me.id());
        trips.delete(trip);
        audit.log(me.id(), "trip.delete", trip.getId(), Map.of("title", trip.getTitle()));
    }

    public record TripSummary(String id, String title, String ownerId,
                              LocalDate startIso, LocalDate endIso,
                              int dayCount, int placeCount) {
    }
}
