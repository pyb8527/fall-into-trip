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
import net.weeniebeenie.fit.group.domain.GroupMemberRepository;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 달력 칸에 적는 수 — <b>어느 날로 묶나</b>와 <b>몇 번 묻나</b>.
 *
 * <h3>날짜가 조용히 하루 밀립니다</h3>
 *
 * <p>{@code createdAt} 은 {@link Instant} 고 달력 칸은 그 지역 날짜입니다.
 * 한국에서 10월 1일 오전 8시에 올린 글은 UTC 로 <b>9월 30일 23시</b>입니다 —
 * UTC 자정으로 범위를 자르면 10월을 물었을 때 그 글이 안 걸리고, 9월을 물으면
 * 9월 30일 칸에 들어갑니다.
 *
 * <p>이 틀림은 화면에 오류로 안 나타납니다. 숫자가 하나 적거나 옆 칸에
 * 적혀 있을 뿐이고, 그것이 틀린 줄은 제가 그날 올린 것을 기억하는 사람만
 * 압니다. 그래서 경계를 숫자로 못 박습니다.
 *
 * <h3>한 달에 한 번이어야 합니다</h3>
 *
 * <p>칸마다 묻는 길로 가면 달을 넘길 때마다 질의가 서른 번인데, 늘어난
 * 왕복은 화면에 아무 표도 안 냅니다 — 느려진 뒤에야 압니다. 한 달을 물어
 * 놓고 <b>저장소에 몇 번 갔는지</b>를 셉니다.
 */
@ExtendWith(MockitoExtension.class)
class FeedCalendarTest {

    private static final String ME = "u-me";
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

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

    /* ------------------------------------------------------------- 경계 */

    @Test
    @DisplayName("하루의 끝은 그 지역 자정이다 — UTC 자정으로 자르면 오전 글이 샌다")
    void midnightIsLocal() {
        /* 한국의 10월 1일은 UTC 로 9월 30일 15시에 시작합니다. */
        assertEquals(Instant.parse("2026-09-30T15:00:00Z"),
                FeedService.midnight(LocalDate.of(2026, 10, 1), SEOUL));
        assertEquals(Instant.parse("2026-10-01T00:00:00Z"),
                FeedService.midnight(LocalDate.of(2026, 10, 1), ZoneId.of("UTC")));

        /* 한국에서 10월 1일 오전 8시에 올린 글. */
        Instant morning = LocalDate.of(2026, 10, 1).atTime(8, 0).atZone(SEOUL).toInstant();
        assertEquals(Instant.parse("2026-09-30T23:00:00Z"), morning);

        Instant localFrom = FeedService.midnight(LocalDate.of(2026, 10, 1), SEOUL);
        Instant localUntil = FeedService.midnight(LocalDate.of(2026, 11, 1), SEOUL);
        assertTrue(!morning.isBefore(localFrom) && morning.isBefore(localUntil),
                "그 지역 자정으로 자르면 10월에 듭니다");

        /* 같은 글을 UTC 자정으로 자른 10월 범위에 넣어 보면 빠집니다 — 칸은
           비어 있고, 9월을 열어도 30일에 가 있습니다. */
        Instant utcFrom = FeedService.midnight(LocalDate.of(2026, 10, 1), ZoneId.of("UTC"));
        assertTrue(morning.isBefore(utcFrom), "UTC 로 자르면 10월에서 빠집니다");
    }

    /* -------------------------------------------------------- 한 달에 한 번 */

    @Test
    @DisplayName("한 달을 물으면 질의가 한 번이고, 범위는 그 지역 자정 둘이다")
    void oneQueryForTheWholeMonth() {
        when(posts.countMineByDay(anyString(), any(), any(), anyString())).thenReturn(List.of(
                new Object[] {"2026-10-02", 3L},
                new Object[] {"2026-10-14", 1L}));

        Map<LocalDate, Integer> days =
                feed.daysOfMine(I_AM, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31));

        assertEquals(Map.of(LocalDate.of(2026, 10, 2), 3, LocalDate.of(2026, 10, 14), 1), days);
        /* 0 인 날은 안 옵니다 — 서른한 칸 가운데 둘입니다. */
        assertEquals(2, days.size());

        ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> until = ArgumentCaptor.forClass(Instant.class);
        verify(posts, times(1))
                .countMineByDay(eq(ME), from.capture(), until.capture(),
                        eq(ZoneId.systemDefault().getId()));

