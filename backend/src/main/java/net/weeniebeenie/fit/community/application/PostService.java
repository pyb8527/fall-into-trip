package net.weeniebeenie.fit.community.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.community.domain.*;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 일정을 남에게 보여 주고, 남의 일정을 가져오는 곳.
 *
 * <p>글의 내용은 <b>올릴 때 뜬 사본</b>입니다. 원본을 가리키게 두면 올린 뒤
 * 작성자가 일정을 고칠 때 남이 보던 글이 조용히 달라지고, 여행을 지우면 글이
 * 깨집니다. 복제도 사본에서 하므로 원본이 어떻게 되든 상관없습니다.
 */
@Service
@RequiredArgsConstructor
public class PostService {

    /** 한 사람이 올릴 수 있는 글의 수. 같은 일정을 도배하는 것을 막습니다. */
    private static final int MAX_POSTS_PER_USER = 30;

    /** 이만큼 신고가 쌓이면 사람이 볼 때까지 감춥니다. */
    private static final long HIDE_AT_REPORTS = 3;

    /**
     * 고를 수 있는 지역.
     *
     * <p>나라 단위로 쪼개면 목록이 길어져 고르기가 일이 되고, 대륙 단위면
     * "유럽" 하나에 다 들어가 거르는 뜻이 없어집니다. 여행지로 실제 묶이는
     * 단위로 나눕니다.
     *
     * <p>화면에도 이 목록을 그대로 씁니다. 두 곳에서 따로 적으면 언젠가
     * 어긋나고, 어긋나면 고른 값이 저장은 되는데 아무것도 안 걸립니다.
     */
    public static final List<String> REGIONS = List.of(
            "국내", "일본", "중화권", "동남아", "유럽", "미주", "오세아니아", "그 밖");

    private final TripPostRepository posts;
    private final PostLikeRepository likes;
    private final PostViewRepository views;
    private final PostReportRepository reports;

    private final TripRepository trips;
    private final DayRepository days;
    private final PlaceRepository places;
    private final TripMemberRepository members;
    private final TripAccessPolicy access;
    private final UserRepository users;

    private final AuditService audit;
    private final ObjectMapper mapper;

    /* ------------------------------------------------------------ 올리기 */

    @Transactional
    public TripPost publish(AuthPrincipal me, String tripId, String title, String summary,
                            String region) {
        Trip trip = access.requireOwner(tripId, me.id());

        if (posts.findAllByAuthorIdOrderByCreatedAtDesc(me.id(), Pageable.ofSize(1))
                .getTotalElements() >= MAX_POSTS_PER_USER) {
            throw ApiException.badRequest("올릴 수 있는 글의 수를 넘었습니다. 예전 글을 내리고 다시 올려 주세요.");
        }

        List<Day> dayList = days.findAllByTripIdOrderBySortAsc(tripId);
        List<Place> placeList = places.findAllOfTrip(tripId);
        if (placeList.isEmpty()) {
            throw ApiException.badRequest("장소가 하나도 없는 일정은 올릴 수 없습니다.");
        }

        String clean = title == null || title.isBlank() ? trip.getTitle() : title.trim();
        TripPost post = posts.save(TripPost.builder()
                .tripId(trip.getId())
                .authorId(me.id())
                .title(clean)
                .summary(summary == null || summary.isBlank() ? null : summary.trim())
                /* 목록에 없는 값이 들어오면 아무것도 안 걸리는 글이 됩니다. 버립니다. */
                .region(REGIONS.contains(region) ? region : null)
                .snapshot(snapshotOf(clean, dayList, placeList))
                .dayCount(dayList.size())
                .placeCount(placeList.size())
                .build());

        audit.log(me.id(), "post.publish", post.getId(), Map.of("trip", tripId));
        return post;
    }

