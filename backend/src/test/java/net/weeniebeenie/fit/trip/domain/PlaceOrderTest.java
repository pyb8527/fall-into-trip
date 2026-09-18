package net.weeniebeenie.fit.trip.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * 끌어서 옮겨 둔 자리가 살아남는가.
 *
 * <p>끌어서 셋째 자리에 옮겨 둔 곳을 열어 메모 한 줄만 고치면 맨 아래로
 * 내려갔습니다. 시간을 안 적은 곳을 전부 뒤로 보내는 규칙이 있었고, 그
 * 규칙이 고칠 때마다 돌았기 때문입니다.
 *
 * <p>여기서 재는 것은 <b>무엇이 순서를 움직여도 되는가</b> 하나입니다 —
 * 적어 둔 시각만 움직일 수 있고, 손으로 둔 자리는 건드리지 않습니다.
 */
class PlaceOrderTest {

    private static Place at(String name, String time) {
        return Place.builder().dayId("d1").sort(0).name(name).lat(0).lng(0).time(time).build();
    }

    private static List<String> namesOf(List<Place> list) {
        return list.stream().map(Place::getName).toList();
    }

    @Test
    @DisplayName("시간을 안 적은 곳은 끌어다 둔 자리에 그대로 있는다")
    void keepsHandPlaced() {
        /* 이것이 이 묶음의 핵심입니다. 전에는 카페가 맨 뒤로 갔습니다. */
        List<Place> arranged = PlaceOrder.arrange(List.of(
                at("절", "09:00"),
                at("카페", null),
                at("시장", "13:00")));

        assertEquals(List.of("절", "카페", "시장"), namesOf(arranged));
    }

    @Test
    @DisplayName("맨 앞에 둔 시간 없는 곳은 맨 앞에 남는다")
    void keepsLeading() {
        /* 거기 둔 것은 "하루를 여기서 시작한다" 는 뜻입니다. */
        List<Place> arranged = PlaceOrder.arrange(List.of(
                at("편의점", null),
                at("절", "09:00"),
                at("시장", "13:00")));

        assertEquals(List.of("편의점", "절", "시장"), namesOf(arranged));
    }

    @Test
    @DisplayName("시각이 어긋난 것끼리는 제 시각으로 다시 선다")
    void sortsByTime() {
        List<Place> arranged = PlaceOrder.arrange(List.of(
                at("저녁", "19:00"),
                at("점심", "12:00")));

        assertEquals(List.of("점심", "저녁"), namesOf(arranged));
    }

    @Test
    @DisplayName("시간 없는 곳은 제가 따라다니던 곳을 따라 함께 옮겨 간다")
    void blocksMoveTogether() {
        /* 13:00 예약 뒤에 놓아 둔 카페는 그 예약을 따라다니는 것이지
           하루의 둘째 자리에 매인 것이 아닙니다. */
        List<Place> arranged = PlaceOrder.arrange(List.of(
                at("시장", "13:00"),
                at("카페", null),
                at("절", "09:00")));

        assertEquals(List.of("절", "시장", "카페"), namesOf(arranged));
    }

    @Test
    @DisplayName("시간이 하나도 없으면 아무것도 움직이지 않는다")
    void allLoose() {
        List<Place> arranged = PlaceOrder.arrange(List.of(
                at("셋", null), at("하나", null), at("둘", null)));

        assertEquals(List.of("셋", "하나", "둘"), namesOf(arranged));
    }

    @Test
    @DisplayName("같은 시각이 둘이면 원래 차례를 지킨다")
    void stable() {
        /* 둘 중 누가 앞인지는 사람이 정해 둔 것입니다. 뒤집을 근거가 없습니다. */
        List<Place> arranged = PlaceOrder.arrange(List.of(
                at("역", "10:00"), at("코인락커", "10:00")));

        assertEquals(List.of("역", "코인락커"), namesOf(arranged));
    }

    @Test
    @DisplayName("빈 글자는 시간을 안 적은 것과 같다")
    void blankIsNoTime() {
        List<Place> arranged = PlaceOrder.arrange(List.of(
                at("절", "09:00"), at("카페", "  "), at("시장", "13:00")));

        assertEquals(List.of("절", "카페", "시장"), namesOf(arranged));
    }
}
