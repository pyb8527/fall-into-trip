package net.weeniebeenie.fit.support.moderation;

import net.weeniebeenie.fit.shared.error.ApiException;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

/**
 * 올릴 때 막는 말.
 *
 * <h3>왜 두나</h3>
 *
 * <p>구글 플레이와 애플이 사람이 올리는 글이 있는 앱에 「걸러내는 방법」을
 * 묻습니다. 신고가 세 건 쌓이면 감추는 것(여행기 · 댓글 · 팁 · 피드)은
 * <b>올라간 뒤</b>의 일이고, 이것은 그 앞의 일입니다 — 누가 봐도 욕인 말이
 * 처음부터 남의 화면에 서지 않게 합니다.
 *
 * <h3>목록을 작게 둡니다</h3>
 *
 * <p>누가 봐도 욕인 것만 담습니다. 목록이 커질수록 멀쩡한 말이 걸리고,
 * 걸린 사람은 무엇이 문제인지 모른 채 글을 몇 번 고치다 그만둡니다 — 그
 * 값이 욕 하나를 놓치는 값보다 큽니다. 놓친 것은 신고가 받습니다.
 *
 * <h3>어떻게 견주나</h3>
 *
 * <p>사람은 「씨.발」, 「씨1발」, 「fuuuck」, 「f u c k」 처럼 피해 적습니다.
 * 그래서 견주기 전에 다듬습니다({@link #normalize}) — 작은 글자로, 글자가
 * 아닌 것(띄어쓰기 · 기호 · 숫자)을 걷고, 같은 글자가 이어지면 하나로.
 *
 * <p>그런데 <b>띄어쓰기까지 걷어 낸 글 전체</b>에 두 글자짜리를 대면
 * 멀쩡한 말이 걸립니다 — 「솜씨 발휘」가 「솜씨발휘」가 되어 「씨발」을
 * 품습니다. 「다시 발견」, 「화병 신경」도 같습니다. 그래서 두 갈래로 봅니다.
 *
 * <ul>
 *   <li><b>낱말마다</b>({@link #WORDS}) — 띄어쓰기로 가른 한 덩이 안에서만
 *       봅니다. 「씨.발」은 한 덩이라 걸리고, 「솜씨 발휘」는 두 덩이라 안
 *       걸립니다. 「씨 발」처럼 띄워 쓰면 빠져나가는데, 그것은 신고가
 *       받습니다</li>
 *   <li><b>글 전체로</b>({@link #SPREAD}) — 세 글자 넘게 긴 것과 영어
 *       「fuck」만. 길수록 우연히 생길 일이 없어서, 「개 새 끼」나
 *       「f u c k」 처럼 띄워 쓴 것도 잡습니다</li>
 * </ul>
 *
 * <p>견줄 때 먼저 <b>멀쩡한 말</b>({@link #ALLOWED})을 지웁니다. 「시발점」
 * 안의 「시발」, 영국 땅이름 「Scunthorpe」 안의 「cunt」 같은 것입니다.
 *
 * <p>목록은 다듬은 꼴로 적습니다 — 견줄 쪽도 다듬은 것이라, 같은 글자가
 * 이어지는 말을 목록에 적으면 영영 안 걸립니다. 멀쩡한 말 쪽은 넣을 때
 * {@link #normalize} 를 거칩니다.
 */
public final class BadWords {

    /** 걸렸을 때 사람에게 하는 말. 어느 말이 걸렸는지는 안 짚습니다 — 짚으면 피해 가는 법을 가르칩니다. */
    public static final String MESSAGE = "쓸 수 없는 말이 들어 있어요. 고쳐서 다시 올려 주세요.";

