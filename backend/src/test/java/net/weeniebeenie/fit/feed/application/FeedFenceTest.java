package net.weeniebeenie.fit.feed.application;

import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.community.domain.PostCommentRepository;
import net.weeniebeenie.fit.feed.domain.Audience;
import net.weeniebeenie.fit.feed.domain.Post;
import net.weeniebeenie.fit.feed.domain.PostPhotoRepository;
import net.weeniebeenie.fit.feed.domain.PostRepository;
import net.weeniebeenie.fit.group.application.GroupService;
import net.weeniebeenie.fit.group.domain.GroupMember;
import net.weeniebeenie.fit.group.domain.GroupMemberRepository;
import net.weeniebeenie.fit.group.domain.GroupRole;
import net.weeniebeenie.fit.photo.domain.PhotoRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import net.weeniebeenie.fit.trip.domain.TripRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 울타리를 서비스째로 — <b>무엇으로 거절하나</b>와 <b>몇 번 묻나</b>.
 *
 * <p>셈 자체는 {@link FeedAudienceTest} 가 짚습니다. 여기서 짚는 것은 그
 * 셈을 둘러싼 두 가지입니다.
 *
 * <h3>없다고 답해야 합니다</h3>
 *
 * <p>「볼 수 없어요」(403)는 <b>있다는 말</b>입니다. 번호를 하나씩 넣어 보면
 * 어느 것이 있는 글인지 가려낼 수 있고, 그러면 「나만」으로 닫아 둔 글이 몇
 * 편인지가 새어 나갑니다. 404 여야 합니다 — 여행기 쪽과 같은 약속입니다
 * ({@code PostService.read}).
 *
 * <p>눈으로는 안 갈립니다. 둘 다 화면에 빨간 줄 하나로 보이고, 고치는 사람은
 * 403 이 더 친절하다고 느낍니다.
 *
 * <h3>글마다 묻지 않아야 합니다</h3>
 *
 * <p>울타리는 목록의 글마다 불립니다. 안에서 모임 가입을 그때그때 물으면 글
 * 수만큼 왕복이 생기는데, 늘어난 쿼리는 화면에 아무 표도 안 냅니다 — 느려진
 * 뒤에야 압니다. 여덟 편을 늘어놓고 <b>모임 질의가 몇 번 갔는지</b>를 셉니다.
 */
@ExtendWith(MockitoExtension.class)
class FeedFenceTest {

    private static final String ME = "u-me";
    private static final String THEM = "u-them";
    private static final String OURS = "g-ours";
    private static final String TRIP = "t-osaka";

    @Mock private PostRepository posts;
    @Mock private PostPhotoRepository postPhotos;
    @Mock private PostCommentRepository comments;
    @Mock private PhotoRepository photos;
    @Mock private GroupService groups;
    @Mock private TripRepository trips;
    @Mock private PlaceRepository places;
    @Mock private DayRepository days;
    @Mock private TripAccessPolicy access;
    @Mock private UserRepository users;
    @Mock private AuditService audit;
    @Mock private GroupMemberRepository members;
    /* 막음은 비어 있습니다 — 묻지 않은 목은 빈 집합을 돌려줍니다. 이 시험은
       울타리를 보고, 막음은 http 시험(ugc-safety)이 봅니다. */
    @Mock private net.weeniebeenie.fit.safety.application.BlockService blocks;

    @InjectMocks private FeedService feed;

    private static final AuthPrincipal I_AM =
            new AuthPrincipal(ME, "me@local.test", "나", Role.MEMBER);

    private static Post post(String authorId, String groupId, Audience audience) {
        return Post.builder()
                .authorId(authorId)
                .groupId(groupId)
                .tripId(TRIP)
                .audience(audience)
                .build();
    }

    /** 나와 THEM 은 OURS 를 함께 씁니다. */
    private void weShareAGroup() {
        when(members.findAllByIdUserId(ME))
                .thenReturn(List.of(new GroupMember(OURS, ME, GroupRole.MEMBER)));
    }

