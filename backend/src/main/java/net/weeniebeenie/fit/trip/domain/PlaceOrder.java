package net.weeniebeenie.fit.trip.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 하루 안에서 장소가 서는 차례.
 *
 * <h3>손으로 세운 자리를 뺏지 않습니다</h3>
 *
 * <p>전에는 <b>시간을 안 적은 곳을 전부 뒤로</b> 보냈습니다. 그래서 끌어서
 * 셋째 자리에 옮겨 둔 곳을 열어 메모 한 줄만 고쳐도, 저장하는 순간 그 곳이
 * 맨 아래로 내려갔습니다. 옮긴 사람 눈에는 고친 것과 아무 상관 없는 일이
 * 벌어진 것이고, 실제로도 그렇습니다.
 *
 * <p>시간을 안 적었다는 것은 "아무 데나 가도 된다" 가 아닙니다. 대개는
 * "몇 시인지는 모르겠고 여기 들렀다가 저기" 라는 뜻이고, 그 뜻은 순서에만
 * 담겨 있습니다. 그것을 지웁니다.
 *
 * <h3>덩어리로 옮깁니다</h3>
 *
 * <p>시간이 적힌 곳 하나와, 그 뒤에 붙어 있는 시간 없는 곳들을 한 덩어리로
 * 봅니다. 13:00 예약 뒤에 놓아 둔 카페는 그 예약을 따라다니는 것이지 하루의
 * 셋째 자리에 매인 것이 아닙니다. 덩어리끼리만 시각순으로 다시 세우면,
 * 시간이 적힌 곳은 제 시각에 서고 시간 없는 곳은 제가 따라다니던 곳 뒤에
 * 그대로 남습니다.
 *
 * <p>맨 앞에 시간 없는 곳들이 있으면 그대로 맨 앞입니다. 거기 둔 것은
 * "하루를 여기서 시작한다" 는 뜻입니다.
 *
 * <p>이 규칙은 {@link RouteTidy} 가 이미 쓰고 있는 것과 같습니다 — 시간이
 * 적힌 곳이 기둥이고 나머지는 그 사이에 끼워집니다. 두 자리가 다른 규칙을
 * 갖고 있을 이유가 없었습니다.
 */
public final class PlaceOrder {

    private PlaceOrder() {
    }

    /**
     * 지금 순서를 받아 다시 세운 순서를 돌려줍니다.
     *
     * <p>받은 목록은 건드리지 않습니다. {@code sort} 를 실제로 고쳐 넣는 것은
     * 부르는 쪽의 일입니다.
     *
     * @param current {@code sort} 순으로 늘어놓은 그 날의 장소들
     */
    public static List<Place> arrange(List<Place> current) {
        List<Place> lead = new ArrayList<>();
        List<List<Place>> blocks = new ArrayList<>();

        for (Place place : current) {
            if (timeOf(place) == null) {
                /* 시간이 적힌 곳이 아직 안 나왔으면 하루의 머리입니다. */
                (blocks.isEmpty() ? lead : blocks.get(blocks.size() - 1)).add(place);
            } else {
                List<Place> block = new ArrayList<>();
                block.add(place);
                blocks.add(block);
            }
        }

        /* 자바의 정렬은 안정적입니다. 같은 시각이 둘이면 원래 차례를 지킵니다. */
        blocks.sort(Comparator.comparing((List<Place> block) -> timeOf(block.get(0))));

        List<Place> out = new ArrayList<>(current.size());
        out.addAll(lead);
        blocks.forEach(out::addAll);
        return out;
    }

    /** 적어 둔 시각. 빈 글자는 안 적은 것과 같게 봅니다. */
    private static String timeOf(Place place) {
        String time = place.getTime();
        return time == null || time.isBlank() ? null : time;
    }
}
