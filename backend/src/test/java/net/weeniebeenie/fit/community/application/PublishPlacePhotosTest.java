package net.weeniebeenie.fit.community.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.community.domain.PostCommentRepository;
import net.weeniebeenie.fit.community.domain.PostLikeRepository;
import net.weeniebeenie.fit.community.domain.PostReportRepository;
import net.weeniebeenie.fit.community.domain.PostViewRepository;
import net.weeniebeenie.fit.community.domain.TripPost;
import net.weeniebeenie.fit.community.domain.TripPostRepository;
import net.weeniebeenie.fit.community.domain.Visibility;
import net.weeniebeenie.fit.feed.domain.Audience;
import net.weeniebeenie.fit.feed.domain.PostPhoto;
import net.weeniebeenie.fit.photo.domain.PhotoRepository;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.application.VisitService;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlacePhoto;
import net.weeniebeenie.fit.trip.domain.PlacePhotoRepository;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.Trip;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import net.weeniebeenie.fit.trip.domain.TripRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 둘러보기에 내놓을 때 <b>어느 사진이 어느 장소 자리에</b> 실리는가.
 *
 * <h3>왜 이 자리를 시험하나</h3>
 *
 * <p>여행기는 <b>아무나 보는 글</b>입니다. 그래서 여기서 한 줄을 빼먹으면
 * 「모임 안에서 보이는 것」이 「인터넷에 올라간 것」이 됩니다 — 눈으로는 안
 * 갈립니다. 내놓은 사람도 사진을 찍은 사람도, 남이 그 글을 열어 볼 때까지
 * 모릅니다.
 *
 * <p>장소 자리에 사진이 드는 길이 둘이 되었습니다. 챙겨 둔 것
 * ({@code place_photos})과, <b>그 장소에 묶어 올린 피드 글</b>
 * ({@code feed.Post.placeId}). 뒤쪽이 새로 생긴 길이라 여기서 짚습니다.
 *
 * <h3>짚는 것 셋</h3>
 *
 * <pre>
 *   올린 사람 것만        남이 찍은 사진은 번호를 보내도 안 실립니다
 *   고른 날의 장소만      안 올리는 날의 장소에는 안 붙습니다
 *   질의 둘               글마다 묻지 않습니다
 * </pre>
 *
 * <p>질의 수를 세는 까닭은 늘어난 왕복이 <b>화면에 아무 표도 안 내기</b>
 * 때문입니다 — 느려진 뒤에야 압니다. 피드 울타리 쪽과 같은 셈입니다
 * ({@code FeedFenceTest}).
 */
@ExtendWith(MockitoExtension.class)
class PublishPlacePhotosTest {

    private static final String ME = "u-me";
    private static final String MATE = "u-mate";
    private static final String OURS = "g-ours";
    private static final String TRIP = "t-osaka";

    @Mock private TripPostRepository posts;
    @Mock private PostLikeRepository likes;
    @Mock private PostViewRepository views;
    @Mock private PostReportRepository reports;
    @Mock private PostCommentRepository comments;
    @Mock private TripRepository trips;
    @Mock private DayRepository days;
    @Mock private PlaceRepository places;
    @Mock private TripAccessPolicy access;
    @Mock private UserRepository users;
    @Mock private VisitService visits;
    @Mock private PhotoRepository photos;
    @Mock private PlacePhotoRepository placePhotos;
    @Mock private net.weeniebeenie.fit.feed.domain.PostRepository stories;
    @Mock private net.weeniebeenie.fit.feed.domain.PostPhotoRepository storyPhotos;
    @Mock private AuditService audit;
    /* 사본을 진짜로 짓습니다. 흉내로 두면 createObjectNode 가 null 을 내고
       사본이 없는 글이 떠서, 무엇이 실렸는지 볼 데가 없어집니다. */
    @Spy private ObjectMapper mapper = new ObjectMapper();

    @InjectMocks private PostService service;

    private static final AuthPrincipal I_AM =
            new AuthPrincipal(ME, "me@local.test", "나", Role.MEMBER);

    /* ------------------------------------------------------------ 밑감 */

