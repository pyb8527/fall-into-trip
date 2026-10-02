package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Ids;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;

/**
 * 로그인 없이 보는 일정 링크.
 *
 * <h3>일정만 냅니다</h3>
 *
 * <p>「계정 없이 동행자 자동 등록」을 반대한 까닭이 「여행 안에 위치와
 * 가계부가 있다」였습니다(docs/ideas.md). 그래서 이 링크로는 날짜·장소
 * 이름·시각·메모만 보입니다. 가계부·위치·피드·사람 이름은 안 나가고,
 * 안내판도 안 나갑니다 — 도어락 번호가 들어 있는 자리입니다.
 *
 * <h3>저절로 죽습니다</h3>
 *
 * <p>여행 마지막 날 다음 날부터 404 입니다. 죽는 날을 적어 두지 않고
 * 볼 때마다 날짜에서 셉니다 — 날짜를 옮기면 죽는 날도 따라 옮겨야 하는데,
 * 적어 두면 그 둘이 어긋납니다.
 *
 * <p>모르는 열쇠, 끊은 열쇠, 지난 열쇠는 모두 똑같이 404 입니다. 무엇이
 * 다른지 알려 주면 그것이 찔러 보는 사람에게 힌트가 됩니다.
 */
@Service
@RequiredArgsConstructor
public class ViewLinkService {

    private final TripRepository trips;
    private final DayRepository days;
    private final PlaceRepository places;
    private final TripAccessPolicy access;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public State stateOf(AuthPrincipal me, String tripId) {
        Trip trip = access.mine(tripId, me.id());
        return new State(trip.getViewTokenHash() != null, lastDay(tripId));
    }

    /** 새 링크. 옛 링크는 이 순간 죽습니다. 원문은 여기서 한 번만 나갑니다. */
    @Transactional
    public String issue(AuthPrincipal me, String tripId) {
        Trip trip = access.mine(tripId, me.id());
        access.requireCanEdit(tripId, me.id());
        String raw = Ids.secret();
        trip.setViewTokenHash(sha256(raw));
        audit.log(me.id(), "trip.view.issue", tripId);
        return raw;
    }

    @Transactional
    public void revoke(AuthPrincipal me, String tripId) {
        Trip trip = access.mine(tripId, me.id());
        access.requireCanEdit(tripId, me.id());
        trip.setViewTokenHash(null);
        audit.log(me.id(), "trip.view.revoke", tripId);
    }

    /** 링크를 연 사람이 보는 것. */
    @Transactional(readOnly = true)
    public Shown show(String raw) {
        if (raw == null || raw.isBlank()) {
            throw ApiException.notFound("없는 링크예요.");
        }
        Trip trip = trips.findByViewTokenHash(sha256(raw))
                .orElseThrow(() -> ApiException.notFound("없는 링크예요."));

        LocalDate last = lastDay(trip.getId());
        if (last != null && LocalDate.now().isAfter(last)) {
            throw ApiException.notFound("없는 링크예요.");
        }

        List<ShownDay> out = days.findAllByTripIdOrderBySortAsc(trip.getId()).stream()
                .map(d -> new ShownDay(d.getLabel(), d.getDate(), d.getIso(),
                        places.findAllByDayIdOrderBySortAsc(d.getId()).stream()
                                .map(p -> new ShownPlace(p.getName(), p.getTime(), p.getNote(),
                                        p.getLat(), p.getLng(), p.getCat()))
                                .toList()))
                .toList();
        return new Shown(trip.getTitle(), trip.getEmoji(), trip.getTheme(), last, out);
    }

    private LocalDate lastDay(String tripId) {
        List<Day> list = days.findAllByTripIdOrderBySortAsc(tripId);
        return list.isEmpty() ? null : list.get(list.size() - 1).getIso();
    }

    private static String sha256(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** @param until 이 날까지 열립니다(여행 마지막 날) */
    public record State(boolean on, LocalDate until) {
    }

    /** 사람 이름이 하나도 없습니다 — 누가 넣었는지, 누가 가는지. */
    public record Shown(String title, String emoji, String theme, LocalDate until, List<ShownDay> days) {
    }

    public record ShownDay(String label, String date, LocalDate iso, List<ShownPlace> places) {
    }

    public record ShownPlace(String name, String time, String note, double lat, double lng, String cat) {
    }
}
