package net.weeniebeenie.fit.feed.application;

import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.community.domain.PostCommentRepository;
import net.weeniebeenie.fit.feed.domain.Audience;
import net.weeniebeenie.fit.feed.domain.Post;
import net.weeniebeenie.fit.feed.domain.PostPhoto;
import net.weeniebeenie.fit.feed.domain.PostPhotoRepository;
import net.weeniebeenie.fit.feed.domain.PostRepository;
import net.weeniebeenie.fit.group.application.GroupService;
import net.weeniebeenie.fit.group.domain.GroupMember;
import net.weeniebeenie.fit.group.domain.GroupMemberRepository;
import net.weeniebeenie.fit.group.domain.GroupRole;
import net.weeniebeenie.fit.photo.domain.PhotoRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.Trip;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 글을 <b>장소</b>에 묶는 자리.
 *
 * <p>여기서 짚는 것은 셋입니다.
 *
 * <h3>어긋난 글이 저장될 수 없어야 합니다</h3>
 *
 * <p>장소와 여행을 따로 받아 따로 보면, 오사카 여행에 묶인 글이 도쿄 일정의
 * 장소를 가리킬 수 있습니다. 그런 글은 둘러보기 사본에서 갈 자리가 없고 고쳐 줄
 * 자리도 없습니다. 그래서 저장되는 여행 번호는 <b>장소에서만</b> 나옵니다
 * ({@code FeedService.placeOf}) — 보낸 번호는 맞는지 보는 데만 씁니다.
 *
 * <h3>못 쓸 장소는 한 가지 말로 거절해야 합니다</h3>
 *
 * <p>「그런 장소가 없다」와 「볼 수 없는 여행의 장소다」를 갈라 답하면, 번호를
 * 바꿔 가며 어느 장소가 있는지 가려낼 수 있습니다. 그러면 남의 일정이 몇
 * 곳짜리인지가 새어 나갑니다 — 울타리를 403 대신 404 로 두는 것과 같은
 * 까닭입니다({@link FeedFenceTest}).
 *
 * <h3>장소가 사라져도 글은 남아야 합니다</h3>
 *
 * <p>일정에서 장소 한 줄을 빼는 일이 <b>남의 글을 지우는 일</b>이면 안 됩니다.
 * DB 가 묶임만 끊고(ON DELETE SET NULL) 글자와 사진은 그대로 둡니다 — 여기서는
 * 그렇게 끊긴 글과, 아직 번호가 남았는데 장소가 없는 글이 화면 꼴로 멀쩡히
 * 나오는지를 봅니다.
 */
@ExtendWith(MockitoExtension.class)
class FeedPlaceTest {

    private static final String ME = "u-me";
    private static final String OURS = "g-ours";
    private static final String OSAKA = "t-osaka";
    private static final String TOKYO = "t-tokyo";

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

    @InjectMocks private FeedService feed;

    private static final AuthPrincipal I_AM =
            new AuthPrincipal(ME, "me@local.test", "나", Role.MEMBER);

    /* ------------------------------------------------------------ 밑감 */

    private static Trip trip(String id, String groupId) {
        Trip t = Trip.builder().ownerId(ME).title(id).build();
        /* 번호는 빌더가 난수로 짓습니다. 질의를 흉내 내려면 아는 번호여야
           해서 여기서 못 박습니다. */
        t.setId(id);
        t.setGroupId(groupId);
        return t;
    }

    private static Day day(String tripId) {
        return Day.builder().tripId(tripId).sort(0).label("1일차").build();
    }

    private static Place place(String dayId, String name) {
        return Place.builder().dayId(dayId).sort(0).name(name).lat(34.6).lng(135.5).build();
    }

    /**
     * 그 장소까지 거슬러 올라갈 수 있게 둡니다 — 장소·날이 있고 여행이 보입니다.
     *
     * <p>여행을 <b>집어 오는</b> 흉내({@link #andIsMine})는 여기 안 둡니다. 여행
     * 번호가 어긋나 거절되는 자리에서는 거기까지 가지 않아서, 함께 두면 쓰이지
     * 않는 흉내가 되어 시험이 터집니다 — 그 자리까지 가는지가 곧 「저장 전에
     * 거절했나」입니다.
     *
     * @return 고를 장소
     */
    private Place reachable(String tripId, String name) {
        Day on = day(tripId);
        Place at = place(on.getId(), name);
        when(places.findById(at.getId())).thenReturn(Optional.of(at));
        when(days.findById(on.getId())).thenReturn(Optional.of(on));
        when(access.canRead(tripId, ME)).thenReturn(true);
        return at;
    }

