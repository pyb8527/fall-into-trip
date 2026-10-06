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
}
