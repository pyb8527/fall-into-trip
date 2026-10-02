package net.weeniebeenie.fit.feed.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.community.domain.CommentKind;
import net.weeniebeenie.fit.community.domain.PostCommentRepository;
import net.weeniebeenie.fit.feed.domain.Audience;
import net.weeniebeenie.fit.feed.domain.Post;
import net.weeniebeenie.fit.feed.domain.PostPhoto;
import net.weeniebeenie.fit.feed.domain.PostPhotoRepository;
import net.weeniebeenie.fit.feed.domain.PostRepository;
import net.weeniebeenie.fit.group.application.GroupService;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;

/**
 * 사진과 글을 나누는 자리.
 *
 * <h3>장소에서 떼어 냈습니다</h3>
 *
 * <p>장소마다 기록을 남기게 했던 자리가 있었는데 아무도 안 썼습니다. 무엇을
 * 남기려면 <b>장소를 먼저 골라야</b> 해서, 숙소에서 찍은 단체 사진은 올릴
 * 데가 없었습니다 — 여행에서 가장 남기고 싶은 사진이 정작 갈 곳이 없었습니다.
 *
 * <h3>올리는 데 드는 품이 사진 고르기 하나여야 합니다</h3>
 *
 * <p>제목도 지역도 안 받습니다. 그것들은 여행기(TripPost)가 가집니다 — 그쪽은
 * 남에게 내놓는 글이고 이쪽은 아는 사람들끼리 보는 것입니다. <b>사진만 올려도,
 * 글만 써도 됩니다.</b> 둘 다 비면 못 올립니다.
 *
 * <h3>좋아요는 안 둡니다</h3>
 *
 * <p>스무 명짜리 모임에서 좋아요는 셈이 아니라 <b>눈치</b>가 됩니다. 누가
 * 안 눌렀는지가 보입니다. 댓글만 둡니다.
 *
 * <h3>어디서 올린 글인가</h3>
 *
 * <p>여행에 묶는 길은 {@code Post.tripId} 로 있었습니다. 거기에 <b>장소</b>가
 * 붙습니다({@code Post.placeId}) — 닷새에 스무 곳짜리 여행에서 「이 여행
 * 이야기」만으로는 사진이 설 자리를 못 집어 주고, 둘러보기에 내놓을 때 사람이
 * 장소마다 사진을 하나하나 다시 골랐습니다. 이미 그 장소를 보면서 올린
 * 사진인데 말입니다.
 *
 * <p>장소를 받으면 여행은 <b>받지 않고 거슬러 올라갑니다</b>
 * ({@link #placeOf}) — 장소가 날에 달려 있고 날이 여행에 달려 있어서, 둘을
 * 따로 받으면 어긋난 글을 저장할 수 있게 됩니다. 날은 아예 안 들고 있습니다:
 * 장소를 다른 날로 끌어 옮기면 적어 둔 날이 거짓이 되고 고쳐 줄 자리가 없습니다.
 *
 * <h3>볼 수 있는가</h3>
 *
 * <p>글이 들고 있는 {@link Audience} 가 정합니다. 전에는 올린 자리가 정했는데
 * (모임에 올리면 그 모임 사람, 내 피드면 글쓴이만), 그러면 범위를 바꾸는 길이
 * 글을 지우고 다시 쓰는 것뿐이었습니다. 안 고른 글에는 그 옛 규칙이 그대로
 * 기본값으로 들어갑니다({@code Post.audienceFor}).
 *
 * <pre>
 *   글쓴이                  → 늘 봅니다
 *   EVERYONE               → 번호를 아는 사람이면
 *   MATES, 모임에 올린 글   → 그 모임 사람
 *   MATES, 내 피드에 쓴 글  → 나와 모임을 함께 쓰는 사람
 *   ONLY_ME                → 글쓴이만
 * </pre>
 *
 * <p>셈하는 곳은 {@link #visible} 한 곳입니다. 묻는 일(모임에 들었나, 모임을
 * 함께 쓰나)은 {@link Viewer} 가 <b>목록 한 번에 한 번만</b> 합니다.
 *
 * <p>못 보면 <b>404</b> 입니다. 403 으로 답하면 "있긴 있는데 못 본다" 가 되어,
 * id 를 바꿔 가며 어떤 글이 존재하는지 알아낼 수 있습니다. 여행기 쪽과 같은
 * 약속입니다({@code PostService.read}).
 *
 * <h3>달력에 적는 수</h3>
 *
 * <p>{@link #daysOfMine} 과 {@link #mineOn} 은 <b>글쓴이 제 글만</b> 셈하고
 * 내놓습니다. 그래서 둘은 {@link Audience} 를 안 봅니다 — 글쓴이는 무엇을
 * 골랐든 제 글을 보기 때문입니다({@link #visible} 의 첫 줄). <b>남의 글이
 * 섞이는 자리에 그대로 쓰면 「나만」으로 닫아 둔 글이 새어 나갑니다</b>:
 * 그때는 {@link Viewer} 를 거쳐야 합니다.
 *
 * <p>날짜를 어느 시계로 가르는지는 {@link #calendarZone} 한 곳에 있습니다.
 */
@Service
@RequiredArgsConstructor
public class FeedService {

    /**
     * 한 편에 실을 수 있는 사진.
     *
     * <p>열 장이면 하루치입니다. 더 담게 하면 한 편이 앨범이 되고, 피드를
     * 내리는 사람은 그 한 편에서 멈춥니다.
     */
    private static final int MAX_PHOTOS = 10;