    /** 그 여행을 손댈 수 있는 사람으로 둡니다. 여행 번호까지 가는 자리에서만. */
    private void andIsMine(String tripId, String groupId) {
        when(access.mine(tripId, ME)).thenReturn(trip(tripId, groupId));
    }

    /** 저장되는 글을 그대로 돌려줍니다 — 저장한 값을 봐야 하는 시험에서만 씁니다. */
    private void savesWhatItIsGiven() {
        when(posts.save(any(Post.class))).thenAnswer(call -> call.getArgument(0));
    }

    /* -------------------------------------------------- 어긋난 글은 안 됩니다 */

    @Test
    @DisplayName("다른 여행의 장소를 보내면 거절한다")
    void placeFromAnotherTripIsRefused() {
        /* 도쿄 일정의 장소를 들고 「오사카 여행 이야기」라고 보냅니다. */
        Place tokyoSpot = reachable(TOKYO, "시부야");

        ApiException thrown = assertThrows(ApiException.class,
                () -> feed.write(I_AM, null, OSAKA, tokyoSpot.getId(), "여기 좋았다",
                        null, null, null));

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
        assertEquals("이 여행의 장소가 아니에요.", thrown.getMessage());
        /* 거절은 <b>저장 전</b>이어야 합니다. 저장한 뒤에 터지면 어긋난 글이
           이미 남습니다. */
        verify(posts, never()).save(any());
    }

    @Test
    @DisplayName("볼 수 없는 여행의 장소는 「그런 장소가 없어요」다")
    void placeInATripIAmNotInLooksMissing() {
        Day theirs = day(TOKYO);
        Place spot = place(theirs.getId(), "남의 일정 둘째 곳");
        when(places.findById(spot.getId())).thenReturn(Optional.of(spot));
        when(days.findById(theirs.getId())).thenReturn(Optional.of(theirs));
        when(access.canRead(TOKYO, ME)).thenReturn(false);

        ApiException thrown = assertThrows(ApiException.class,
                () -> feed.write(I_AM, null, null, spot.getId(), "남의 일정", null, null, null));

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
        /*
          <b>없는 번호와 같은 말</b>이어야 합니다(아래 시험과 한 글자도 안
          달라야 합니다). 「볼 수 없어요」로 답하면 번호를 바꿔 가며 어느 장소가
          있는지 가려낼 수 있고, 그러면 남의 일정이 몇 곳짜리인지가 새어
          나갑니다.
        */
        assertEquals("그런 장소가 없어요.", thrown.getMessage());
        verify(posts, never()).save(any());
    }

    @Test
    @DisplayName("없는 장소 번호도 같은 말로 거절한다")
    void missingPlaceSaysTheSameThing() {
        when(places.findById("p-ghost")).thenReturn(Optional.empty());

        ApiException thrown = assertThrows(ApiException.class,
                () -> feed.write(I_AM, null, null, "p-ghost", "어디였지", null, null, null));

        assertEquals("그런 장소가 없어요.", thrown.getMessage());
        /* 없는 번호에는 날도 여행도 묻지 않습니다 — 묻는 순서가 거꾸로면
           엉뚱한 말로 거절합니다. */
        verify(days, never()).findById(anyString());
        verify(access, never()).canRead(anyString(), anyString());
    }

    @Test
    @DisplayName("모임 글에 그 모임 여행이 아닌 장소는 거절한다")
    void groupPostTakesOnlyThatGroupsPlace() {
        when(groups.requireMember(OURS, ME))
                .thenReturn(new GroupMember(OURS, ME, GroupRole.MEMBER));
        /* 혼자 여행(groupId 가 비어 있음)의 장소입니다. */
        Place alone = reachable(OSAKA, "혼자 간 카페");
        andIsMine(OSAKA, null);

        ApiException thrown = assertThrows(ApiException.class,
                () -> feed.write(I_AM, OURS, null, alone.getId(), "여기", null, null, null));

        assertEquals("이 모임의 여행이 아니에요.", thrown.getMessage());
        verify(posts, never()).save(any());
    }

