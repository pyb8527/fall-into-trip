package net.weeniebeenie.fit.feed.application;

import net.weeniebeenie.fit.feed.domain.Audience;
import net.weeniebeenie.fit.feed.domain.Post;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.function.Predicate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 피드 글의 울타리 — 누가 볼 수 있나.
 *
 * <p>{@link FeedService#visible} 은 묻지 않고 셈만 하는 자리라 여기서 그대로
 * 짚을 수 있습니다. 「묻는 일」은 두 {@link Predicate} 로 들어오므로, 시험이
 * 그 자리에 {@link #NEVER} 를 꽂아 두면 <b>물었는지 안 물었는지</b>까지 함께
 * 짚힙니다 — 목록의 글마다 모임 가입을 묻던 것이 되돌아오면 여기서 터집니다.
 *
 * <h3>왜 이 자리를 시험으로 묶어 두나</h3>
 *
 * <p>눈으로는 안 갈리는 셈입니다. 「내 모임 사람만」 하나가 올린 자리에 따라
 * 두 가지를 묻고(그 모임인가 / 모임을 함께 쓰는가), 글쓴이는 그 앞에서 먼저
 * 빠지고, 감춘 글은 글쓴이에게도 안 보입니다. 한 줄만 어긋나도 남의 사진이
 * 남에게 보이는데, 그때 화면에는 아무 표도 안 납니다.
 */
class FeedAudienceTest {

    private static final String ME = "u-me";
    private static final String THEM = "u-them";
    private static final String STRANGER = "u-stranger";

    /** 나와 그 사람이 함께 든 모임. */
    private static final String OURS = "g-ours";

    /** 그 사람만 든 모임. 나는 안 들었습니다. */
    private static final String THEIRS = "g-theirs";

    /**
     * 물으면 터지는 자리.
     *
     * <p>안 물어도 답이 나오는 갈래에 꽂습니다. 「모두」와 「나만」과 제 글은
     * 글만 보고 답이 나오므로, 여기서 한 번이라도 물으면 목록을 그릴 때 글
     * 수만큼 왕복한다는 뜻입니다.
     */
    private static final Predicate<String> NEVER = asked -> {
        throw new AssertionError("물을 일이 없는데 물었습니다: " + asked);
    };

    /** 내가 든 모임은 {@link #OURS} 하나, 모임을 함께 쓰는 사람은 {@link #THEM}. */
    private static boolean seenByMe(Post post) {
        return FeedService.visible(post, ME, Set.of(OURS)::contains, Set.of(ME, THEM)::contains);
    }

    private static Post post(String authorId, String groupId, Audience audience) {
        return Post.builder().authorId(authorId).groupId(groupId).audience(audience).build();
    }

    @Test
    @DisplayName("글쓴이는 무엇을 골랐든 제 글을 본다 — 묻지도 않는다")
    void authorAlwaysSees() {
        for (Audience a : Audience.values()) {
            assertTrue(FeedService.visible(post(ME, null, a), ME, NEVER, NEVER),
                    "내 피드에 쓴 " + a + " 글");
            assertTrue(FeedService.visible(post(ME, THEIRS, a), ME, NEVER, NEVER),
                    "내가 안 든 모임에 올려 둔 " + a + " 글");
        }
    }

    @Test
    @DisplayName("나만 보는 글은 남에게 없다 — 같은 모임 사람에게도 없다")
    void onlyMeHidesFromEveryone() {
        /* 모임 가입을 물을 것도 없습니다. 같은 모임이어도 답이 같습니다. */
        assertFalse(FeedService.visible(post(THEM, OURS, Audience.ONLY_ME), ME, NEVER, NEVER));
        assertFalse(FeedService.visible(post(THEM, null, Audience.ONLY_ME), ME, NEVER, NEVER));
    }

    @Test
    @DisplayName("내 모임 사람만 — 모임에 올린 글은 그 모임 사람이 본다")
    void matesInGroup() {
        assertTrue(seenByMe(post(THEM, OURS, Audience.MATES)));
    }

    @Test
    @DisplayName("내 모임 사람만 — 내가 안 든 모임의 글은 안 보인다")
    void matesStopsAtTheGroupLine() {
        /*
          THEM 과 나는 OURS 를 함께 씁니다. 그래도 THEM 이 THEIRS 에 올린 글은
          안 보여야 합니다 — 「모임을 함께 쓰는 사이」로 넓히면 A 모임에 올린
          글이 B 모임 사람에게 갑니다. 올린 사람이 고른 자리는 A 였습니다.
        */
        assertFalse(seenByMe(post(THEM, THEIRS, Audience.MATES)));
    }

    @Test
    @DisplayName("내 모임 사람만 — 내 피드에 쓴 글은 모임을 함께 쓰는 사람이 본다")
    void matesWithoutAGroup() {
        assertTrue(seenByMe(post(THEM, null, Audience.MATES)));
        /* 생판 남 — 함께 든 모임이 없습니다. */
        assertFalse(FeedService.visible(post(STRANGER, null, Audience.MATES), ME,
                Set.of(OURS)::contains, Set.of(ME, THEM)::contains));
    }

    @Test
    @DisplayName("모두 — 번호를 아는 사람이면 본다. 묻지 않는다")
    void everyone() {
        assertTrue(FeedService.visible(post(STRANGER, null, Audience.EVERYONE), ME, NEVER, NEVER));
        /* 모임 울타리를 그대로 두면 모임 글에서 「모두」가 「내 모임 사람만」과
           똑같아져, 골라도 아무 일이 안 일어나는 값이 됩니다. */
        assertTrue(FeedService.visible(post(THEM, THEIRS, Audience.EVERYONE), ME, NEVER, NEVER));
    }

    @Test
    @DisplayName("감춘 글은 글쓴이에게도 안 보인다")
    void hiddenBeatsEverything() {
        /* 신고를 받아 운영자가 내린 글입니다. 글쓴이에게 그대로 보이면 왜
           남에게만 안 보이는지를 알 수 없고, 고쳐서 되살릴 길이 생깁니다. */
        Post dropped = post(ME, OURS, Audience.EVERYONE);
        dropped.setHidden(true);
        assertFalse(FeedService.visible(dropped, ME, NEVER, NEVER));
        assertFalse(FeedService.visible(dropped, THEM, NEVER, NEVER));
    }

    @Test
    @DisplayName("로그인 안 한 사람은 아무것도 못 본다")
    void noViewerSeesNothing() {
        assertFalse(FeedService.visible(post(THEM, null, Audience.EVERYONE), null, NEVER, NEVER));
    }

    /**
     * 안 고르면 올린 자리가 정합니다.
     *
     * <p><b>V52 의 되메움과 같은 규칙입니다.</b> 이주 파일은 이미 올라간 글에
     * {@code group_id IS NOT NULL → 'MATES'}, 나머지는 기본값
     * {@code 'ONLY_ME'} 를 채웁니다. 그 규칙이 {@code Post.audienceFor} 와
     * 어긋나면 옛 글과 새 글이 다르게 보입니다 — 한쪽만 고치는 날이 오는
     * 자리라 양쪽을 여기서 묶어 둡니다.
     */
    @Test
    @DisplayName("안 고른 글은 공개 범위가 없던 때처럼 보인다 — V52 되메움과 같은 규칙")
    void defaultKeepsYesterdaysBehaviour() {
        Post inGroup = Post.builder().authorId(THEM).groupId(OURS).build();
        assertEquals(Audience.MATES, inGroup.getAudience());
        /* 모임에 올린 글은 그 모임 사람이 보고 있었습니다. 되메움이 빠지면
           모임 피드가 통째로 빈 화면이 됩니다. */
        assertTrue(seenByMe(inGroup));

        Post onMyFeed = Post.builder().authorId(THEM).build();
        assertEquals(Audience.ONLY_ME, onMyFeed.getAudience());
        /* 모임 없이 올린 글은 글쓴이만 보고 있었습니다. 여기가 MATES 로
           채워지면 혼자 쓰던 글이 모임 사람에게 새어 나갑니다. */
        assertFalse(seenByMe(onMyFeed));
        assertTrue(FeedService.visible(onMyFeed, THEM, NEVER, NEVER));
    }
}
