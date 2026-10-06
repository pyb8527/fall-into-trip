package net.weeniebeenie.fit.shared.text;

/**
 * 이름 뒤에 붙는 조사(을/를 · 이/가 · 은/는).
 *
 * <h3>왜 따로 두는가</h3>
 *
 * <p>알림 문장이 「「도쿄 여행」 를 추천했어요」였습니다. 이름은 사람이 짓는
 * 것이라 받침이 있을지 없을지 미리 모르는데, 문장마다 「를」을 박아 두고
 * 있었습니다. 낫표와 조사 사이를 띄운 것도 그 때문입니다 — 붙여 쓰면 틀린
 * 조사가 더 눈에 띄니 띄워서 얼버무린 것인데, 맞춤법으로는 붙여 씁니다.
 *
 * <h3>한글이 아닌 끝 글자</h3>
 *
 * <p>숫자는 읽는 소리로 가립니다(「3」은 「삼」이라 받침이 있습니다). 영문은
 * 읽는 법이 낱말마다 달라 맞힐 수 없어서, 그때만 「을(를)」처럼 둘 다
 * 적습니다. 틀린 하나보다 둘 다 적힌 쪽이 덜 거슬립니다.
 */
public final class Josa {

    private Josa() {
    }

    /** 받침이 있으면 앞의 것, 없으면 뒤의 것. 모르면 「앞(뒤)」. */
    public static String pick(String word, String withFinal, String withoutFinal) {
        Boolean hasFinal = hasFinal(word);
        if (hasFinal == null) {
            return withFinal + "(" + withoutFinal + ")";
        }
        return hasFinal ? withFinal : withoutFinal;
    }

    /** 「이름」을 · 「이름」를 */
    public static String quoted(String name, String withFinal, String withoutFinal) {
        return "「" + name + "」" + pick(name, withFinal, withoutFinal);
    }

    /**
     * 끝 글자에 받침이 있는지. 가릴 수 없으면 null.
     *
     * <p>괄호·따옴표 같은 꼬리는 건너뜁니다 — 「도쿄 (3박)」의 끝은 「박」입니다.
     */
    static Boolean hasFinal(String word) {
        if (word == null) {
            return null;
        }
        for (int i = word.length() - 1; i >= 0; i--) {
            char c = word.charAt(i);
            if (c >= 0xAC00 && c <= 0xD7A3) {
                return (c - 0xAC00) % 28 != 0;
            }
            if (c >= '0' && c <= '9') {
                /* 영 일 이 삼 사 오 육 칠 팔 구 */
                return "013678".indexOf(c) >= 0;
            }
            if (Character.isLetter(c)) {
                return null;
            }
        }
        return null;
    }
}
