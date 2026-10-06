package net.weeniebeenie.fit.shared.text;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JosaTest {

    @Test
    @DisplayName("받침이 있으면 을, 없으면 를")
    void hangul() {
        assertEquals("「도쿄 여행」을", Josa.quoted("도쿄 여행", "을", "를"));
        assertEquals("「퇴근길」을", Josa.quoted("퇴근길", "을", "를"));
        assertEquals("「오사카」를", Josa.quoted("오사카", "을", "를"));
        assertEquals("「센소지」가", Josa.quoted("센소지", "이", "가"));
    }

    @Test
    @DisplayName("숫자는 읽는 소리로 — 3(삼)은 받침, 4(사)는 아님")
    void digits() {
        assertEquals("을", Josa.pick("1박 3", "을", "를"));
        assertEquals("를", Josa.pick("Day 4", "을", "를"));
    }

    @Test
    @DisplayName("괄호 꼬리는 건너뛰고, 영문으로 끝나면 둘 다 적는다")
    void tails() {
        assertEquals("을", Josa.pick("도쿄 (3박)", "을", "를"));
        assertEquals("을(를)", Josa.pick("Calbee+", "을", "를"));
        assertEquals("을(를)", Josa.pick("", "을", "를"));
    }
}