    /**
     * 이틀짜리 오사카. 첫날에 두 곳, 둘째 날에 한 곳.
     *
     * <p>흉내를 깔기({@link #publishable}) <b>전에</b> 세워 둡니다. 시험 본문이 이
     * 장소들의 번호로 피드 글을 짓는데, 흉내 안에서 세우면 그때는 아직
     * 비어 있습니다.
     */
    private Day d1;
    private Day d2;
    private Place ichiran;
    private Place dotonbori;
    private Place nextDay;

    @BeforeEach
    void standUpTheItinerary() {
        d1 = day("d-1", 0, LocalDate.of(2026, 10, 1));
        d2 = day("d-2", 1, LocalDate.of(2026, 10, 2));
        ichiran = place("p-ichiran", d1.getId(), 0, "이치란");
        dotonbori = place("p-dotonbori", d1.getId(), 1, "도톤보리");
        nextDay = place("p-nextday", d2.getId(), 2, "유니버설");
    }

    private Trip theTrip() {
        Trip t = Trip.builder().ownerId(ME).title("오사카").groupId(OURS).build();
        t.setId(TRIP);
        return t;
    }

    private static Day day(String id, int sort, LocalDate iso) {
        Day d = Day.builder().tripId(TRIP).sort(sort).label(sort + 1 + "일차").iso(iso).build();
        d.setId(id);
        return d;
    }

    private static Place place(String id, String dayId, int sort, String name) {
        Place p = Place.builder().dayId(dayId).sort(sort).name(name).lat(34.6).lng(135.5).build();
        p.setId(id);
        return p;
    }

    private static net.weeniebeenie.fit.feed.domain.Post story(String authorId, String placeId) {
        return net.weeniebeenie.fit.feed.domain.Post.builder()
                .authorId(authorId)
                .tripId(TRIP)
                .placeId(placeId)
                .text("여기")
                .audience(Audience.MATES)
                .build();
    }

    /**
     * 내놓을 수 있는 여행 하나.
     *
     * <p>사진이 어디 붙어 있는지는 여기 안 둡니다({@link #pinned}). 아무것도
     * 안 고르고 내놓는 시험은 사진을 <b>한 번도 묻지 않아야</b> 하는데, 흉내를
     * 여기 함께 두면 쓰이지 않는 흉내가 되어 엄격 모드에서 터집니다 — 그
     * 「안 묻는다」가 곧 그 시험이 보려는 것입니다.
     */
    private void publishable() {
        when(access.requireOwner(TRIP, ME)).thenReturn(theTrip());
        when(posts.findAllByAuthorIdOrderByCreatedAtDesc(eq(ME), any())).thenReturn(Page.empty());
        when(days.findAllByTripIdOrderBySortAsc(TRIP)).thenReturn(List.of(d1, d2));
        when(places.findAllOfTrip(TRIP)).thenReturn(List.of(ichiran, dotonbori, nextDay));
        when(posts.save(any(TripPost.class))).thenAnswer(call -> call.getArgument(0));
    }

    /**
     * 사진이 어디 붙어 있는지.
     *
     * @param told  이 여행에 붙어 있는 피드 글들
     * @param shots 그 글들에 붙어 있는 사진
     * @param kept  장소에 챙겨 둔 사진
     */
    private void pinned(List<net.weeniebeenie.fit.feed.domain.Post> told,
                        List<PostPhoto> shots,
                        List<PlacePhoto> kept) {
        when(stories.findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(TRIP)).thenReturn(told);
        when(storyPhotos.findAllByPostIdInOrderBySortAsc(any())).thenReturn(shots);
        when(placePhotos.findAllByPlaceIdInOrderByPlaceIdAscSortAsc(any())).thenReturn(kept);
    }

    /**
     * 첫날만 내놓습니다.
     *
     * <p>둘째 날을 빼는 까닭은 「고른 날의 장소만」을 함께 짚기 위해서입니다 —
     * 안 올리는 날의 장소에 묶인 글이 실려서는 안 됩니다.
     */
    private JsonNode publishDayOne(List<String> want) {
        TripPost made = service.publish(I_AM, TRIP, "오사카 이틀", null, null, null,
                List.of("d-1"), false, null, Visibility.LISTED, null, want);
        try {
            return mapper.readTree(made.getSnapshot());
        } catch (Exception e) {
            throw new IllegalStateException("사본이 깨졌습니다.", e);
        }
    }