    /* ---------------------------------------------- 여행은 장소에서 나옵니다 */

    @Test
    @DisplayName("장소만 보내면 여행 번호는 그 장소에서 나온다")
    void tripComesFromThePlace() {
        Place spot = reachable(OSAKA, "이치란");
        andIsMine(OSAKA, null);
        savesWhatItIsGiven();

        /* 화면이 여행을 안 보냈습니다. 그래도 글은 오사카에 묶여야 합니다 —
           장소가 이미 그 말을 하고 있습니다. */
        Post made = feed.write(I_AM, null, null, spot.getId(), "라멘", null, null, null);

        assertEquals(spot.getId(), made.getPlaceId());
        assertEquals(OSAKA, made.getTripId());
    }

    @Test
    @DisplayName("장소를 안 고르면 보낸 여행이 그대로 쓰인다")
    void withoutAPlaceTheTripIsTakenAsSent() {
        when(access.mine(OSAKA, ME)).thenReturn(trip(OSAKA, null));
        savesWhatItIsGiven();

        /* 숙소에서 찍은 단체 사진처럼 장소에 설 자리가 없는 글입니다. */
        Post made = feed.write(I_AM, null, OSAKA, null, "다들 모였다", null, null, null);

        assertNull(made.getPlaceId());
        assertEquals(OSAKA, made.getTripId());
        /* 장소를 안 골랐으면 장소를 묻지도 않습니다. */
        verify(places, never()).findById(anyString());
    }

    /* ------------------------------------------------------------ 고치기 */

    @Test
    @DisplayName("여행만 갈아 끼우면 전에 묶어 둔 장소가 끊긴다")
    void movingTheTripUnbindsThePlace() {
        Post post = Post.builder().authorId(ME).tripId(OSAKA).placeId("p-ichiran")
                .text("라멘").audience(Audience.MATES).build();
        when(posts.findById(post.getId())).thenReturn(Optional.of(post));
        when(access.mine(TOKYO, ME)).thenReturn(trip(TOKYO, null));

        feed.edit(I_AM, post.getId(), null, null, null, TOKYO, null, null);

        assertEquals(TOKYO, post.getTripId());
        /*
          남겨 두면 글이 <b>제가 간 적 없는 일정</b>의 자리를 가리킵니다 —
          도쿄 여행기를 내놓을 때 오사카 일정의 줄을 찾으러 가게 됩니다.
        */
        assertNull(post.getPlaceId());
    }

    @Test
    @DisplayName("장소를 빈 글자로 보내면 묶임만 끊기고 여행은 남는다")
    void blankPlaceKeepsTheTrip() {
        Post post = Post.builder().authorId(ME).tripId(OSAKA).placeId("p-ichiran")
                .text("라멘").audience(Audience.MATES).build();
        when(posts.findById(post.getId())).thenReturn(Optional.of(post));

        feed.edit(I_AM, post.getId(), null, null, null, null, "", null);

        assertNull(post.getPlaceId());
        /* 장소 하나를 지우는 것이 여행까지 떼는 일이 되면 안 됩니다. */
        assertEquals(OSAKA, post.getTripId());
    }

    @Test
    @DisplayName("고칠 때도 다른 여행의 장소는 거절한다")
    void editRefusesAPlaceFromAnotherTrip() {
        Post post = Post.builder().authorId(ME).tripId(OSAKA).text("라멘")
                .audience(Audience.MATES).build();
        when(posts.findById(post.getId())).thenReturn(Optional.of(post));
        Place tokyoSpot = reachable(TOKYO, "시부야");

        ApiException thrown = assertThrows(ApiException.class,
                () -> feed.edit(I_AM, post.getId(), null, null, null, OSAKA,
                        tokyoSpot.getId(), null));

        assertEquals("이 여행의 장소가 아니에요.", thrown.getMessage());
        /* 던지기 전에 반쯤 고쳐 놓으면 안 됩니다. */
        assertNull(post.getPlaceId());
        assertEquals(OSAKA, post.getTripId());
    }

