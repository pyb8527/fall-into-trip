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
