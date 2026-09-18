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

    /**
     * 날짜마다 다른 색을 돌려 씁니다. 지도의 동선 색과 같습니다.
     *
     * <h3>붉은 자리를 비웠습니다</h3>
     *
     * <p>첫째 날이 {@code #f04452} 였습니다. 강조색을 코랄로 들이면서 그것과
     * 거의 같은 색이 되어, <b>첫째 날 핀과 동선이 "지금 눌러야 할 것" 처럼</b>
     * 보였습니다. 날짜는 이름표일 뿐인데 그중 하나만 자꾸 손을 부릅니다.
     *
     * <h3>겹치던 것도 갈랐습니다</h3>
     *
     * <p>{@code #7c5cff} 와 {@code #845ef7} 은 둘 다 보라였고 눈으로는 거의
     * 구별이 안 됐습니다. {@code #00a98f} 와 {@code #12b886} 도 마찬가지였고요.
     * 여드레짜리 여행에서 셋째 날과 여덟째 날이 같은 색이면 색을 쓰는 뜻이
     * 없습니다.
     *
     * <p>이제 여덟 색이 서로 최소 ΔE 40 만큼 떨어져 있고, 모두 흰 글씨를
     * 얹어도 읽힐 만큼 진하며, 강조색과도 ΔE 33 이상 멉니다.
     */
    /**
     * 고를 수 있는 색인가.
     *
     * <p>날짜 띠와 여행 표식이 같은 여덟 가지를 씁니다. 화면이 보내 온
     * 값을 그대로 저장하면 흰 글씨가 안 읽히는 색이나 코랄에 붙는 색이
     * 들어오는데, 그때는 이미 늦습니다.
     *
     * @return 우리 팔레트에 있으면 그 값, 비었으면 {@code null}
     * @throws ApiException 우리 것이 아닌 색이면
     */
    public static String pickColor(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String want = value.trim();
        for (String known : COLORS) {
            if (known.equalsIgnoreCase(want)) {
                return known;
            }
        }
        throw ApiException.badRequest("고를 수 없는 색입니다.");
    }

    public static final String[] COLORS = {
            "#3182f6", "#e8590c", "#0ca678", "#9c36b5",
            "#0b7285", "#8b5a2b", "#5c7f1a", "#7b2d4e"
    };

    private static final String[] WEEK = {"월", "화", "수", "목", "금", "토", "일"};

    private DayLabels() {
    }

    public static LocalDate parse(String iso) {
        if (iso == null || iso.isBlank()) {
            throw ApiException.badRequest("날짜를 넣어 주세요. (YYYY-MM-DD)");
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