    /* ------------------------------------------------ 장소가 사라진 뒤 */

    @Test
    @DisplayName("장소가 지워져도 글자와 사진은 그대로 남는다")
    void aDeletedPlaceLeavesTheWordsAndThePhotos() {
        /*
          DB 가 묶임을 끊은 뒤의 모습입니다(ON DELETE SET NULL) — 장소 번호만
          비었습니다. CASCADE 였다면 이 글 자체가 없습니다.
        */
        Post orphan = Post.builder().authorId(ME).tripId(OSAKA)
                .text("여기 라멘 진짜였다").audience(Audience.MATES).build();
        when(posts.findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(OSAKA))
                .thenReturn(List.of(orphan));
        when(postPhotos.findAllByPostIdInOrderBySortAsc(List.of(orphan.getId())))
                .thenReturn(List.of(new PostPhoto(orphan.getId(), "ph-1", 0),
                        new PostPhoto(orphan.getId(), "ph-2", 1)));

        FeedService.Card card = feed.ofTrip(I_AM, OSAKA).get(0);

        assertNull(card.placeId());
        assertNull(card.placeName());
        assertEquals("여기 라멘 진짜였다", card.text());
        assertEquals(List.of("ph-1", "ph-2"), card.photoIds());
        /* 묶인 장소가 하나도 없는 목록에서는 장소를 아예 안 묻습니다. */
        verify(places, never()).findAllById(any());
    }

    @Test
    @DisplayName("번호가 남았는데 장소가 없으면 이름만 빈다")
    void aVanishedPlaceOnlyLosesItsName() {
        Post post = Post.builder().authorId(ME).tripId(OSAKA).placeId("p-gone")
                .text("라멘").audience(Audience.MATES).build();
        when(posts.findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(OSAKA))
                .thenReturn(List.of(post));
        when(places.findAllById(List.of("p-gone"))).thenReturn(List.of());

        FeedService.Card card = feed.ofTrip(I_AM, OSAKA).get(0);

        /*
          터지지 않아야 합니다. 번호는 외래키가 지켜 주지만, 한 트랜잭션 안에서
          방금 지워진 장소를 읽는 자리가 있을 수 있습니다 — 그때 목록 전체가
          500 이 되면 멀쩡한 글 스무 편이 함께 안 보입니다.
        */
        assertEquals("p-gone", card.placeId());
        assertNull(card.placeName());
        assertEquals("라멘", card.text());
    }

    /* ---------------------------------------------------------- 질의 수 */

    @Test
    @DisplayName("장소 이름은 글마다 묻지 않고 한 번에 받는다")
    void placeNamesCostOneQueryForTheWholeList() {
        Post one = Post.builder().authorId(ME).tripId(OSAKA).placeId("p-a")
                .text("하나").audience(Audience.MATES).build();
        Post two = Post.builder().authorId(ME).tripId(OSAKA).placeId("p-b")
                .text("둘").audience(Audience.MATES).build();
        Post three = Post.builder().authorId(ME).tripId(OSAKA).placeId("p-a")
                .text("셋").audience(Audience.MATES).build();
        when(posts.findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(OSAKA))
                .thenReturn(List.of(one, two, three));

        Day on = day(OSAKA);
        Place a = place(on.getId(), "이치란");
        Place b = place(on.getId(), "도톤보리");
        a.setId("p-a");
        b.setId("p-b");
        when(places.findAllById(any())).thenReturn(List.of(a, b));

        List<FeedService.Card> cards = feed.ofTrip(I_AM, OSAKA);

        assertEquals("이치란", cards.get(0).placeName());
        assertEquals("도톤보리", cards.get(1).placeName());
        /* 같은 장소를 두 번 묻지 않습니다 — 셋째 글도 첫째와 같은 자리입니다. */
        assertEquals("이치란", cards.get(2).placeName());
        /*
          <b>한 번</b>입니다. 글마다 묻게 두면 스무 편짜리 목록에 왕복 스물이
          더 붙는데, 늘어난 쿼리는 화면에 아무 표도 안 냅니다 — 느려진 뒤에야
          압니다({@link FeedFenceTest} 와 같은 셈입니다).
        */
        verify(places, times(1)).findAllById(any());
    }
}