    /** 사본에서 그 장소 자리에 실린 사진들. */
    private static List<String> shotsAt(JsonNode snap, String placeName) {
        for (JsonNode day : snap.path("days")) {
            for (JsonNode place : day.path("places")) {
                if (placeName.equals(place.path("name").asText())) {
                    List<String> out = new ArrayList<>();
                    place.path("photos").forEach(n -> out.add(n.asText()));
                    return out;
                }
            }
        }
        throw new IllegalStateException(placeName + " 이(가) 사본에 없습니다.");
    }

    /* -------------------------------------------------------- 남의 사진 */

    @Test
    @DisplayName("같이 간 사람이 그 장소에 올린 사진은 내 여행기에 안 실린다")
    void aMatesPhotoNeverRidesInMyPublicPost() {
        net.weeniebeenie.fit.feed.domain.Post theirs = story(MATE, ichiran.getId());
        publishable();
        /*
          그 글의 사진은 흉내 내지 않습니다. 남의 글은 글쓴이를 보는 자리에서
          떨어져 나가므로 <b>사진을 묻는 데까지 가지 않아야</b> 합니다 — 아래에서
          그것도 함께 짚습니다.
        */
        when(stories.findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(TRIP))
                .thenReturn(List.of(theirs));
        when(placePhotos.findAllByPlaceIdInOrderByPlaceIdAscSortAsc(any())).thenReturn(List.of());

        /* 번호를 <b>일부러</b> 함께 보냅니다 — 화면이 미리 골라 둔 것처럼. */
        JsonNode snap = publishDayOne(List.of("f-theirs"));

        /*
          여행기는 아무나 보는 글입니다. 모임 안에서 보이는 사진을 공개로
          돌리는 결정은 <b>찍은 사람</b>이 합니다 — 내놓는 사람이 네모 하나를
          누르는 일이 아닙니다. storiesOf 와 같은 규칙입니다.
        */
        assertEquals(List.of(), shotsAt(snap, "이치란"));
        assertFalse(snap.toString().contains("f-theirs"), "남의 사진 번호가 사본에 남았습니다");
        /* 거르는 자리가 글쓴이를 보는 쪽이어야 합니다. 사진을 다 받아 와서
           나중에 거르면, 거르는 줄 하나가 빠질 때 조용히 전부 실립니다. */
        verify(storyPhotos, never()).findAllByPostIdInOrderBySortAsc(any());
    }

    /* ---------------------------------------------------- 내 사진이 드는 길 */

    @Test
    @DisplayName("그 장소에 올린 내 사진이 그 장소 자리에 실린다 — 챙겨 둔 것보다 앞에")
    void myBoundPhotosRideInThatPlacesSlot() {
        net.weeniebeenie.fit.feed.domain.Post first = story(ME, ichiran.getId());
        net.weeniebeenie.fit.feed.domain.Post second = story(ME, ichiran.getId());
        net.weeniebeenie.fit.feed.domain.Post loose = story(ME, null);
        net.weeniebeenie.fit.feed.domain.Post otherDay = story(ME, nextDay.getId());

        publishable();
        pinned(List.of(first, second, loose, otherDay),
                List.of(
                        new PostPhoto(first.getId(), "f-1", 0),
                        new PostPhoto(first.getId(), "f-2", 1),
                        /* 같은 사진이 내 글 둘에 다 실려 있습니다 — 한 칸만
                           서야 합니다(addOnce). */
                        new PostPhoto(second.getId(), "f-1", 0),
                        new PostPhoto(second.getId(), "f-3", 1),
                        new PostPhoto(loose.getId(), "f-loose", 0),
                        new PostPhoto(otherDay.getId(), "f-nextday", 0)),
                List.of(
                        new PlacePhoto(ichiran.getId(), "r-menu", 0, ME),
                        new PlacePhoto(dotonbori.getId(), "r-ticket", 0, ME)));

        JsonNode snap = publishDayOne(
                List.of("f-1", "f-2", "f-3", "f-loose", "f-nextday", "r-menu", "r-ticket"));

        /*
          차례가 뜻입니다. 피드에서 온 것이 먼저고(다녀와서 남긴 것), 챙겨 둔
          것이 뒤입니다(가기 전에 넣어 둔 것). 피드 안에서는 글이 올라온 차례라
          f-1·f-2 가 f-3 보다 앞입니다.
        */
        assertEquals(List.of("f-1", "f-2", "f-3", "r-menu"), shotsAt(snap, "이치란"));
        assertEquals(List.of("r-ticket"), shotsAt(snap, "도톤보리"));

        /* 장소를 안 고른 글은 장소 자리에 설 데가 없습니다 — 숙소에서 찍은
           단체 사진이 그렇습니다. 「글을 같이 싣기」로 가야 합니다. */
        assertFalse(snap.toString().contains("f-loose"), "장소 안 묶인 사진이 장소에 붙었습니다");
        /* 안 올리는 날의 장소에 묶인 글도 안 실립니다. */
        assertFalse(snap.toString().contains("f-nextday"), "안 올린 날의 사진이 실렸습니다");
    }