    @Test
    @DisplayName("남의 「나만」 글은 403 이 아니라 404 다")
    void onlyMeAnswersNotFound() {
        Post theirs = post(THEM, OURS, Audience.ONLY_ME);
        when(posts.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        ApiException thrown = assertThrows(ApiException.class, () -> feed.mine(theirs.getId(), ME));
        assertEquals(HttpStatus.NOT_FOUND, thrown.getStatus());
        /* 글이 없을 때와 <b>같은 말</b>이어야 합니다. 메시지가 다르면 상태를
           404 로 맞춰 둔 뜻이 없습니다 — 말로 가려낼 수 있습니다. */
        assertEquals("글을 찾을 수 없어요.", thrown.getMessage());
    }

    @Test
    @DisplayName("「내 모임 사람만」 글은 그 모임 사람에게 보이고 남에게는 404 다")
    void matesSeeTheGroupPost() {
        Post theirs = post(THEM, OURS, Audience.MATES);
        when(posts.findById(theirs.getId())).thenReturn(Optional.of(theirs));
        weShareAGroup();

        assertSame(theirs, feed.mine(theirs.getId(), ME));

        /* 모임에 안 든 사람 — 가입을 물어보고 없으니 404 입니다. */
        when(members.findAllByIdUserId("u-stranger")).thenReturn(List.of());
        ApiException thrown = assertThrows(ApiException.class,
                () -> feed.mine(theirs.getId(), "u-stranger"));
        assertEquals(HttpStatus.NOT_FOUND, thrown.getStatus());
    }

    /**
     * 여행 앨범에 여덟 편.
     *
     * <p>울타리를 가장 많이 묻는 자리입니다 — 한 여행에 여러 사람이 글을 붙이고
     * 그 가운데 모임 없이 올린 것도 섞입니다. 글마다 묻던 때라면 모임 질의가
     * 여덟 번 갔습니다.
     */
    @Test
    @DisplayName("여덟 편을 늘어놓아도 모임을 한 번만 묻는다")
    void oneMembershipQueryForTheWholeList() {
        List<Post> found = List.of(
                post(THEM, OURS, Audience.MATES),
                post(THEM, OURS, Audience.MATES),
                post(THEM, OURS, Audience.ONLY_ME),
                post(THEM, null, Audience.MATES),
                post(THEM, null, Audience.ONLY_ME),
                post(THEM, null, Audience.EVERYONE),
                post(ME, null, Audience.ONLY_ME),
                post(ME, OURS, Audience.MATES));
        when(posts.findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(TRIP)).thenReturn(found);
        when(postPhotos.findAllByPostIdInOrderBySortAsc(any())).thenReturn(List.of());
        when(comments.countsOf(any(), any())).thenReturn(List.of());
        when(users.findById(anyString())).thenReturn(Optional.empty());
        when(trips.findById(TRIP)).thenReturn(Optional.empty());
        weShareAGroup();
        /* 모임 없이 올린 남의 「내 모임 사람만」 글 하나 때문에 「모임을 함께
           쓰는 사람」도 한 번 셉니다 — 내가 든 모임마다 한 번입니다. */
        when(members.findAllByIdGroupId(OURS)).thenReturn(List.of(
                new GroupMember(OURS, ME, GroupRole.MEMBER),
                new GroupMember(OURS, THEM, GroupRole.MEMBER)));

        List<FeedService.Card> cards = feed.ofTrip(I_AM, TRIP);

        /* 여덟 편 가운데 남의 「나만」 둘이 빠집니다. */
        assertEquals(6, cards.size());
        verify(members, times(1)).findAllByIdUserId(ME);
        verify(members, times(1)).findAllByIdGroupId(OURS);
        /* GroupService 로는 아예 안 갑니다 — 거기로 물으면 글마다 한 번입니다. */
        verify(groups, never()).isMember(anyString(), anyString());
    }

    @Test
    @DisplayName("고른 범위가 카드에 실려 온다 — 고치는 판이 지금 값을 집어야 한다")
    void cardCarriesTheAudience() {
        Post theirs = post(THEM, OURS, Audience.EVERYONE);
        when(posts.findById(theirs.getId())).thenReturn(Optional.of(theirs));
        when(postPhotos.findAllByPostIdInOrderBySortAsc(any())).thenReturn(List.of());
        when(comments.countsOf(any(), any())).thenReturn(List.of());
        when(users.findById(anyString())).thenReturn(Optional.empty());
        when(trips.findById(TRIP)).thenReturn(Optional.empty());

        assertEquals(Audience.EVERYONE, feed.read(I_AM, theirs.getId()).audience());
    }
}
