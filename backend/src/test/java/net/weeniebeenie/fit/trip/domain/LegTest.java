package net.weeniebeenie.fit.trip.domain;

import net.weeniebeenie.fit.shared.error.ApiException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LegTest {

    @Test
    @DisplayName("적은 칸만 남기고 모르는 칸은 버린다")
    void keepsKnown() {
        assertEquals("{\"mode\":\"transit\",\"min\":10,\"via\":\"야마노테선\"}",
                Leg.clean("{\"mode\":\"transit\",\"min\":10,\"via\":\" 야마노테선 \",\"x\":1}"));
    }

    @Test
    @DisplayName("다 비면 지운 것이다")
    void emptyIsNull() {
        assertNull(Leg.clean(""));
        assertNull(Leg.clean("{\"via\":\"  \",\"min\":0}"));
    }

    @Test
    @DisplayName("모르는 수단 · 너무 긴 글 · 하루 넘는 시간은 거절")
    void rejects() {
        assertThrows(ApiException.class, () -> Leg.clean("{\"mode\":\"rocket\"}"));
        assertThrows(ApiException.class, () -> Leg.clean("{\"via\":\"" + "가".repeat(81) + "\"}"));
        assertThrows(ApiException.class, () -> Leg.clean("{\"min\":1441}"));
        assertThrows(ApiException.class, () -> Leg.clean("[1,2]"));
        assertThrows(ApiException.class, () -> Leg.clean("not json"));
    }

    @Test
    @DisplayName("역은 이름 · 자리 · 구글 번호만 남기고, 이름만 적어도 받는다")
    void stations() {
        assertEquals("{\"mode\":\"transit\",\"from\":{\"name\":\"신주쿠역\",\"lat\":35.69,\"lng\":139.7,"
                        + "\"placeId\":\"ChIJ1\"},\"to\":{\"name\":\"시부야역\"}}",
                Leg.clean("{\"mode\":\"transit\",\"from\":{\"name\":\" 신주쿠역 \",\"lat\":35.69,"
                        + "\"lng\":139.7,\"placeId\":\"ChIJ1\",\"x\":1},\"to\":{\"name\":\"시부야역\"}}"));
        /* 이름 없는 역은 버립니다. 그것뿐이면 적은 것이 없습니다. */
        assertNull(Leg.clean("{\"from\":{\"name\":\" \",\"lat\":1,\"lng\":2}}"));
    }

    @Test
    @DisplayName("반쪽 좌표 · 지구 밖 좌표 · 너무 긴 역 이름은 거절")
    void rejectsStations() {
        assertThrows(ApiException.class, () -> Leg.clean("{\"from\":{\"name\":\"역\",\"lat\":35}}"));
        assertThrows(ApiException.class, () -> Leg.clean("{\"to\":{\"name\":\"역\",\"lat\":95,\"lng\":1}}"));
        assertThrows(ApiException.class, () -> Leg.clean("{\"to\":{\"name\":\"역\",\"lat\":\"a\",\"lng\":1}}"));
        assertThrows(ApiException.class, () -> Leg.clean("{\"to\":{\"name\":\"" + "가".repeat(81) + "\"}}"));
        assertThrows(ApiException.class, () -> Leg.clean("{\"to\":\"시부야역\"}"));
    }
}