    @Test
    @DisplayName("아무것도 안 고르면 사진을 묻지도 않는다")
    void nothingPickedAsksNothing() {
        publishable();

        /* 화면이 미리 골라 주더라도 <b>끄는 길</b>은 있어야 합니다 — 끈 것이
           실리면 끌 수가 없습니다. 전부 끄면 고른 것이 하나도 없습니다. */
        JsonNode snap = publishDayOne(List.of());

        assertEquals(List.of(), shotsAt(snap, "이치란"));
        assertEquals(List.of(), shotsAt(snap, "도톤보리"));
        /*
          <b>묻지도 않습니다.</b> 고른 것이 없으면 어디 무엇이 붙어 있는지 알
          필요가 없는데, 세 질의를 먼저 하고 나서 버리면 날마다 장소마다 사진을
          끌고 와서 빈 사본을 짓습니다 — 사진을 아예 안 고르는 사람이 가장
          흔합니다.
        */
        verify(stories, never()).findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(anyString());
        verify(storyPhotos, never()).findAllByPostIdInOrderBySortAsc(any());
        verify(placePhotos, never()).findAllByPlaceIdInOrderByPlaceIdAscSortAsc(any());
    }

    /* ---------------------------------------------------------- 질의 수 */

    @Test
    @DisplayName("글이 넷이어도 피드 쪽 질의는 둘이다")
    void twoQueriesForTheFeedSideNoMatterHowManyPosts() {
        net.weeniebeenie.fit.feed.domain.Post a = story(ME, ichiran.getId());
        net.weeniebeenie.fit.feed.domain.Post b = story(ME, ichiran.getId());
        net.weeniebeenie.fit.feed.domain.Post c = story(ME, dotonbori.getId());
        net.weeniebeenie.fit.feed.domain.Post d = story(ME, dotonbori.getId());
        publishable();
        pinned(List.of(a, b, c, d),
                List.of(new PostPhoto(a.getId(), "f-a", 0), new PostPhoto(b.getId(), "f-b", 0),
                        new PostPhoto(c.getId(), "f-c", 0), new PostPhoto(d.getId(), "f-d", 0)),
                List.of());

        publishDayOne(List.of("f-a", "f-b", "f-c", "f-d"));

        /* 이 여행의 글 한 번. */
        verify(stories, times(1)).findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(TRIP);
        /* 그 글들의 사진 한 번 — 묶어서입니다. */
        verify(storyPhotos, times(1)).findAllByPostIdInOrderBySortAsc(any());
        /*
          <b>글마다 묻지 않습니다.</b> 한 편씩 묻는 길이 바로 옆에 있어서
          (storiesOf 가 그 길을 씁니다) 무심코 그것을 부르면 글 수만큼 왕복이
          생기는데, 사본은 똑같이 맞게 나옵니다 — 느려진 것 말고는 표가 없습니다.
        */
        verify(storyPhotos, never()).findAllByPostIdOrderBySortAsc(anyString());
    }
}