    /**
     * 지금 일정을 그대로 떠 둡니다.
     *
     * <p>사람 것은 담지 않습니다. 누가 다녀왔는지(visits), 누가 고쳤는지
     * (updatedBy), 동행자가 누구인지는 그 여행을 같이 간 사람들의 것이지
     * 일정의 일부가 아닙니다. 남이 복제해 갈 때 따라가면 안 됩니다.
     */
    private String snapshotOf(String title, List<Day> dayList, List<Place> placeList) {
        ObjectNode root = mapper.createObjectNode();
        root.put("title", title);

        ArrayNode dayNodes = root.putArray("days");
        for (Day day : dayList) {
            ObjectNode d = dayNodes.addObject();
            d.put("label", day.getLabel());
            d.put("shortName", day.getShortName());
            d.put("theme", day.getTheme());
            d.put("color", day.getColor());
            d.put("budget", day.getBudget());

            ArrayNode placeNodes = d.putArray("places");
            for (Place p : placeList) {
                if (!p.getDayId().equals(day.getId())) {
                    continue;
                }
                ObjectNode n = placeNodes.addObject();
                n.put("name", p.getName());
                n.put("ja", p.getJa());
                n.put("en", p.getEn());
                n.put("lat", p.getLat());
                n.put("lng", p.getLng());
                n.put("cat", p.getCat());
                n.put("time", p.getTime());
                n.put("cost", p.getCost());
                n.put("note", p.getNote());
                n.put("url", p.getUrl());
                n.put("radius", p.getRadius());
                n.put("fit", p.isFit());
                /* 구글이 붙인 번호는 그 가게의 사실이라 함께 갑니다.
                   복제한 사람도 영업시간을 볼 수 있어야 합니다. */
                n.put("placeId", p.getPlaceId());
            }
        }
        return root.toString();
    }

    /* ------------------------------------------------------------- 읽기 */

    /**
     * 골라 보기.
     *
     * <p>거르는 조건은 정렬과 무관하게 같습니다. 띠를 바꿨다고 보는 범위까지
     * 달라지면 결과가 널뜁니다.
     *
     * @param days 며칠짜리인지. "1" 은 당일치기, "2-4" 는 1~3박, "5" 는 그 이상.
     */
    @Transactional(readOnly = true)
    public Page<TripPost> list(String sort, String region, String days, String q, Pageable pageable) {
        String cleanRegion = REGIONS.contains(region) ? region : null;
        String cleanQ = q == null || q.isBlank() ? null : q.trim();
        Integer minDays = null;
        Integer maxDays = null;
        if (days != null) {
            switch (days) {
                case "1" -> maxDays = 1;
                case "2-4" -> {
                    minDays = 2;
                    maxDays = 4;
                }
                case "5" -> minDays = 5;
                default -> { /* 모르는 값은 거르지 않는 것으로 봅니다. */ }
            }
        }

        Pageable paged = switch (sort == null ? "hot" : sort) {
            case "new" -> withSort(pageable, Sort.by(Sort.Direction.DESC, "createdAt"));
            case "top" -> withSort(pageable,
                    Sort.by(Sort.Direction.DESC, "likeCount").and(Sort.by(Sort.Direction.DESC, "createdAt")));
            default -> pageable;
        };

        /* 인기 순은 나이로 나눈 값이라 정렬을 질의 안에 박아 두었습니다. */
        return "new".equals(sort) || "top".equals(sort)
                ? posts.search(cleanRegion, minDays, maxDays, cleanQ, paged)
                : posts.findHot(cleanRegion, minDays, maxDays, cleanQ, pageable);
    }

    private static Pageable withSort(Pageable page, Sort sort) {
        return PageRequest.of(page.getPageNumber(), page.getPageSize(), sort);
    }

    @Transactional(readOnly = true)
    public TripPost read(String postId) {
        TripPost post = posts.findById(postId)
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없습니다."));
        if (post.isHidden()) {
            /* 내려간 글이 있다는 것 자체를 알릴 이유가 없습니다. */
            throw ApiException.notFound("글을 찾을 수 없습니다.");
        }
        return post;
    }