        ZoneId zone = ZoneId.systemDefault();
        assertEquals(LocalDate.of(2026, 10, 1).atStartOfDay(zone).toInstant(), from.getValue());
        /* 끝은 11월 1일 자정 <b>앞</b>까지입니다. 10월 31일 자정으로 두면 그
           날 올린 글이 하나도 안 걸립니다 — 달력에서 말일만 늘 빈 칸입니다. */
        assertEquals(LocalDate.of(2026, 11, 1).atStartOfDay(zone).toInstant(), until.getValue());

        /* 칸마다 묻는 길로 돌아가면 여기가 서른한 번이 됩니다. */
        verify(posts, never()).ofAuthorBetween(anyString(), any(), any());
    }

    @Test
    @DisplayName("거꾸로 된 범위와 너무 넓은 범위는 400 이다")
    void badRangesAreRefused() {
        ApiException back = assertThrows(ApiException.class, () ->
                feed.daysOfMine(I_AM, LocalDate.of(2026, 10, 31), LocalDate.of(2026, 10, 1)));
        assertEquals(HttpStatus.BAD_REQUEST, back.getStatus());

        ApiException wide = assertThrows(ApiException.class, () ->
                feed.daysOfMine(I_AM, LocalDate.of(2026, 1, 1), LocalDate.of(2030, 1, 1)));
        assertEquals(HttpStatus.BAD_REQUEST, wide.getStatus());

        verify(posts, never()).countMineByDay(anyString(), any(), any(), anyString());
    }

    @Test
    @DisplayName("하루만 물어도 된다 — 첫 날과 끝 날이 같으면 그 하루다")
    void oneDayRange() {
        when(posts.countMineByDay(anyString(), any(), any(), anyString()))
                /* 배열 하나는 {@code List.of} 가 펼쳐 담으므로 갈래를 못 박습니다. */
                .thenReturn(List.<Object[]>of(new Object[] {"2026-10-02", 2L}));

        assertEquals(Map.of(LocalDate.of(2026, 10, 2), 2),
                feed.daysOfMine(I_AM, LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 2)));

        ZoneId zone = ZoneId.systemDefault();
        verify(posts).countMineByDay(ME,
                LocalDate.of(2026, 10, 2).atStartOfDay(zone).toInstant(),
                LocalDate.of(2026, 10, 3).atStartOfDay(zone).toInstant(),
                zone.getId());
    }

    /* ------------------------------------------------------------ 그날 목록 */

    @Test
    @DisplayName("날을 누르면 그 하루만 묻고, 「나만」 글도 내 것은 온다")
    void pickingADayAsksForThatDayOnly() {
        Post onlyMe = Post.builder().authorId(ME).audience(Audience.ONLY_ME).build();
        Post everyone = Post.builder().authorId(ME).audience(Audience.EVERYONE).build();
        when(posts.ofAuthorBetween(anyString(), any(), any()))
                .thenReturn(List.of(onlyMe, everyone));
        when(postPhotos.findAllByPostIdInOrderBySortAsc(any())).thenReturn(List.of());
        when(comments.countsOf(any(), any())).thenReturn(List.of());
        when(users.findById(anyString())).thenReturn(Optional.empty());

        List<FeedService.Card> cards = feed.mineOn(I_AM, LocalDate.of(2026, 10, 2));

        /* 둘 다 옵니다. 글쓴이는 무엇을 골랐든 제 글을 봅니다 — 「나만」인 글이
           빠지면 달력 칸의 수와 아래 목록이 어긋납니다. */
        assertEquals(2, cards.size());
        assertTrue(cards.stream().allMatch(FeedService.Card::mine));

        ZoneId zone = ZoneId.systemDefault();
        verify(posts, times(1)).ofAuthorBetween(ME,
                LocalDate.of(2026, 10, 2).atStartOfDay(zone).toInstant(),
                LocalDate.of(2026, 10, 3).atStartOfDay(zone).toInstant());
        /* 제 글만 보는 길이라 모임을 한 번도 안 묻습니다. */
        verify(members, never()).findAllByIdUserId(anyString());
    }
}