    private static final int MAX_TEXT = 2000;
    private static final int MAX_TAGS = 5;
    private static final int MAX_TAG_LENGTH = 20;

    /** 한 사람이 올릴 수 있는 글. 사진 한도(1000장)와 짝이 맞습니다. */
    private static final int MAX_PER_USER = 500;

    /** 한 번에 내려 주는 글 수. */
    private static final int PAGE = 20;

    /**
     * 달력이 한 번에 물을 수 있는 날 수.
     *
     * <p>한 해 조금 넘게 둡니다 — 달력은 한 달씩 묻고, 연 단위로 보여 주는
     * 화면이 생겨도 한 번으로 됩니다.
     *
     * <p>끝을 아예 안 두는 길도 있었습니다. 한 사람의 글이
     * {@link #MAX_PER_USER} 로 묶여 있어 범위를 넓혀도 터지지는 않습니다.
     * 그런데 그러면 <b>그 한도를 올리는 날</b> 여기가 같이 늘어나는데, 올리는
     * 사람은 이 자리를 안 봅니다.
     */
    private static final int MAX_CALENDAR_DAYS = 400;

    private final PostRepository posts;
    private final PostPhotoRepository postPhotos;
    private final PostCommentRepository comments;
    private final PhotoRepository photos;
    private final GroupService groups;
    private final TripRepository trips;
    /* 글이 묶인 장소의 이름을 내주고, 고른 장소가 어느 여행인지 거슬러
       올라갑니다({@link #placeOf}). */
    private final PlaceRepository places;
    private final DayRepository days;
    private final TripAccessPolicy access;
    private final UserRepository users;
    private final AuditService audit;
    /* 남의 피드를 걸러 낼 때 「함께 속한 모임」을 셉니다. */
    private final net.weeniebeenie.fit.group.domain.GroupMemberRepository members;

    /* ---------------------------------------------------------------- 읽기 */

    /**
     * 한 그룹의 피드.
     *
     * <p>멤버가 아니면 404 — 모임이 있다는 사실도 안 알려 줍니다.
     */
    @Transactional(readOnly = true)
    public Slice ofGroup(AuthPrincipal me, String groupId, String tag, int page) {
        groups.requireMember(groupId, me.id());
        return sliceOf(posts.ofGroup(groupId, tagOrAll(tag), me.id(), pageOf(page)),
                new Viewer(me.id()));
    }

    /**
     * 남의 피드 — <b>나와 함께 속한 모임</b>에 올린 글과, 그 사람이 제 피드에
     * 열어 둔 글.
     *
     * <p>그 사람이 다른 모임에 올린 글은 그 모임 사람의 것이라 안 냅니다.
     * 함께 속한 모임이 없으면(프로필이 404 인 사이) 빈 목록입니다 — 거기서
     * 돌아서는 것이 중요합니다. {@code ofAuthorIn} 은 「모임을 함께 쓰는
     * 사이」를 빈 집합이 아닌 것으로 갈음하므로, 빈 집합으로 부르면 그 사람이
     * 제 피드에 「내 모임 사람만」으로 쓴 글이 남에게 갑니다.
     *
     * <p>모임 없이 올린 글도 이제 섞입니다. 전에는 올린 사람만 보는 자리라
     * 통째로 빠졌는데, 지금은 그 글도 {@link Audience} 를 가집니다 — 열어 둔
     * 글을 안 보여 주면 고른 값이 아무 일도 안 합니다.
     */
    @Transactional(readOnly = true)
    public Slice ofAuthor(AuthPrincipal me, String authorId, String tag, int page) {
        if (authorId.equals(me.id())) {
            return mine(me, tag, page);
        }
        Set<String> mineGroups = new HashSet<>();
        members.findAllByIdUserId(me.id()).forEach(m -> mineGroups.add(m.getId().getGroupId()));
        List<String> shared = members.findAllByIdUserId(authorId).stream()
                .map(m -> m.getId().getGroupId())
                .filter(mineGroups::contains)
                .toList();
        if (shared.isEmpty()) {
            return new Slice(List.of(), false);
        }
        /* 내가 든 모임을 방금 다 셌으므로 들고 들어갑니다 — 울타리를 보는
           쪽에서 같은 것을 또 묻지 않습니다. */
        Viewer viewer = new Viewer(me.id(), mineGroups);
        return sliceOf(posts.ofAuthorIn(authorId, shared, tagOrAll(tag), pageOf(page)), viewer);
    }

    /** 내가 올린 것 전부. 그룹에 올린 것도 함께 옵니다. */
    @Transactional(readOnly = true)
    public Slice mine(AuthPrincipal me, String tag, int page) {
        return sliceOf(posts.ofAuthor(me.id(), tagOrAll(tag), pageOf(page)), new Viewer(me.id()));
    }

