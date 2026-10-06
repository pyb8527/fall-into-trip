package net.weeniebeenie.fit.trip.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import net.weeniebeenie.fit.shared.error.ApiException;

import java.util.Set;

/**
 * 다음 장소까지 어떻게 가는지 — 사람이 적어 두는 이동 한 토막({@code places.move}).
 *
 * <h3>왜 따로 적게 하는가</h3>
 *
 * <p>운영 서버의 도쿄 3박 4일 63곳 가운데 서른 남짓이 역이었습니다. 「닛포리 역」을
 * 장소로 넣고 메모에 「야마노테선 탑승 약 10분 소요」를 적는 식입니다. 이동을
 * 적을 칸이 없으니 역을 장소로 넣어 그 메모 칸을 빌린 것입니다. 그러면 영수증의
 * 「몇 곳」이 부풀고, 지도에 역 핀이 깔리고, 「지금 뜨는 곳」에 역이 올라옵니다.
 *
 * <p>칸({@code move} jsonb)은 V1 부터 있었는데 그리는 화면이 없었습니다. 구글이
 * 셈해 주는 구간({@code GapBlock})과 다릅니다 — 그쪽은 「몇 분 걸린다」이고
 * 이쪽은 <b>사람이 정한 길</b>입니다(어느 노선, 몇 번 출구, 스이카 충전).
 *
 * <h3>받는 모양</h3>
 *
 * <p>{@code {mode, min, via, cost}}. 모르는 칸은 버리고, 길이를 자르지 않고
 * 거절합니다 — 잘라 두면 적은 사람은 다 들어간 줄 압니다. 넷 다 비면 「적은
 * 것 없음」(null)입니다.
 */
public final class Leg {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** 전철 · 버스 · 걷기 · 택시 · 차 · 비행기 · 배. */
    public static final Set<String> MODES =
            Set.of("transit", "bus", "walk", "taxi", "car", "flight", "ferry");

    static final int VIA_MAX = 80;
    static final int COST_MAX = 40;
    /** 하루. 그보다 긴 이동은 날을 나눠 적습니다. */
    static final int MIN_MAX = 24 * 60;

    private Leg() {
    }

    /**
     * 받은 것을 저장할 모양으로.
     *
     * @param raw 화면이 보낸 JSON 글자. 빈 글자면 지웁니다
     * @return 저장할 JSON. 적은 것이 없으면 null
     */
    public static String clean(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        JsonNode in;
        try {
            in = JSON.readTree(raw);
        } catch (Exception e) {
            throw ApiException.badRequest("이동을 읽지 못했어요.");
        }
        if (in == null || !in.isObject()) {
            throw ApiException.badRequest("이동을 읽지 못했어요.");
        }
        ObjectNode out = JSON.createObjectNode();

        String mode = text(in, "mode");
        if (mode != null) {
            if (!MODES.contains(mode)) {
                throw ApiException.badRequest("모르는 이동 수단이에요.");
            }
            out.put("mode", mode);
        }
        JsonNode min = in.get("min");
        if (min != null && !min.isNull()) {
            if (!min.canConvertToInt() || min.asInt() < 0 || min.asInt() > MIN_MAX) {
                throw ApiException.badRequest("걸리는 시간은 0분에서 24시간 사이로 적어 주세요.");
            }
            if (min.asInt() > 0) {
                out.put("min", min.asInt());
            }
        }
        String via = text(in, "via");
        if (via != null) {
            if (via.length() > VIA_MAX) {
                throw ApiException.badRequest("가는 길은 " + VIA_MAX + "자까지 적을 수 있어요.");
            }
            out.put("via", via);
        }
        String cost = text(in, "cost");
        if (cost != null) {
            if (cost.length() > COST_MAX) {
                throw ApiException.badRequest("요금은 " + COST_MAX + "자까지 적을 수 있어요.");
            }
            out.put("cost", cost);
        }
        return out.isEmpty() ? null : out.toString();
    }

    private static String text(JsonNode in, String field) {
        JsonNode v = in.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        String t = v.asText("").trim();
        return t.isEmpty() ? null : t;
    }
}
