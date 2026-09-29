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
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

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
    /** 글 하나에 달 수 있는 태그 수. 이보다 많으면 분류가 아니라 검색 낚시입니다. */
    private static final int MAX_TAGS = 8;

    /** 태그 하나의 길이. 문장을 태그로 다는 것을 막습니다. */
    private static final int MAX_TAG_LENGTH = 20;

    public static final List<String> REGIONS = List.of(
            "국내", "일본", "중화권", "동남아", "유럽", "미주", "오세아니아", "그 밖");

    private final TripPostRepository posts;
    private final PostLikeRepository likes;
    private final PostViewRepository views;
    private final PostReportRepository reports;
    /* 장소를 빼면 그 장소에 달린 댓글도 함께 움직여야 합니다. */
    private final PostCommentRepository comments;

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
                            String region, List<String> tags, List<String> dayIds,
                            boolean feedback) {
        Trip trip = access.requireOwner(tripId, me.id());

        if (posts.findAllByAuthorIdOrderByCreatedAtDesc(me.id(), Pageable.ofSize(1))
                .getTotalElements() >= MAX_POSTS_PER_USER) {
            throw ApiException.badRequest("올릴 수 있는 글의 수를 넘었습니다. 예전 글을 내리고 다시 올려 주세요.");
        }

        List<Day> dayList = pickDays(days.findAllByTripIdOrderBySortAsc(tripId), dayIds);
        Set<String> picked = dayList.stream().map(Day::getId).collect(Collectors.toSet());
        /* 고른 날의 장소만 싣습니다. 안 거르면 하루만 올린다고 해 놓고 일정
           전체가 딸려 갑니다. */
        List<Place> placeList = places.findAllOfTrip(tripId).stream()
                .filter(pl -> picked.contains(pl.getDayId()))
                .toList();
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
                .region(known(region))
                .tags(cleanTags(tags))
                .snapshot(snapshotOf(clean, dayList, placeList))
                .dayCount(dayList.size())
                .placeCount(placeList.size())
                .feedback(feedback)
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
        /*
          번호와 색은 글에서 다시 첫날부터 셉니다.

          <p>사흘짜리 여행의 3일차만 올리면 보는 사람에게도 "Day 3" 이라고
          적혀 있었습니다. 남의 여행에서 몇째 날이었는지는 <b>보는 사람이
          알 바가 아닙니다</b> — 그 사람에게는 하루짜리 글이고, 하루짜리
          글의 첫날은 1일차입니다.

          <p>색도 같습니다. 색은 날 번호를 따라 도는 것이라, 3일차만 올리면
          하나뿐인 날이 팔레트의 세 번째 색으로 그려졌습니다. 1일차라고
          적힌 날이 1일차 색이 아니었습니다.

          <p>날 이름은 서버가 짓는 "Day N" 뿐입니다. 고치는 화면이 없어서
          저장된 값이 늘 그것입니다 — 날에 이름을 붙이는 화면이 생기면
          여기부터 다시 봐야 합니다.
        */
        int at = 0;
        for (Day day : dayList) {
            ObjectNode d = dayNodes.addObject();
            d.put("label", DayLabels.labelOf(at));
            d.put("shortName", day.getShortName());
            d.put("theme", day.getTheme());
            d.put("color", DayLabels.colorOf(at));
            d.put("budget", day.getBudget());
            at++;

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
                /* 핀 그림도 사본에 담습니다. 안 담으면 남의 일정을 가져왔을
                   때만 지도가 민무늬가 되어, 왜 내 것과 다른지 알 수 없습니다. */
                n.put("icon", p.getIcon());
                n.put("time", p.getTime());
                n.put("cost", p.getCost());
                /* 잡아 둔 비용. 가져간 사람이 얼마쯤 드는 일인지 알 수
                   있어야 합니다. 예전에 올린 글에는 없는 칸이라, 읽는
                   쪽은 없어도 되게 두었습니다. */
                n.put("costAmount", p.getCostAmount());
                n.put("costCurrency", p.getCostCurrency());
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
    public Page<TripPost> list(String sort, String region, String tag, String days, String q,
                               Pageable pageable) {
        /* 비어 있는 조건에도 NULL 을 보내지 않습니다. 값이 NULL 로만 오면
           PostgreSQL 이 그 자리의 형을 알 수 없다고 거절합니다. */
        String cleanRegion = known(region) == null ? "" : region;
        /* 태그는 아는 목록이 없습니다 — 사람이 직접 적는 것이라 미리 알 수가
           없습니다. 대신 적힐 때와 같은 규칙으로 다듬어 맞춥니다. */
        String cleanTag = tagOf(tag) == null ? "" : tagOf(tag);
        int minDays = 0;
        int maxDays = Integer.MAX_VALUE;
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
                ? posts.search(cleanRegion, cleanTag, minDays, maxDays, likePattern(q), paged)
                : posts.findHot(cleanRegion, cleanTag, minDays, maxDays, likePattern(q), pageable);
    }

    /**
     * 찾을 글자를 LIKE 무늬로.
     *
     * <p>비어 있으면 %% 가 되어 무엇에나 걸립니다. 조건을 빼는 것과 같은
     * 뜻이면서 NULL 을 보내지 않습니다.
     *
     * <p>사람이 친 % 나 _ 는 글자 그대로 찾아야 합니다. 그냥 두면 "50%" 를
     * 찾을 때 그 자리가 아무거나가 되어 엉뚱한 것이 걸립니다.
     */
    private static String likePattern(String q) {
        String clean = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        String escaped = clean.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }

    /**
     * 아는 지역이면 그대로, 아니면 없는 것으로.
     *
     * <p>null 을 따로 걸러야 합니다. List.of 로 만든 목록은 contains(null) 에
     * NullPointerException 을 던집니다 — 담을 수 없는 값을 찾는 것부터가
     * 잘못이라고 보기 때문입니다.
     */
    private static String known(String region) {
        return region != null && REGIONS.contains(region) ? region : null;
    }

    /**
     * 올릴 날들.
     *
     * <h3>왜 하루만 올리고 싶은가</h3>
     *
     * <p>올리는 것이 <b>여행 전체</b>뿐이었습니다. 그런데 닷새 중 하루만
     * 잘 짜인 날이 있고, 나머지는 이동과 쉬는 날인 경우가 흔합니다. 그
     * 하루를 보여 주려고 닷새를 통째로 올리면 보는 사람은 나흘을 지나쳐야
     * 합니다.
     *
     * <p>고른 날만 싣습니다. 하루씩 따로 올리면 글도 하나씩 따로 섭니다 —
     * 「오사카 먹부림 하루」 같은 것이 이렇게 생깁니다.
     *
     * @param want 올릴 날의 id. 비어 있으면 전부입니다 — 지금까지의 동작이고,
     *             날을 고르지 않고 올릴 때가 그렇습니다
     */
    private static List<Day> pickDays(List<Day> all, List<String> want) {
        if (want == null || want.isEmpty()) {
            return all;
        }
        Set<String> keep = Set.copyOf(want);
        /* 넘어온 차례가 아니라 <b>일정의 차례</b>를 지킵니다. 화면이 거꾸로
           골라 보내도 3일차가 1일차보다 앞에 서지는 않습니다. */
        List<Day> out = all.stream().filter(d -> keep.contains(d.getId())).toList();
        if (out.isEmpty()) {
            throw ApiException.badRequest("올릴 날을 하나도 못 찾았습니다.");
        }
        return out;
    }

    /** 태그 하나를 다듬습니다. 못 쓸 것이면 null. */
    private static String tagOf(String raw) {
        if (raw == null) {
            return null;
        }
        /*
          앞뒤 공백과 앞의 # 를 걷고 소문자로.

          <p>사람이 "#아이랑", "아이랑 ", "아이랑" 을 제각기 적습니다. 그대로
          두면 같은 말이 세 갈래로 흩어져 어느 것으로도 다 안 걸립니다.
          한글은 대소문자가 없지만 영어 태그가 섞이므로 같이 내립니다.
        */
        String clean = raw.strip().replaceFirst("^#+", "").strip().toLowerCase(Locale.ROOT);
        return clean.isEmpty() || clean.length() > MAX_TAG_LENGTH ? null : clean;
    }

    /**
     * 달아 온 태그를 다듬습니다.
     *
     * <p>같은 것이 두 번 오면 하나로 하고, 못 쓸 것은 버리고, 너무 많으면
     * 앞에서부터 자릅니다. 글 하나에 태그가 스물이면 그것은 분류가 아니라
     * 검색에 걸리려는 것입니다.
     */
    private static String[] cleanTags(List<String> raw) {
        if (raw == null) {
            return new String[0];
        }
        return raw.stream()
                .map(PostService::tagOf)
                .filter(Objects::nonNull)
                .distinct()
                .limit(MAX_TAGS)
                .toArray(String[]::new);
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
    /**
     * 남의 글을 내 여행으로.
     *
     * @param wantDays 가져올 날의 번호(0부터). 비어 있으면 전부입니다.
     *                 <p>닷새짜리 글에서 이틀만 쓰고 싶을 때가 있습니다 —
     *                 다른 날은 이미 내 계획이 있거나 안 갈 곳입니다. 통째로
     *                 가져와 지우게 하면 지우는 일이 곧 남습니다.
     */
    public Trip copy(AuthPrincipal me, String postId, String startIso, List<Integer> wantDays) {
        TripPost post = read(postId);
        JsonNode snap = snapshotOf(post);

        LocalDate start = DayLabels.parse(startIso);
        Trip trip = trips.save(Trip.builder()
                .title(snap.path("title").asText(post.getTitle()))
                .ownerId(me.id())
                .build());
        members.save(new TripMember(trip.getId(), me.id(), TripRole.EDITOR));

        /*
          고른 날만 가져옵니다.

          <p>번호는 <b>글 안에서의 차례</b>입니다. 글은 올릴 때 뜬 사본이라
          원본 여행의 날짜 id 와는 무관합니다 — 원본이 지워져도 글은 남으므로
          id 로 가리킬 수가 없습니다.

          <p>가져온 뒤의 번호는 다시 0부터입니다. 3·5일차만 가져왔으면 내
          여행에서는 1·2일차입니다. 남의 일정의 몇째 날이었는지는 내 여행에
          남길 것이 아닙니다.
        */
        Set<Integer> keep = wantDays == null || wantDays.isEmpty() ? null : Set.copyOf(wantDays);

        int index = 0;
        int at = -1;
        for (JsonNode d : snap.path("days")) {
            at++;
            if (keep != null && !keep.contains(at)) {
                continue;
            }
            LocalDate date = start.plusDays(index);
            Day day = days.save(Day.builder()
                    .tripId(trip.getId())
                    .sort(index)
                    .label(DayLabels.labelOf(index))
                    .shortName(text(d, "shortName"))
                    .date(DayLabels.display(date))
                    .iso(date)
                    .theme(text(d, "theme"))
                    /* 색도 번호를 따라갑니다. 글의 색을 그대로 가져오면
                       닷새 중 둘만 골라 왔을 때 "Day 2" 가 팔레트의 다섯 번째
                       색으로 그려집니다 — 번호는 다시 셌는데 색은 안 셌으니
                       둘이 어긋납니다. */
                    .color(DayLabels.colorOf(index))
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
                        .costAmount(p.hasNonNull("costAmount") ? p.path("costAmount").asInt() : null)
                        .costCurrency(text(p, "costCurrency"))
                        .note(text(p, "note"))
                        .url(text(p, "url"))
                        .radius(p.hasNonNull("radius") ? p.path("radius").asInt() : null)
                        .fit(!p.has("fit") || p.path("fit").asBoolean(true))
                        .placeId(text(p, "placeId"))
                        .icon(text(p, "icon"))
                        .updatedBy(me.id())
                        .build());
            }
            index++;
        }

        audit.log(me.id(), "post.copy", post.getId(), Map.of("trip", trip.getId()));
        return trip;
    }

    /* ---------------------------------------------------------- 고치기 */

    /**
     * 내 글인지 확인하고 가져옵니다.
     *
     * <p>내리는 것은 운영자도 할 수 있지만(신고 처리), 고치는 것은 글쓴이만
     * 합니다. 남의 글 내용을 운영자가 손보기 시작하면 그 글이 누구 말인지
     * 알 수 없게 됩니다.
     */
    private TripPost mine(AuthPrincipal me, String postId) {
        TripPost post = posts.findById(postId)
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없습니다."));
        if (!post.getAuthorId().equals(me.id())) {
            throw ApiException.forbidden("내 글만 고칠 수 있습니다.");
        }
        return post;
    }

    /**
     * 제목·소개·지역·태그를 고칩니다.
     *
     * <p>null 은 "그대로 두기" 고 빈 값은 "지우기" 입니다. 화면이 고치는 칸만
     * 보내면 나머지는 건드리지 않습니다.
     *
     * @param feedback 조언을 받을지. 껐다 켤 수 있어야 합니다 — 올릴 때는
     *                 받겠다고 했다가 댓글이 버거워지는 경우가 있습니다
     */
    @Transactional
    public TripPost edit(AuthPrincipal me, String postId, String title, String summary,
                         String region, List<String> tags, Boolean feedback) {
        TripPost post = mine(me, postId);

        if (title != null && !title.isBlank()) {
            post.setTitle(title.trim());
            /*
              제목은 사본에도 한 벌 들어 있습니다.

              <p>가져가는 사람의 여행 이름이 사본의 제목에서 옵니다. 겉만
              고치면 목록에는 새 제목이 뜨는데 가져가면 옛 제목의 여행이
              생깁니다.
            */
            JsonNode snap = snapshotOf(post);
            if (snap.isObject()) {
                ((ObjectNode) snap).put("title", post.getTitle());
                post.setSnapshot(write(snap));
            }
        }
        if (summary != null) {
            post.setSummary(summary.isBlank() ? null : summary.trim());
        }
        if (region != null) {
            post.setRegion(known(region));
        }
        if (tags != null) {
            post.setTags(cleanTags(tags));
        }
        if (feedback != null) {
            post.setFeedback(feedback);
        }

        audit.log(me.id(), "post.edit", postId);
        return posts.save(post);
    }

    /**
     * 올린 글에서 장소 하나를 뺍니다.
     *
     * <h3>왜 내리고 다시 올리면 안 되는가</h3>
     *
     * <p>고치는 길이 「내리고 다시 올리기」 뿐이었습니다. 그런데 내리면
     * <b>추천과 조회수와 댓글이 함께 사라집니다.</b> 가운데 한 곳을 잘못
     * 적었다는 이유로 그동안 받은 것을 다 버리게 되니, 대개는 틀린 채로
     * 두게 됩니다.
     *
     * <p>사본을 원본 여행과 다시 맞추는 것이 아닙니다 — 사본 자체를
     * 고칩니다. 원본이 어떻게 되든 글은 그대로라는 규칙은 그대로입니다.
     *
     * <h3>댓글도 따라 움직입니다</h3>
     *
     * <p>댓글은 장소를 <b>번호로</b> 가리킵니다(몇째 날 몇째 곳). 그래서
     * 가운데를 빼면 뒤에 달린 댓글이 한 칸씩 밀려 엉뚱한 장소에 붙습니다 —
     * 어제 「여기 줄 길어요」 라고 적어 둔 것이 다음 집 밑으로 옮겨 갑니다.
     *
     * @param dayAt   몇째 날인지(0부터)
     * @param placeAt 그 날의 몇째 곳인지(0부터)
     */
    @Transactional
    public TripPost dropPlace(AuthPrincipal me, String postId, int dayAt, int placeAt) {
        TripPost post = mine(me, postId);

        JsonNode root = snapshotOf(post);
        if (!root.isObject() || !root.path("days").isArray()) {
            throw ApiException.badRequest("일정을 읽지 못했습니다.");
        }
        ArrayNode dayNodes = (ArrayNode) root.path("days");
        if (dayAt < 0 || dayAt >= dayNodes.size()) {
            throw ApiException.notFound("그런 날이 없습니다.");
        }
        JsonNode day = dayNodes.get(dayAt);
        if (!day.path("places").isArray()) {
            throw ApiException.badRequest("일정을 읽지 못했습니다.");
        }
        ArrayNode placeNodes = (ArrayNode) day.path("places");
        if (placeAt < 0 || placeAt >= placeNodes.size()) {
            throw ApiException.notFound("그런 장소가 없습니다.");
        }

        placeNodes.remove(placeAt);

        /* 마지막 곳을 뺐으면 그 날도 없어집니다. 곳이 하나도 없는 날을
           남겨 두면 보는 사람은 빈 날을 한 번 넘겨야 합니다. */
        boolean dayGone = placeNodes.isEmpty();
        if (dayGone) {
            dayNodes.remove(dayAt);
        }

        int placeCount = 0;
        for (JsonNode d : dayNodes) {
            placeCount += d.path("places").size();
        }
        /* 장소가 없는 글은 올릴 수도 없습니다(publish 참고). 빼다가 그렇게
           되는 길도 막습니다 — 그때 하려던 일은 고치기가 아니라 내리기입니다. */
        if (placeCount == 0) {
            throw ApiException.badRequest("마지막 장소는 뺄 수 없습니다. 글을 내려 주세요.");
        }

        /* 날이 하나 없어졌으면 번호와 색을 다시 셉니다 — 올릴 때와 같은
           규칙입니다(snapshotOf 참고). */
        if (dayGone) {
            int at = 0;
            for (JsonNode d : dayNodes) {
                ((ObjectNode) d).put("label", DayLabels.labelOf(at));
                ((ObjectNode) d).put("color", DayLabels.colorOf(at));
                at++;
            }
        }

        post.setSnapshot(write(root));
        post.setDayCount(dayNodes.size());
        post.setPlaceCount(placeCount);

        shiftComments(postId, dayAt, placeAt, dayGone);

        audit.log(me.id(), "post.drop", postId, Map.of("day", dayAt, "place", placeAt));
        return posts.save(post);
    }

    /**
     * 장소가 빠진 자리에 맞춰 댓글의 번호를 옮깁니다.
     *
     * <p>빠진 곳에 달려 있던 것은 지웁니다. 가리킬 곳이 없어졌는데 남겨 두면
     * 어디에도 안 붙은 채 개수만 세어집니다.
     *
     * <p>감춰진 댓글도 함께 옮깁니다. 운영자가 나중에 풀었을 때 엉뚱한 곳에
     * 붙어 있으면 그것이 더 나쁩니다.
     */
    private void shiftComments(String postId, int dayAt, int placeAt, boolean dayGone) {
        List<PostComment> all = comments.findAllByPostId(postId);
        List<PostComment> gone = new ArrayList<>();
        List<PostComment> moved = new ArrayList<>();

        for (PostComment c : all) {
            Integer d = c.getDayIndex();
            Integer p = c.getPlaceIndex();
            /* 글 전체에 달린 것은 장소를 가리키지 않습니다. 건드릴 것이 없습니다. */
            if (d == null || p == null) {
                continue;
            }
            if (d != dayAt) {
                if (dayGone && d > dayAt) {
                    c.setDayIndex(d - 1);
                    moved.add(c);
                }
                continue;
            }
            if (dayGone || p == placeAt) {
                gone.add(c);
            } else if (p > placeAt) {
                c.setPlaceIndex(p - 1);
                moved.add(c);
            }
        }

        if (!gone.isEmpty()) {
            comments.deleteAll(gone);
        }
        if (!moved.isEmpty()) {
            comments.saveAll(moved);
        }
    }

    /** 사본을 다시 문자열로. 읽을 때와 짝입니다(snapshotOf 참고). */
    private String write(JsonNode snap) {
        try {
            return mapper.writeValueAsString(snap);
        } catch (Exception e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "일정을 담지 못했습니다.");
        }
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

    /** 내가 추천을 눌러 둔 글. 구경하다 담아 둔 것을 되찾는 길입니다. */
    public Page<TripPost> liked(AuthPrincipal me, Pageable pageable) {
        return posts.likedBy(me.id(), pageable);
    }

    private static String text(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.path(field).asText() : null;
    }

    /** 목록 한 줄. 사본 전체는 싣지 않습니다 — 목록에서는 쓰지 않습니다. */
    public record Card(String id, String title, String summary, String region,
                       List<String> tags, String authorName,
                       int dayCount, int placeCount, int likeCount, int viewCount,
                       boolean liked, java.time.Instant createdAt) {
    }

    /**
     * 지금 쓰이고 있는 태그들.
     *
     * <h3>고르는 목록을 안 두는 대신</h3>
     *
     * <p>태그는 사람이 직접 적습니다 — 무엇으로 묶일지는 미리 알 수 없고,
     * 목록을 만들어 두면 거기 없는 여행은 아무 데도 안 걸립니다.
     *
     * <p>대신 <b>이미 쓰인 것</b>을 보여 줍니다. 적을 때는 옆에 뜨니까
     * 저절로 같은 말로 모이고, 찾을 때는 무엇을 찾을 수 있는지 알게 됩니다.
     * 목록을 우리가 정하지 않으면서 흩어지지는 않게 하는 길입니다.
     *
     * <p>많이 쓰인 순서로 자릅니다. 한 번 쓰인 태그까지 다 내면 그것은
     * 목록이 아니라 남의 글 모음입니다.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> tags(int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] r : posts.tagCounts(limit)) {
            out.add(Map.of("tag", (String) r[0], "posts", ((Number) r[1]).intValue()));
        }
        return out;
    }

    public List<Card> cardsOf(List<TripPost> list, String userId) {
        Set<String> mine = likedBy(userId, list.stream().map(TripPost::getId).toList());
        List<Card> out = new ArrayList<>(list.size());
        for (TripPost p : list) {
            out.add(new Card(p.getId(), p.getTitle(), p.getSummary(), p.getRegion(),
                    List.of(p.getTags()), authorNameOf(p),
                    p.getDayCount(), p.getPlaceCount(), p.getLikeCount(), p.getViewCount(),
                    mine.contains(p.getId()), p.getCreatedAt()));
        }
        return out;
    }
}