    /**
     * 그 여행에 붙은 글들.
     *
     * <p>여행을 볼 수 있으면 봅니다. 다만 글은 저마다 제 울타리를 가지므로
     * 볼 수 없는 것은 걸러 냅니다 — 같은 여행을 두고 내 피드에 쓴 글이 모임
     * 사람에게 보이면 안 됩니다.
     */
    @Transactional(readOnly = true)
    public List<Card> ofTrip(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());
        /*
          울타리를 가장 많이 묻는 자리입니다. 한 여행에 여러 사람이 글을 붙이고
          그 가운데 모임 없이 올린 것도 섞이므로, 글마다 묻게 두면 왕복이 글
          수만큼 생깁니다. {@link Viewer} 하나로 묻고 나머지는 셈입니다.
        */
        Viewer viewer = new Viewer(me.id());
        List<Post> found = posts.findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(tripId).stream()
                .filter(viewer::canRead)
                .toList();
        return cardsOf(found, viewer);
    }

    @Transactional(readOnly = true)
    public Card read(AuthPrincipal me, String postId) {
        Viewer viewer = new Viewer(me.id());
        return cardsOf(List.of(mine(postId, viewer)), viewer).get(0);
    }

    /* ---------------------------------------------------------------- 달력 */

    /**
     * 날마다 내가 올린 글이 몇 편인가 — 달력 칸에 적는 수.
     *
     * <h3>한 달에 한 번입니다</h3>
     *
     * <p>칸마다 묻게 두면 달을 넘길 때마다 서른 번입니다 — 아직 아무 날도
     * 누르지 않은 화면에서. 묶어 센 것을 한 번에 받습니다
     * ({@link PostRepository#countMineByDay}).
     *
     * <p>0 인 날은 안 옵니다. 서른 칸을 다 채워 내려 주면 글 두 편 올린 달에
     * 0 이 스물여덟 개 가는데, 화면에서 「없으면 안 적는다」는 어차피 같은
     * 셈입니다.
     *
     * <h3>남의 글이 아닙니다</h3>
     *
     * <p>세는 것은 <b>부른 사람이 올린 글</b>입니다. 그래서 {@link Audience} 를
     * 안 봅니다 — 「나만」으로 닫아 둔 글도 제 달력에는 셉니다. 남의 달력을
     * 그리는 길이 생기면 이것을 그대로 쓸 수 없습니다({@link Viewer} 를 거쳐야
     * 합니다).
     *
     * @param from 첫 날. 이 날이 듭니다
     * @param to   끝 날. <b>이 날도 듭니다</b> — 달력이 1일과 말일을 넘깁니다
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, Integer> daysOfMine(AuthPrincipal me, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw ApiException.badRequest("날짜 범위가 거꾸로예요.");
        }
        long span = ChronoUnit.DAYS.between(from, to) + 1;
        if (span > MAX_CALENDAR_DAYS) {
            throw ApiException.badRequest("한 번에 " + MAX_CALENDAR_DAYS + "일까지 볼 수 있어요.");
        }

        ZoneId zone = calendarZone();
        /* 질의가 날짜 순으로 내주므로 그 차례를 지킵니다. 화면은 날짜로 찾아
           쓰지만, 사람이 눈으로 볼 응답이기도 합니다. */
        Map<LocalDate, Integer> out = new LinkedHashMap<>();
        for (Object[] row : posts.countMineByDay(me.id(),
                midnight(from, zone), midnight(to.plusDays(1), zone), zone.getId())) {
            out.put(LocalDate.parse((String) row[0]), ((Number) row[1]).intValue());
        }
        return out;
    }

    /**
     * 그 하루에 내가 올린 글 — 달력에서 날을 눌렀을 때 아래에 서는 것.
     *
     * <p>목록이 쓰는 꼴({@link Card})을 그대로 돌려줍니다. 달력용 모양을 따로
     * 만들지 않습니다 — 그러면 같은 글이 두 꼴을 갖고, 꼬리표 하나를 고칠
     * 때마다 두 군데를 고치게 됩니다.
     *
     * <p>{@link Viewer} 를 거칩니다. 질의가 이미 제 글만 내주고 감춰진 것을
     * 뺐으니 거를 것이 없는데도 그러는 까닭은, <b>지키는 자리가
     * {@link #visible} 하나</b>여야 하기 때문입니다 — 질의가 하나 늘 때 조건을
     * 빼먹으면 조용히 새어 나갑니다. 제 글은 첫 줄에서 통과하므로 모임을 한
     * 번도 안 묻습니다.
     *
     * <p>세는 쪽({@link #daysOfMine})과 <b>같은 시계로 하루를 가릅니다</b>.
     * 다르면 2 가 적힌 칸을 눌러 글 하나만 나옵니다.
     */
    @Transactional(readOnly = true)
    public List<Card> mineOn(AuthPrincipal me, LocalDate on) {
        ZoneId zone = calendarZone();
        Viewer viewer = new Viewer(me.id());
        List<Post> found = posts
                .ofAuthorBetween(me.id(), midnight(on, zone), midnight(on.plusDays(1), zone))
                .stream()
                .filter(viewer::canRead)
                .toList();
        return cardsOf(found, viewer);
    }

    /**
     * 달력 칸이 보는 시계.
     *
     * <p>{@code createdAt} 은 {@link Instant} 고 달력 칸은 <b>그 지역의
     * 날짜</b>입니다. UTC 로 묶으면 한국에서 오전 8시에 올린 글이 전날 칸에
     * 들어갑니다 — 그 순간이 UTC 로는 전날 23시입니다. 어제 아무것도 안 올린
     * 사람이 어제 칸에 1 을 보고, 방금 올린 글은 오늘 칸에 없습니다.
     *
     * <h3>서버가 보는 시계입니다</h3>
     *
     * <p>저장소의 다른 자리도 같은 기준입니다 — {@code GoogleQuota.endOf} 의
     * 자정, {@code PostService} 가 피드 글을 여행 날짜에 맞추는 자리. 여기만
     * 다르면 같은 글이 달력과 여행기에서 다른 날에 놓입니다.
     *
     * <p>보는 사람의 시계를 받는 길도 있었습니다. 그러려면 화면이 제 시간대를
     * 실어 보내야 하고, 그러면 <b>같은 글의 날짜가 기기마다 달라집니다</b> —
     * 한 사람이 폰과 웹에서 다른 칸을 봅니다. 여행 날짜가 시간대 없는
     * {@code LocalDate} 인 것과도 어긋납니다.
     */
    private static ZoneId calendarZone() {
        return ZoneId.systemDefault();
    }

    /**
     * 그 지역 날짜의 자정.
     *
     * <p>범위의 두 끝을 <b>같은 규칙</b>으로 만들려고 둡니다. 한쪽을 UTC
     * 자정으로 두면 한국에서 1일 오전 8시에 올린 글(UTC 로는 전날 23시)이
     * 10월을 물었을 때 안 걸립니다 — 칸은 비어 있고 글은 어디에도 없습니다.
     */
    static Instant midnight(LocalDate day, ZoneId zone) {
        return day.atStartOfDay(zone).toInstant();
    }

    /* -------------------------------------------------------------- 올리기 */

    /**
     * 올립니다.
     *
     * @param tripId   어느 여행 이야기인지. 안 골라도 됩니다. {@code placeId}
     *                 를 함께 보내면 <b>둘이 맞아야</b> 합니다 — 장소가 이미
     *                 여행을 말하므로 어긋나면 거절합니다({@link #placeOf})
     * @param placeId  그 여행의 어느 장소에서인지. 안 골라도 됩니다 — 숙소에서
     *                 찍은 단체 사진은 장소에 설 자리가 없습니다
     * @param audience 누가 볼지. 안 보내면 올린 자리가 정합니다
     *                 ({@code Post.audienceFor}) — 공개 범위가 없던 때의
     *                 동작이라 안 고른 사람에게 달라지는 것이 없습니다
     */
    @Transactional
    public Post write(AuthPrincipal me, String groupId, String tripId, String placeId,
                      String text, List<String> tags, List<String> photoIds,
                      Audience audience) {
        String inGroup = blankToNull(groupId);
        if (inGroup != null) {
            groups.requireMember(inGroup, me.id());
        }

        String clean = blankToNull(text);
        if (clean != null && clean.length() > MAX_TEXT) {
            throw ApiException.badRequest("글이 너무 길어요. " + MAX_TEXT + "자 아래로 적어 주세요.");
        }
        List<String> pics = minePhotos(me, photoIds);
        if (clean == null && pics.isEmpty()) {
            throw ApiException.badRequest("사진을 고르거나 한 줄 적어 주세요.");
        }
        if (posts.countByAuthorId(me.id()) >= MAX_PER_USER) {
            throw ApiException.badRequest("올릴 수 있는 글 수를 넘었어요. 안 쓰는 것을 지우고 올려 주세요.");
        }

        /* 장소와 여행을 한 번에 봅니다 — 따로 보면 어긋난 글이 저장됩니다. */
        Bound at = placeOf(me, placeId, tripId, inGroup);

        Post post = posts.save(Post.builder()
                .authorId(me.id())
                .groupId(inGroup)
                .tripId(at.tripId())
                .placeId(at.placeId())
                .text(clean)
                .tags(cleanTags(tags))
                .audience(audience)
                .build());
        attach(post.getId(), pics);

        audit.log(me.id(), "feed.write", post.getId(),
                Map.of("group", String.valueOf(inGroup), "photos", pics.size(),
                        "audience", post.getAudience().name(),
                        "place", String.valueOf(at.placeId())));
        return post;
    }

    /**
     * 고칩니다.
     *
     * <p><b>글쓴이만</b> 합니다. 모임 글이라도 그렇습니다 — 남이 쓴 글의
     * 말을 바꿀 수 있으면 그것은 내 글이 아닙니다. 지우는 것은 모임 주인도
     * 할 수 있습니다(치우는 일이라 다릅니다).
     *
     * <p><b>보낸 것만 바뀝니다.</b> {@code null} 인 칸은 손대지 않습니다.
     * 비우는 것은 빈 글입니다 — 가계부·보석함과 같은 약속입니다.
     *
     * <p>공개 범위도 고칩니다. 올린 뒤에 좁히는 일이 넓히는 일보다 잦습니다 —
     * 모임 사람에게 보여 준 사진을 나중에 혼자 간직하려고 글을 지우게 할 이유가
     * 없습니다.
     *
     * <h3>장소와 여행은 함께 봅니다</h3>
     *
     * <p>따로 보면 어긋난 글이 남습니다. 장소를 보내면 그것이 정합니다 — 여행
     * 번호는 장소에서 나옵니다. 거꾸로 <b>여행만 갈아 끼우면 전에 묶어 둔 장소를
     * 끊습니다</b>: 그 장소는 이제 다른 여행의 줄이라, 그대로 두면 글이 제가
     * 간 적 없는 일정의 자리를 가리킵니다.
     *
     * @param placeId {@code ""} 이면 묶임을 끊습니다. {@code null} 이면 그대로 —
     *                가계부·보석함과 같은 약속입니다
     */
    @Transactional
    public Post edit(AuthPrincipal me, String postId, String text,
                     List<String> tags, List<String> photoIds, String tripId,
                     String placeId, Audience audience) {
        Post post = mine(postId, me.id());
        if (!post.getAuthorId().equals(me.id())) {
            throw ApiException.forbidden("내가 쓴 글만 고칠 수 있어요.");
        }

        if (text != null) {
            String clean = blankToNull(text);
            if (clean != null && clean.length() > MAX_TEXT) {
                throw ApiException.badRequest("글이 너무 길어요. " + MAX_TEXT + "자 아래로 적어 주세요.");
            }
            post.setText(clean);
        }
        if (tags != null) {
            post.setTags(cleanTags(tags));
        }
        if (placeId != null) {
            /* 장소를 보냈으면 여행 번호는 거기서 나옵니다. 둘 다 보냈고 어긋나면
               거절합니다 — 어느 쪽을 믿을지 고르는 자리를 두지 않습니다. */
            Bound at = placeOf(me, placeId, tripId, post.getGroupId());
            post.setPlaceId(at.placeId());
            /* 장소를 비웠을 뿐이고 여행도 안 보냈으면 여행은 그대로 둡니다 —
               장소 하나를 지우는 것이 여행까지 떼는 일이 되면 안 됩니다. */
            if (at.placeId() != null || tripId != null) {
                post.setTripId(at.tripId());
            }
        } else if (tripId != null) {
            String moved = tripOf(me, tripId, post.getGroupId());
            if (post.getPlaceId() != null && !Objects.equals(moved, post.getTripId())) {
                post.setPlaceId(null);
            }
            post.setTripId(moved);
        }
        if (audience != null) {
            post.setAudience(audience);
        }
        if (photoIds != null) {
            List<String> pics = minePhotos(me, photoIds);
            /* 갈아 끼우기 전에 봅니다 — 사진을 다 빼는데 글도 비어 있으면
               아무것도 안 남은 글이 됩니다. */
            if (post.getText() == null && pics.isEmpty()) {
                throw ApiException.badRequest("사진을 고르거나 한 줄 적어 주세요.");
            }
            postPhotos.deleteAllByPostId(postId);
            postPhotos.flush();
            attach(postId, pics);
        }

        post.touch();
        audit.log(me.id(), "feed.edit", postId);
        return post;
    }

    /**
     * 지웁니다.
     *
     * <p>글쓴이와 <b>모임 주인</b>이 할 수 있습니다. 주인에게 치울 길이
     * 없으면 모임에 남이 올린 것을 못 내립니다.
     *
     * <p>댓글을 <b>코드가</b> 지웁니다. {@code post_comments.post_id} 에는
     * 외래키가 없어서 DB 가 안 해 줍니다({@link CommentKind}). 사진 파일은
     * 안 지웁니다 — 올린 사람의 것이고, 글에서 떼기만 합니다.
     */
    @Transactional
    public void remove(AuthPrincipal me, String postId) {
        Post post = mine(postId, me.id());
        boolean author = post.getAuthorId().equals(me.id());
        boolean host = post.getGroupId() != null
                && groups.requireMember(post.getGroupId(), me.id()).getRole() == GroupRole.OWNER;
        if (!author && !host && me.role() != Role.ADMIN) {
            throw ApiException.forbidden("내가 쓴 글만 지울 수 있어요.");
        }

        comments.deleteAllByPostId(postId);
        postPhotos.deleteAllByPostId(postId);
        posts.delete(post);
        audit.log(me.id(), author ? "feed.remove" : "feed.remove.host", postId);
    }

    /* ---------------------------------------------------------------- 울타리 */

    /** 볼 수 있는 글인지 보고, 맞으면 돌려줍니다. 아니면 404. */
    public Post mine(String postId, String userId) {
        return mine(postId, new Viewer(userId));
    }

    private Post mine(String postId, Viewer viewer) {
        Post post = posts.findById(postId)
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없어요."));
        if (!viewer.canRead(post)) {
            /*
              없다고 답합니다 — "볼 수 없어요" 는 <b>있다는 말</b>입니다. 번호를
              하나씩 넣어 보면 어느 것이 있는 글인지 가려낼 수 있고, 그러면
              「나만」으로 닫아 둔 글이 몇 편인지가 새어 나갑니다. 여행기 쪽과
              같은 약속입니다({@code PostService.read}).
            */
            throw ApiException.notFound("글을 찾을 수 없어요.");
        }
        return post;
    }

    /**
     * 이 글을 볼 수 있는지 — <b>묻지 않고 셈만 합니다.</b>
     *
     * <h3>왜 묻는 일을 바깥에 두나</h3>
     *
     * <p>이 셈은 목록의 글마다 불립니다. 안에서 저장소를 부르면 스무 편짜리
     * 목록 한 번에 스무 번 왕복합니다 — 사진과 댓글 수를 한 번에 받아 오는
     * {@link #cardsOf} 와 같은 이유로, 울타리도 한 번만 물어야 합니다. 묻는
     * 일은 {@link Viewer} 가 한 번만 해 두고 그 답을 여기 넘깁니다.
     *
     * <p>{@link Set} 둘이 아니라 {@link Predicate} 둘을 받습니다. 그래야 그
     * 답이 <b>필요한 글이 하나라도 있을 때까지</b> 안 묻습니다 — 「나만」인 글만
     * 거르면 되는 목록이 대부분이고, 거기서는 한 번도 안 묻습니다.
     *
     * @param inGroup 보는 사람이 그 모임에 들어 있는지
     * @param isMate  보는 사람이 그 사람과 모임을 함께 쓰는지
     */
    static boolean visible(Post post, String viewerId,
                           Predicate<String> inGroup, Predicate<String> isMate) {
        if (viewerId == null || post.isHidden()) {
            return false;
        }
        /* 글쓴이는 무엇을 골랐든 제 글을 봅니다. 여기서 먼저 빠지므로 아래
           갈래들은 전부 "남이 볼 수 있나" 만 답합니다. */
        if (post.getAuthorId().equals(viewerId)) {
            return true;
        }
        return switch (post.getAudience()) {
            case ONLY_ME -> false;
            case EVERYONE -> true;
            /* 모임에 올린 글은 그 모임, 내 피드에 쓴 글은 모임을 함께 쓰는
               사이. 모임 글을 「함께 쓰는 사이」로 넓히지 않습니다 — A 모임에
               올린 글이 B 모임 사람에게 보입니다. */
            case MATES -> post.getGroupId() == null
                    ? isMate.test(post.getAuthorId())
                    : inGroup.test(post.getGroupId());
        };
    }

    /**
     * 보는 사람 하나 — <b>목록 내내 한 벌</b>입니다.
     *
     * <p>{@link #visible} 이 묻는 두 가지를 들고 있습니다. 둘 다 <b>처음
     * 물을 때</b> 한 번만 세고 그 뒤로는 셈한 것을 돌려줍니다.
     *
     * <pre>
     *   myGroups  내가 든 모임                 질의 1번
     *   myMates   나와 모임을 함께 쓰는 사람들   질의 (내 모임 수)번
     * </pre>
     *
     * <p>둘 다 <b>글 수와 글쓴이 수에 안 달립니다.</b> 사람을 하나씩 물으면
     * 글쓴이가 열이면 열 번이 되므로, 내 모임마다 사람을 한 번 걷어 한 집합으로
     * 둡니다. 모임 수는 사람마다 몇 개입니다.
     *
     * <p>{@code myMates} 는 모임 없이 올린 남의 글이 섞일 때만 셉니다 — 여행
     * 앨범({@link #ofTrip})과 남의 피드 정도입니다. 모임 피드와 내 피드에서는
     * 안 셉니다.
     */
    private final class Viewer {

        private final String id;
        private Set<String> myGroups;
        private Set<String> myMates;

        Viewer(String id) {
            this(id, null);
        }

        /**
         * @param myGroups 보는 사람이 든 모임을 <b>이미 다 센 것</b>이 있으면.
         *                 일부만 넘기면 안 됩니다 — 이것을 전부로 믿습니다
         */
        Viewer(String id, Set<String> myGroups) {
            this.id = id;
            this.myGroups = myGroups;
        }

        boolean canRead(Post post) {
            return visible(post, id, this::inGroup, this::isMate);
        }

        private boolean inGroup(String groupId) {
            return myGroups().contains(groupId);
        }

        private boolean isMate(String userId) {
            if (myMates == null) {
                myMates = new HashSet<>();
                for (String groupId : myGroups()) {
                    members.findAllByIdGroupId(groupId)
                            .forEach(m -> myMates.add(m.getId().getUserId()));
                }
            }
            return myMates.contains(userId);
        }

        private Set<String> myGroups() {
            if (myGroups == null) {
                myGroups = new HashSet<>();
                members.findAllByIdUserId(id)
                        .forEach(m -> myGroups.add(m.getId().getGroupId()));
            }
            return myGroups;
        }
    }

    /* ---------------------------------------------------------------- 속살 */

    /**
     * 글들을 화면이 쓰는 꼴로.
     *
     * <p>사진·댓글 수·글쓴이 이름·여행 이름을 <b>한 번에</b> 받아 짝지읍니다.
     * 글마다 묻게 두면 스무 편짜리 목록 한 번에 여든 번 왕복합니다.
     */
    private List<Card> cardsOf(List<Post> found, Viewer viewer) {
        if (found.isEmpty()) {
            return List.of();
        }
        List<String> ids = found.stream().map(Post::getId).toList();

        Map<String, List<String>> pics = new HashMap<>();
        for (PostPhoto pp : postPhotos.findAllByPostIdInOrderBySortAsc(ids)) {
            pics.computeIfAbsent(pp.getPostId(), k -> new ArrayList<>()).add(pp.getPhotoId());
        }

        Map<String, Long> talk = new HashMap<>();
        for (Object[] row : comments.countsOf(ids, CommentKind.FEED)) {
            talk.put((String) row[0], (Long) row[1]);
        }

        Map<String, User> who = new LinkedHashMap<>();
        found.stream().map(Post::getAuthorId).distinct()
                .forEach(id -> users.findById(id).ifPresent(u -> who.put(id, u)));

        Map<String, String> where = new HashMap<>();
        found.stream().map(Post::getTripId).filter(Objects::nonNull).distinct()
                .forEach(id -> trips.findById(id).ifPresent(t -> where.put(id, t.getTitle())));

        /*
          묶인 장소의 이름.

          <p>한 번에 받습니다 — 글마다 묻게 두면 스무 편짜리 목록에 왕복 스물이
          더 붙습니다. 장소를 고른 글이 하나도 없으면 아예 안 묻습니다: 장소는
          안 골라도 되는 칸이라 비어 있는 목록이 흔합니다.

          <p>지워진 장소는 이름이 안 옵니다({@code ON DELETE SET NULL} 이라
          번호부터 비어 있습니다). 그 글은 「여행만 묶인 글」로 보입니다 —
          글자와 사진은 그대로입니다.
        */
        Map<String, String> spot = new HashMap<>();
        List<String> spotIds = found.stream()
                .map(Post::getPlaceId).filter(Objects::nonNull).distinct().toList();
        if (!spotIds.isEmpty()) {
            places.findAllById(spotIds).forEach(p -> spot.put(p.getId(), p.getName()));
        }

        List<Card> out = new ArrayList<>();
        for (Post p : found) {
            User u = who.get(p.getAuthorId());
            out.add(new Card(
                    p.getId(),
                    p.getAuthorId(),
                    u == null ? "알 수 없음" : u.getName(),
                    u == null ? null : u.getMark(),
                    p.getGroupId(),
                    p.getAudience(),
                    p.getTripId(),
                    p.getTripId() == null ? null : where.get(p.getTripId()),
                    p.getPlaceId(),
                    p.getPlaceId() == null ? null : spot.get(p.getPlaceId()),
                    p.getText(),
                    List.of(p.getTags()),
                    pics.getOrDefault(p.getId(), List.of()),
                    talk.getOrDefault(p.getId(), 0L).intValue(),
                    p.getAuthorId().equals(viewer.id),
                    p.getCreatedAt(),
                    p.getUpdatedAt()));
        }
        return out;
    }

    /**
     * 한 쪽을 화면이 쓰는 꼴로.
     *
     * <p>울타리를 <b>여기서 한 번 더</b> 봅니다. 목록 질의들도 「나만」인 글을
     * 거르지만(쪽 수가 맞아야 하므로), 그 조건이 질의마다 적혀 있어서 질의가
     * 하나 늘 때 빼먹으면 조용히 새어 나갑니다. 지키는 자리는
     * {@link #visible} 하나여야 합니다.
     */
    private Slice sliceOf(Page<Post> page, Viewer viewer) {
        List<Post> seen = page.getContent().stream().filter(viewer::canRead).toList();
        return new Slice(cardsOf(seen, viewer), page.hasNext());
    }

    private static Pageable pageOf(int page) {
        return PageRequest.of(Math.max(0, page), PAGE);
    }

    /** 빈 글은 「안 거름」입니다. 질의를 두 벌로 만들지 않으려고 둡니다. */
    private static String tagOrAll(String tag) {
        String clean = tagOf(tag);
        return clean == null ? "" : clean;
    }

    /**
     * 고른 사진이 내 것인지.
     *
     * <p>안 보면 남의 사진 번호를 글에 박아 넣을 수 있습니다. 번호는 난수라
     * 찍어서 맞히기 어렵지만, 어렵다는 것이 막았다는 뜻은 아닙니다.
     */
    private List<String> minePhotos(AuthPrincipal me, List<String> photoIds) {
        if (photoIds == null || photoIds.isEmpty()) {
            return List.of();
        }
        List<String> clean = photoIds.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
        if (clean.size() > MAX_PHOTOS) {
            throw ApiException.badRequest("사진은 " + MAX_PHOTOS + "장까지 올릴 수 있어요.");
        }
        for (String id : clean) {
            photos.findById(id)
                    .filter(p -> p.getOwnerId().equals(me.id()))
                    .orElseThrow(() -> ApiException.badRequest("그런 사진이 없어요."));
        }
        return clean;
    }

    private void attach(String postId, List<String> photoIds) {
        for (int i = 0; i < photoIds.size(); i++) {
            postPhotos.save(new PostPhoto(postId, photoIds.get(i), i));
        }
    }

    /**
     * 고른 여행이 쓸 수 있는 것인지.
     *
     * <p>볼 수 있는 여행이어야 하고, <b>모임 글이면 그 모임의 여행</b>이어야
     * 합니다. 안 그러면 모임 사람들에게 그들이 못 보는 여행 이름이 글마다
     * 붙어 뜹니다.
     */
    private String tripOf(AuthPrincipal me, String tripId, String groupId) {
        String clean = blankToNull(tripId);
        if (clean == null) {
            return null;
        }
        Trip trip = access.mine(clean, me.id());
        if (groupId != null && !groupId.equals(trip.getGroupId())) {
            throw ApiException.badRequest("이 모임의 여행이 아니에요.");
        }
        return trip.getId();
    }

    /**
     * 고른 장소가 쓸 수 있는 것인지, 그리고 그 장소가 어느 여행인지.
     *
     * <h3>여행을 안 믿고 거슬러 올라갑니다</h3>
     *
     * <p>장소와 여행을 각각 받아 각각 보면, 둘이 <b>어긋난 글</b>을 저장할 수
     * 있습니다 — 오사카 여행에 묶인 글이 도쿄 일정의 장소를 가리키는 식입니다.
     * 그런 글은 둘러보기 사본에서 갈 자리가 없고, 고쳐 줄 자리도 없습니다.
     *
     * <p>장소를 받으면 {@code places.day_id → days.trip_id} 로 여행을 꺼냅니다.
     * 보낸 여행 번호는 <b>맞는지 보는 데만</b> 씁니다. 그래서 둘이 어긋날 수가
     * 없습니다 — 저장되는 값은 한 곳에서만 나옵니다.
     *
     * <h3>못 쓸 장소는 한 가지 말로 거절합니다</h3>
     *
     * <p>없는 번호든, 볼 수 없는 여행의 장소든 {@link #noSuchPlace} 하나입니다.
     * 갈라 답하면 번호를 바꿔 가며 <b>어느 장소가 있는지</b>를 가려낼 수 있고,
     * 그러면 남의 일정이 몇 곳짜리인지가 새어 나갑니다 — 울타리를 404 로
     * 두는 것과 같은 까닭입니다({@link #mine}).
     *
     * <h3>왜 여행을 두 번 묻나</h3>
     *
     * <p>{@link TripAccessPolicy#canRead} 로 한 번 보고, 그 다음에
     * {@link #tripOf} 가 또 봅니다. 한 번으로 줄일 수는 있는데 그러려면 「모임
     * 글이면 그 모임의 여행」 규칙을 여기에 한 벌 더 적어야 하고, 그 규칙이
     * 두 군데 있으면 언젠가 한쪽만 고칩니다. 올릴 때 한 번 더 묻는 값이 그보다
     * 쌉니다 — 목록이 아니라 쓰는 길입니다.
     *
     * @param tripId  화면이 함께 보낸 여행 번호. 장소를 안 골랐으면 이것이 그대로
     *                쓰입니다
     * @param groupId 모임 글이면 그 모임. 그 모임의 여행이어야 합니다
     */
    private Bound placeOf(AuthPrincipal me, String placeId, String tripId, String groupId) {
        String spot = blankToNull(placeId);
        if (spot == null) {
            return new Bound(null, tripOf(me, tripId, groupId));
        }

        Place place = places.findById(spot).orElseThrow(FeedService::noSuchPlace);
        Day day = days.findById(place.getDayId()).orElseThrow(FeedService::noSuchPlace);
        if (!access.canRead(day.getTripId(), me.id())) {
            throw noSuchPlace();
        }

        String sent = blankToNull(tripId);
        if (sent != null && !sent.equals(day.getTripId())) {
            throw ApiException.badRequest("이 여행의 장소가 아니에요.");
        }
        return new Bound(place.getId(), tripOf(me, day.getTripId(), groupId));
    }

    /**
     * 못 쓸 장소에 대한 <b>한 가지</b> 대답.
     *
     * <p>없는 번호와 볼 수 없는 여행의 장소를 갈라 답하지 않습니다
     * ({@link #placeOf} 의 설명). 사진 쪽과 같은 꼴입니다 — 남의 사진도
     * 없는 사진도 "그런 사진이 없어요" 입니다({@link #minePhotos}).
     */
    private static ApiException noSuchPlace() {
        return ApiException.badRequest("그런 장소가 없어요.");
    }

    /**
     * 글이 묶이는 자리 — 장소와 그 장소의 여행.
     *
     * <p>둘을 함께 돌려주는 까닭은 <b>함께 저장되어야</b> 하기 때문입니다.
     * 따로 돌려주면 부르는 쪽에서 하나만 넣는 날이 옵니다.
     *
     * @param placeId 안 골랐으면 비어 있습니다
     * @param tripId  장소를 골랐으면 그 장소의 여행. 안 골랐으면 보낸 그대로
     */
    private record Bound(String placeId, String tripId) {
    }

    private static String[] cleanTags(List<String> raw) {
        if (raw == null) {
            return new String[0];
        }
        return raw.stream()
                .map(FeedService::tagOf)
                .filter(Objects::nonNull)
                .distinct()
                .limit(MAX_TAGS)
                .toArray(String[]::new);
    }

    /**
     * 태그 하나를 다듬습니다. 못 쓸 것이면 null.
     *
     * <p>사람이 "#라멘", "라멘 ", "라멘" 을 제각기 적습니다. 그대로 두면 같은
     * 말이 세 갈래로 흩어져 어느 것으로도 다 안 걸립니다. 여행기 쪽과 같은
     * 규칙입니다.
     */
    private static String tagOf(String raw) {
        if (raw == null) {
            return null;
        }
        String clean = raw.strip().replaceFirst("^#+", "").strip().toLowerCase(Locale.ROOT);
        return clean.isEmpty() || clean.length() > MAX_TAG_LENGTH ? null : clean;
    }

    private static String blankToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String clean = raw.trim();
        return clean.isEmpty() ? null : clean;
    }

    /**
     * 피드 글 한 편, 화면이 쓰는 꼴로.
     *
     * @param groupId   모임 글이면 그 모임. 내 피드면 비어 있습니다
     * @param audience  누가 볼 수 있는지. 남의 글에도 실어 보냅니다 — 글을
     *                  고치는 판이 지금 값을 집어 두어야 하고, 제 글이면
     *                  카드가 한눈에 보여 줍니다
     * @param tripTitle 어느 여행 이야기인지. 지워진 여행이면 비어 있습니다
     * @param placeId   그 여행의 어느 장소에서 올린 글인지. 안 고른 글과,
     *                  <b>일정에서 장소가 빠진 글</b>은 비어 있습니다 — 뒤쪽은
     *                  글이 남고 묶임만 끊긴 자리입니다
     * @param placeName 그 장소의 이름. 내놓기 판이 장소마다 사진을 모을 때는
     *                  번호로 묶고, 이름은 화면에 적을 때만 씁니다
     * @param mine      내가 쓴 것인지. 고치기·지우기 단추가 여기에 걸립니다
     */
    public record Card(String id, String authorId, String authorName, String authorMark,
                       String groupId, Audience audience, String tripId, String tripTitle,
                       String placeId, String placeName,
                       String text, List<String> tags, List<String> photoIds,
                       int commentCount, boolean mine,
                       Instant createdAt, Instant updatedAt) {
    }

    /** @param more 더 있는지. 「더 보기」를 낼지가 여기에 걸립니다 */
    public record Slice(List<Card> posts, boolean more) {
    }
}