    /**
     * 낱말 한 덩이 안에서 찾는 것.
     *
     * <p>「시발」을 넣고 「시발점」 · 「시발역」을 {@link #ALLOWED} 로 둡니다.
     * 「새끼」는 안 넣습니다 — 「새끼 고양이」가 걸립니다. 「미친」도 안
     * 넣습니다 — 「미친 풍경」은 이 앱에서 칭찬입니다. 「씨바」도 뺐습니다 —
     * 「아저씨바보」처럼 붙여 쓴 말에서 생깁니다.
     *
     * <h3>영어가 둘뿐인 까닭</h3>
     *
     * <p>여행 앱이라 일본 땅이름을 로마자로 적는 일이 잦습니다. 「shit」은
     * 오사카의 「Shitennoji」(사천왕사)와 도쿄의 「Shitamachi」에, 「bitch」는
     * 오카야마의 「Bitchu」에 들어 있습니다. 같은 글자를 하나로 줄이고 나면
     * 「nigger」는 나라 이름 「Niger」가 되고, 「nigga」는 「Niigata」(니가타)
     * 안에 생깁니다. 그런 것을 다 {@link #ALLOWED} 로 받아 내기보다, 땅이름에
     * 안 나오는 둘만 둡니다. 나머지는 신고가 받습니다.
     */
    static final List<String> WORDS = List.of(
            "씨발", "시발", "씨팔", "ㅅㅂ", "ㅆㅂ",
            "병신", "븅신", "ㅄ",
            "좆", "지랄", "썅",
            "개새끼", "개새기", "개색기", "개색끼", "개세끼",
            "미친놈", "미친년", "니애미", "느금마", "엠창",
            "fuck", "cunt");

    /**
     * 띄어쓰기를 다 걷은 글 전체에서도 찾는 것.
     *
     * <p>세 글자가 넘는 한국말과 「fuck」뿐입니다. 짧은 것을 여기 넣으면
     * 낱말 사이에서 우연히 생깁니다(위 설명).
     */
    static final List<String> SPREAD = List.of(
            "개새끼", "개새기", "개색기", "개색끼", "개세끼",
            "미친놈", "미친년", "니애미", "느금마",
            "fuck");

    /**
     * 걸릴 말을 품었지만 멀쩡한 것. 견주기 전에 지웁니다.
     *
     * <p>{@link #normalize} 를 거친 꼴로 담습니다.
     */
    static final List<String> ALLOWED = List.of(
            "시발점", "시발역", "scunthorpe")
            .stream().map(BadWords::normalize).toList();

    private BadWords() {
    }

    /**
     * 막을 말이 있으면 400 으로 돌려보냅니다.
     *
     * <p>비어 있으면 그냥 지나갑니다 — 빈 글을 받을지는 부르는 쪽이 정합니다.
     */
    public static void check(String text) {
        if (contains(text)) {
            throw ApiException.badRequest(MESSAGE);
        }
    }

    /** 여러 칸을 한 번에. 제목과 본문처럼 함께 올라가는 것들입니다. */
    public static void check(String... texts) {
        for (String text : texts) {
            check(text);
        }
    }

    /** 막을 말이 들어 있는가. */
    public static boolean contains(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        for (String chunk : text.split("\\s+")) {
            String word = withoutAllowed(normalize(chunk));
            if (word.isEmpty()) {
                continue;
            }
            for (String bad : WORDS) {
                if (word.contains(bad)) {
                    return true;
                }
            }
        }
        String whole = withoutAllowed(normalize(text));
        for (String bad : SPREAD) {
            if (whole.contains(bad)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 견주기 좋게 다듬습니다.
     *
     * <ol>
     *   <li>NFC 로 모읍니다 — 맥에서 붙여 넣은 한글은 자모가 풀려 옵니다</li>
     *   <li>작은 글자로</li>
     *   <li>글자가 아닌 것을 걷습니다 — 띄어쓰기 · 기호 · 숫자. 「씨1발」,
     *       「f.u.c.k」 를 잡으려는 것입니다</li>
     *   <li>같은 글자가 이어지면 하나로 — 「fuuuuck」, 「씨씨발」</li>
     * </ol>
     */
    static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String text = Normalizer.normalize(raw, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
        StringBuilder out = new StringBuilder(text.length());
        int last = -1;
        for (int i = 0; i < text.length(); ) {
            int cp = text.codePointAt(i);
            i += Character.charCount(cp);
            if (!Character.isLetter(cp) || cp == last) {
                continue;
            }
            out.appendCodePoint(cp);
            last = cp;
        }
        return out.toString();
    }

    private static String withoutAllowed(String normalized) {
        String out = normalized;
        for (String ok : ALLOWED) {
            out = out.replace(ok, "");
        }
        return out;
    }
}
