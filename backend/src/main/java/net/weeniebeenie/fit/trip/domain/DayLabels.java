package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.shared.error.ApiException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * 날짜를 화면에 쓰는 문자열로 바꿉니다. "10.08 (목)" 같은 모양입니다.
 *
 * <p>앞선 Node 백엔드에서는 이 계산을 반드시 UTC 로 해야 했습니다. 문자열을
 * 로컬 자정으로 파싱해 놓고 다시 UTC 로 되돌리면 UTC+9 인 서버에서 하루가
 * 밀렸기 때문입니다. {@link LocalDate} 는 애초에 시간대를 갖지 않아 그 함정이
 * 없습니다.
 */
public final class DayLabels {

    /** 날짜마다 다른 색을 돌려 씁니다. 지도의 동선 색과 같습니다. */
    public static final String[] COLORS = {
            "#f04452", "#e07800", "#7c5cff", "#00a98f",
            "#3182f6", "#e8590c", "#12b886", "#845ef7"
    };

    private static final String[] WEEK = {"월", "화", "수", "목", "금", "토", "일"};

    private DayLabels() {
    }

    public static LocalDate parse(String iso) {
        if (iso == null || iso.isBlank()) {
            throw ApiException.badRequest("날짜를 입력해 주세요. (YYYY-MM-DD)");
        }
        try {
            return LocalDate.parse(iso.trim());
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("날짜가 올바르지 않습니다. (YYYY-MM-DD)");
        }
    }

    /** "10.08 (목)" */
    public static String display(LocalDate date) {
        if (date == null) {
            return null;
        }
        DayOfWeek dow = date.getDayOfWeek();
        return "%02d.%02d (%s)".formatted(
                date.getMonthValue(), date.getDayOfMonth(), WEEK[dow.getValue() - 1]);
    }

    public static String colorOf(int index) {
        return COLORS[Math.floorMod(index, COLORS.length)];
    }

    public static String labelOf(int index) {
        return "Day " + (index + 1);
    }
}
