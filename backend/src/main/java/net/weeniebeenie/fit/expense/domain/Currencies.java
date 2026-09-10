package net.weeniebeenie.fit.expense.domain;

import net.weeniebeenie.fit.shared.error.ApiException;

import java.util.Currency;
import java.util.List;
import java.util.Locale;

/**
 * 통화 이름을 다루는 자리.
 *
 * <p>자릿수 표를 우리가 들고 있지 않습니다. JDK 가 통화별로 이미 알고
 * 있습니다 — 엔·원은 0, 달러는 2. 손으로 적어 두면 언젠가 어긋나고, 그
 * 어긋남은 돈 계산에서 드러납니다.
 */
public final class Currencies {

    /**
     * 고르는 화면에 먼저 내놓을 것들.
     *
     * <p>이 앱으로 가는 곳들입니다. 여기 없는 통화도 받습니다 — 목록은
     * 손이 덜 가게 하는 것이지 울타리가 아닙니다.
     */
    public static final List<String> COMMON =
            List.of("KRW", "JPY", "USD", "EUR", "TWD", "HKD", "THB", "SGD", "VND", "CNY");

    private Currencies() {
    }

    /**
     * 아는 통화인지 보고 대문자로 맞춥니다.
     *
     * @return 세 글자 코드. 비워 두었으면 원화로 봅니다 — 쓰는 사람이 한국에
     *         있습니다.
     */
    public static String clean(String raw) {
        String code = raw == null || raw.isBlank() ? "KRW" : raw.trim().toUpperCase(Locale.ROOT);
        try {
            Currency.getInstance(code);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("모르는 통화입니다: " + code);
        }
        return code;
    }

    /**
     * 이 통화가 소수점 아래 몇 자리를 쓰는지.
     *
     * <p>화면이 "1250" 을 "$12.50" 으로 보여 줄 때 씁니다. 엔·원은 0 이라
     * 그대로 씁니다.
     */
    public static int decimals(String code) {
        Currency currency = Currency.getInstance(code);
        int digits = currency.getDefaultFractionDigits();
        /* 금·은처럼 자릿수가 정의되지 않은 것은 -1 로 옵니다. 돈으로 쓸 일이
           없지만, 왔을 때 음수로 셈하지 않게 막습니다. */
        return Math.max(0, digits);
    }
}
