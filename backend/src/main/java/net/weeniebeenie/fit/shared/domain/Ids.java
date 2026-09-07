package net.weeniebeenie.fit.shared.domain;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * 짧고 충돌 없는 문자열 ID.
 *
 * 순번(1, 2, 3…)을 쓰면 장소를 지웠을 때 방문기록·지출이 엉뚱한 장소로 옮겨
 * 붙기 때문에 고정 ID 를 씁니다. 9바이트를 base64url 로 담아 12자가 됩니다.
 */
public final class Ids {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private Ids() {
    }

    public static String next() {
        byte[] bytes = new byte[9];
        RANDOM.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }

    /** 리프레시 토큰처럼 추측이 불가능해야 하는 값. 32바이트. */
    public static String secret() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }
}
