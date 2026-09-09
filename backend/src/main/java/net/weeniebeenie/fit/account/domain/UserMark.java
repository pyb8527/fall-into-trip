package net.weeniebeenie.fit.account.domain;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 지도에서 사람을 가리키는 그림.
 *
 * <p>동행자 위치를 이름 첫 글자를 적은 동그라미로 그리고 있었습니다. 이름이
 * "지영" 이든 "지훈" 이든 지도에는 똑같이 "지" 하나만 뜹니다. 누가 어디 있는지
 * 보라고 켠 것인데 정작 누구인지가 안 보였습니다.
 *
 * <p>사람마다 하나씩 고릅니다. 동물로 둔 것은 서로 헷갈리지 않게 하기 위해서
 * 입니다 — 도형이나 색은 열 개만 넘어가도 구별이 안 되지만, 토끼와 곰은 아무리
 * 작게 그려도 다릅니다.
 *
 * <p>여기에는 <b>이름만</b> 둡니다. 실제로 어떤 이모지를 그릴지는 화면이
 * 정합니다(constants/user-marks.ts). 이모지는 기기마다 다르게 생기고, 언젠가
 * 바꾸고 싶어졌을 때 저장된 값이 이모지면 그때 쌓인 것을 전부 고쳐야 합니다.
 */
public final class UserMark {

    private UserMark() {
    }

    /** 고를 수 있는 것. 순서가 곧 고르는 화면에 늘어놓는 순서입니다. */
    public static final List<String> ALL = List.of(
            "rabbit",
            "bear",
            "cat",
            "dog",
            "fox",
            "panda",
            "koala",
            "tiger",
            "penguin",
            "chick",
            "frog",
            "whale",
            "octopus",
            "unicorn",
            "monkey",
            "hedgehog");

    private static final Set<String> KNOWN = Set.copyOf(ALL);

    /** 화면에서 넘어온 값을 그대로 믿지 않습니다. 모르는 이름이면 비웁니다. */
    public static String clean(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim().toLowerCase(Locale.ROOT);
        return KNOWN.contains(value) ? value : null;
    }
}
