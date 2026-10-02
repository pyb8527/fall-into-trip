package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.shared.domain.Ids;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 캘린더 구독 — 폰 캘린더가 로그인 없이 읽어 가는 {@code .ics}.
 *
 * <h3>앱 안 달력과 서로 대신하지 않습니다</h3>
 *
 * <p>앱 안 달력은 앱을 열어야 보이고, 이것은 폰 캘린더에 뜹니다. 회사
 * 일정 옆에 「제주 2박 3일」이 같이 보여야 그 주에 회식을 안 잡습니다.
 *
 * <h3>사람마다 열쇠 하나</h3>
 *
 * <p>그 사람이 볼 수 있는 여행 전부가 들어갑니다. 「못 가요」라고 한
 * 여행은 뺍니다 — 안 가는 여행이 내 캘린더를 막고 있으면 안 됩니다.
 *
 * <h3>담는 것은 적게</h3>
 *
 * <p>날짜, 날마다 들르는 곳의 이름과 시각만. 가계부·위치·메모·안내판은
 * 안 담습니다 — 이 주소는 로그인 없이 읽히고, 캘린더 앱은 그 내용을 제
 * 서버로 가져갑니다.
 */
@Service
@RequiredArgsConstructor
public class CalendarService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter STAMP =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    private final UserRepository users;
    private final TripAccessPolicy access;
    private final TripGoingRepository going;
    private final DayRepository days;
    private final PlaceRepository places;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public boolean isOn(String userId) {
        return users.findById(userId).map(u -> u.getCalTokenHash() != null).orElse(false);
    }

    /**
     * 새 열쇠를 만듭니다. 옛 주소는 이 순간 죽습니다.
     *
     * <p>원문은 여기서 한 번만 돌려줍니다. 저장은 해시로만 합니다.
     */
    @Transactional
    public String issue(String userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요해요."));
        String raw = Ids.secret();
        user.setCalTokenHash(sha256(raw));
        audit.log(userId, "calendar.issue", userId);
        return raw;
    }

    @Transactional
    public void revoke(String userId) {
        users.findById(userId).ifPresent(u -> u.setCalTokenHash(null));
        audit.log(userId, "calendar.revoke", userId);
    }

    /** 주소 속 열쇠로 그 사람의 캘린더를 씁니다. 모르는 열쇠는 404. */
    @Transactional(readOnly = true)
    public String ics(String raw) {
        if (raw == null || raw.isBlank()) {
            throw ApiException.notFound("없는 캘린더예요.");
        }
        User user = users.findByCalTokenHash(sha256(raw))
                .filter(u -> !u.isDisabled())
                .orElseThrow(() -> ApiException.notFound("없는 캘린더예요."));

        Set<String> away = going.findAllByIdUserIdAndAnswer(user.getId(), GoingAnswer.NOT_GOING)
                .stream().map(g -> g.getId().getTripId()).collect(Collectors.toSet());

        StringBuilder out = new StringBuilder();
        line(out, "BEGIN:VCALENDAR");
        line(out, "VERSION:2.0");
        line(out, "PRODID:-//fit//trips//KO");
        line(out, "CALSCALE:GREGORIAN");
        line(out, "METHOD:PUBLISH");
        line(out, "X-WR-CALNAME:" + text("FIT 여행"));
        /* 구글 캘린더는 이것을 거의 안 따르지만, 애플 캘린더는 따릅니다. */
        line(out, "REFRESH-INTERVAL;VALUE=DURATION:PT6H");
        line(out, "X-PUBLISHED-TTL:PT6H");

        String now = STAMP.format(Instant.now());
        for (Trip trip : access.tripsOf(user.getId())) {
            if (away.contains(trip.getId())) {
                continue;
            }
            List<Day> list = days.findAllByTripIdOrderBySortAsc(trip.getId()).stream()
                    .filter(d -> d.getIso() != null)
                    .toList();
            if (list.isEmpty()) {
                continue;
            }
            LocalDate from = list.get(0).getIso();
            LocalDate to = list.get(list.size() - 1).getIso();

            /* 하루마다 들르는 곳을 한 줄씩. 시각이 있으면 앞에 붙입니다. 시각을
               따로 일정으로 쪼개지 않습니다 — 여행지 시각에는 시간대가 없어서,
               폰 시간대로 옮겨 그리면 해외여행 일정이 몇 시간씩 밀립니다. */
            StringBuilder about = new StringBuilder();
            for (Day d : list) {
                List<Place> on = places.findAllByDayIdOrderBySortAsc(d.getId());
                about.append(d.getDate() == null ? d.getLabel() : d.getDate());
                if (on.isEmpty()) {
                    about.append(" —");
                }
                for (int i = 0; i < on.size(); i++) {
                    Place p = on.get(i);
                    about.append(i == 0 ? " " : " · ");
                    if (p.getTime() != null && !p.getTime().isBlank()) {
                        about.append(p.getTime().trim()).append(' ');
                    }
                    about.append(p.getName());
                }
                about.append('\n');
            }

            line(out, "BEGIN:VEVENT");
            line(out, "UID:" + trip.getId() + "@fit");
            line(out, "DTSTAMP:" + now);
            /* 하루 종일 일정. 끝 날은 「그다음 날」로 적는 것이 규칙입니다. */
            line(out, "DTSTART;VALUE=DATE:" + DAY.format(from));
            line(out, "DTEND;VALUE=DATE:" + DAY.format(to.plusDays(1)));
            line(out, "SUMMARY:" + text((trip.getEmoji() == null ? "" : trip.getEmoji() + " ")
                    + trip.getTitle()));
            line(out, "DESCRIPTION:" + text(about.toString().strip()));
            line(out, "TRANSP:TRANSPARENT");
            line(out, "END:VEVENT");
        }
        line(out, "END:VCALENDAR");
        return out.toString();
    }

    /** iCalendar 글자 — 쉼표·쌍반점·역슬래시·줄바꿈을 막아 둡니다. */
    private static String text(String s) {
        return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
                .replace("\r", "").replace("\n", "\\n");
    }

    /**
     * 한 줄을 적습니다. 75 바이트를 넘으면 접습니다(RFC 5545 3.1).
     *
     * <p>한글 한 자가 3 바이트라, 글자 수로 자르면 접힌 자리가 글자 한가운데가
     * 되어 깨집니다. 바이트를 세되 글자 경계에서 자릅니다.
     */
    private static void line(StringBuilder out, String s) {
        int bytes = 0;
        int limit = 75;
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            int size = new String(Character.toChars(cp)).getBytes(StandardCharsets.UTF_8).length;
            if (bytes + size > limit) {
                out.append("\r\n ");
                bytes = 1;
                limit = 75;
            }
            out.appendCodePoint(cp);
            bytes += size;
            i += Character.charCount(cp);
        }
        out.append("\r\n");
    }

    private static String sha256(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("캘린더 열쇠를 처리하지 못했어요.", e);
        }
    }
}