    /** 하루에 한 번만 셉니다. 새로고침으로는 늘지 않습니다. */
    @Transactional
    public void countView(String postId, String userId) {
        if (userId == null) {
            return;
        }
        LocalDate today = LocalDate.now();
        if (views.existsByPostIdAndUserIdAndOnDate(postId, userId, today)) {
            return;
        }
        views.save(new PostView(postId, userId, today));
        posts.addView(postId);
    }

    @Transactional(readOnly = true)
    public Set<String> likedBy(String userId, List<String> postIds) {
        if (userId == null || postIds.isEmpty()) {
            return Set.of();
        }
        return Set.copyOf(likes.minesIn(userId, postIds));
    }

    public String authorNameOf(TripPost post) {
        return users.findById(post.getAuthorId()).map(User::getName).orElse("알 수 없음");
    }

    public JsonNode snapshotOf(TripPost post) {
        try {
            return mapper.readTree(post.getSnapshot());
        } catch (Exception e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "일정을 읽지 못했습니다.");
        }
    }

    /* ------------------------------------------------------------- 추천 */

    @Transactional
    public boolean like(AuthPrincipal me, String postId, boolean on) {
        TripPost post = read(postId);
        boolean already = likes.existsByPostIdAndUserId(postId, me.id());

        if (on && !already) {
            likes.save(new PostLike(postId, me.id()));
            posts.addLike(post.getId(), 1);
        } else if (!on && already) {
            likes.deleteByPostIdAndUserId(postId, me.id());
            posts.addLike(post.getId(), -1);
        }
        return on;
    }

    /* ------------------------------------------------------------- 복제 */

    /**
     * 남의 일정을 내 것으로 가져옵니다.
     *
     * <p>날짜는 새로 받습니다. 남이 작년에 다녀온 날짜를 그대로 물려받으면
     * 지나간 일정이 됩니다. 첫날을 정하면 나머지가 따라 붙습니다.
     */
    @Transactional
    public Trip copy(AuthPrincipal me, String postId, String startIso) {
        TripPost post = read(postId);
        JsonNode snap = snapshotOf(post);

        LocalDate start = DayLabels.parse(startIso);
        Trip trip = trips.save(Trip.builder()
                .title(snap.path("title").asText(post.getTitle()))
                .ownerId(me.id())
                .build());
        members.save(new TripMember(trip.getId(), me.id(), TripRole.EDITOR));

        int index = 0;
        for (JsonNode d : snap.path("days")) {
            LocalDate date = start.plusDays(index);
            Day day = days.save(Day.builder()
                    .tripId(trip.getId())
                    .sort(index)
                    .label(DayLabels.labelOf(index))
                    .shortName(text(d, "shortName"))
                    .date(DayLabels.display(date))
                    .iso(date)
                    .theme(text(d, "theme"))
                    .color(text(d, "color") == null ? DayLabels.colorOf(index) : text(d, "color"))
                    .budget(text(d, "budget"))
                    .build());

            int sort = 0;
            for (JsonNode p : d.path("places")) {
                places.save(Place.builder()
                        .dayId(day.getId())
                        .sort(sort++)
                        .name(p.path("name").asText("이름 없음"))
                        .ja(text(p, "ja"))
                        .en(text(p, "en"))
                        .lat(p.path("lat").asDouble())
                        .lng(p.path("lng").asDouble())
                        .cat(text(p, "cat"))
                        .time(text(p, "time"))
                        .cost(text(p, "cost"))
                        .note(text(p, "note"))
                        .url(text(p, "url"))
                        .radius(p.hasNonNull("radius") ? p.path("radius").asInt() : null)
                        .fit(!p.has("fit") || p.path("fit").asBoolean(true))
                        .placeId(text(p, "placeId"))
                        .updatedBy(me.id())
                        .build());
            }
            index++;
        }

        audit.log(me.id(), "post.copy", post.getId(), Map.of("trip", trip.getId()));
        return trip;
    }

    /* --------------------------------------------------------- 내리기·신고 */

    @Transactional
    public void remove(AuthPrincipal me, String postId) {
        TripPost post = posts.findById(postId)
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없습니다."));
        boolean mine = post.getAuthorId().equals(me.id());
        if (!mine && me.role() != Role.ADMIN) {
            throw ApiException.forbidden("내 글만 내릴 수 있습니다.");
        }
        posts.delete(post);
        audit.log(me.id(), mine ? "post.remove" : "post.remove.admin", postId);
    }

    /**
     * 신고.
     *
     * <p>몇 건이 쌓이면 사람이 볼 때까지 자동으로 감춥니다. 혼자 운영하는
     * 서비스라 신고가 들어온 뒤 볼 때까지 몇 시간이 걸릴 수 있는데, 그동안
     * 문제되는 글이 첫 화면에 걸려 있으면 안 됩니다.
     *
     * <p>대신 몇 사람이 짜면 멀쩡한 글도 내려갈 수 있습니다. 지우지 않고
     * 감추기만 하므로 운영자가 되돌릴 수 있습니다.
     */
    @Transactional
    public void report(AuthPrincipal me, String postId, String reason) {
        TripPost post = read(postId);
        if (post.getAuthorId().equals(me.id())) {
            throw ApiException.badRequest("내 글은 신고할 수 없습니다.");
        }
        if (reports.existsByPostIdAndUserId(postId, me.id())) {
            throw ApiException.badRequest("이미 신고한 글입니다.");
        }
        reports.save(new PostReport(postId, me.id(),
                reason == null || reason.isBlank() ? null : reason.trim()));

        if (reports.countByPostId(postId) >= HIDE_AT_REPORTS) {
            post.setHidden(true);
            post.touch();
        }
        audit.log(me.id(), "post.report", postId);
    }

    /* ------------------------------------------------------------- 운영 */

    /**
     * 운영자가 봐야 할 글.
     *
     * <p>신고가 들어온 글과 그래서 감춰진 글입니다. 자동으로 감추는 규칙이
     * 있는 이상 되돌릴 통로도 있어야 합니다. 몇 사람이 짜면 멀쩡한 글도
     * 내려가는데, 그것을 되살릴 수 없으면 신고가 곧 삭제가 됩니다.
     */
    @Transactional(readOnly = true)
    public Page<TripPost> needingReview(Pageable pageable) {
        return posts.findNeedingReview(pageable);
    }

    public long reportCountOf(String postId) {
        return reports.countByPostId(postId);
    }

    /** 운영자가 감추거나 다시 올립니다. */
    @Transactional
    public void setHidden(AuthPrincipal me, String postId, boolean hidden) {
        TripPost post = posts.findById(postId)
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없습니다."));
        post.setHidden(hidden);
        post.touch();
        audit.log(me.id(), hidden ? "post.hide" : "post.unhide", postId);
    }

    /* ------------------------------------------------------- 내가 쓴 글 */

    @Transactional(readOnly = true)
    public Page<TripPost> mine(AuthPrincipal me, Pageable pageable) {
        return posts.findAllByAuthorIdOrderByCreatedAtDesc(me.id(), pageable);
    }

    private static String text(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.path(field).asText() : null;
    }

    /** 목록 한 줄. 사본 전체는 싣지 않습니다 — 목록에서는 쓰지 않습니다. */
    public record Card(String id, String title, String summary, String region, String authorName,
                       int dayCount, int placeCount, int likeCount, int viewCount,
                       boolean liked, java.time.Instant createdAt) {
    }

    public List<Card> cardsOf(List<TripPost> list, String userId) {
        Set<String> mine = likedBy(userId, list.stream().map(TripPost::getId).toList());
        List<Card> out = new ArrayList<>(list.size());
        for (TripPost p : list) {
            out.add(new Card(p.getId(), p.getTitle(), p.getSummary(), p.getRegion(), authorNameOf(p),
                    p.getDayCount(), p.getPlaceCount(), p.getLikeCount(), p.getViewCount(),
                    mine.contains(p.getId()), p.getCreatedAt()));
        }
        return out;
    }
}
