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

    /** 글 하나에 달 수 있는 태그 수. 이보다 많으면 분류가 아니라 검색 낚시입니다. */
    private static final int MAX_TAGS = 8;

    /**
     * 여행기 한 편에 같이 실을 수 있는 글.
     *
     * <p>스무 편이면 여행기가 아니라 피드를 통째로 옮긴 것이 됩니다. 읽는
     * 사람은 일정을 보러 왔는데 남의 사진 백 장을 지나가야 합니다.
     */
    private static final int MAX_STORIES = 20;

    /** 태그 하나의 길이. 문장을 태그로 다는 것을 막습니다. */
    private static final int MAX_TAG_LENGTH = 20;

    /**
     * 고를 수 있는 지역. 화면도 이 목록을 그대로 받아 씁니다.
     *
     * <p>목록과 좌표 표가 {@link Regions} 한 곳에 있습니다. 여기에 다시 적어
     * 두면 언젠가 어긋나고, 어긋나면 고른 값이 저장은 되는데 아무것도 안
     * 걸립니다.
     */
    public static final List<String> REGIONS = Regions.ALL;

    private final TripPostRepository posts;
    private final PostLikeRepository likes;
    private final PostViewRepository views;
    private final PostReportRepository reports;
    /* 장소를 빼면 그 장소에 달린 댓글도 함께 움직여야 합니다. */
    private final PostCommentRepository comments;

    private final TripRepository trips;
    private final DayRepository days;
    private final PlaceRepository places;
    private final TripAccessPolicy access;
    private final UserRepository users;

    private final net.weeniebeenie.fit.trip.application.VisitService visits;
    private final net.weeniebeenie.fit.photo.domain.PhotoRepository photos;
    /* 여행기에 같이 실을 피드 글. 글쓴이가 고른 것만 담습니다. */
    private final net.weeniebeenie.fit.trip.domain.PlacePhotoRepository placePhotos;
    private final net.weeniebeenie.fit.feed.domain.PostRepository stories;
    private final net.weeniebeenie.fit.feed.domain.PostPhotoRepository storyPhotos;

    private final AuditService audit;
    private final ObjectMapper mapper;

    /* ------------------------------------------------------------ 올리기 */

    @Transactional
    public TripPost publish(AuthPrincipal me, String tripId, String title, String summary,
                            String region, List<String> tags, List<String> dayIds,
                            boolean feedback, String coverPhotoId, Visibility visibility,
                            List<String> storyIds, List<String> placePhotoIds) {
        Trip trip = access.requireOwner(tripId, me.id());

        if (posts.findAllByAuthorIdOrderByCreatedAtDesc(me.id(), Pageable.ofSize(1))
                .getTotalElements() >= MAX_POSTS_PER_USER) {
            throw ApiException.badRequest("올릴 수 있는 글의 수를 넘었어요. 예전 글을 내리고 다시 올려 주세요.");
        }

        List<Day> dayList = pickDays(days.findAllByTripIdOrderBySortAsc(tripId), dayIds);
        Set<String> picked = dayList.stream().map(Day::getId).collect(Collectors.toSet());
        /* 고른 날의 장소만 싣습니다. 안 거르면 하루만 올린다고 해 놓고 일정
           전체가 딸려 갑니다. */
        List<Place> placeList = places.findAllOfTrip(tripId).stream()
                .filter(pl -> picked.contains(pl.getDayId()))
                .toList();
        if (placeList.isEmpty()) {
            throw ApiException.badRequest("장소가 하나도 없는 일정은 올릴 수 없어요.");
        }

        String clean = title == null || title.isBlank() ? trip.getTitle() : title.trim();
        /*
          지역을 안 골랐으면 좌표에서 꼽습니다.

          <p>화면이 여행 이름과 장소 이름을 <b>글자로 훑어</b> 지역을 미리
          골라 주고 있었습니다. 「도쿄 라멘 투어」는 도쿄가 되지만 「엄마랑
          셋이」는 아무것도 안 되고, 「도쿄에서 산 물건들」도 도쿄 모음에
          섰습니다. 제목은 지역에 대한 사실이 아닙니다.

          <p>장소에는 좌표가 있고, 꼽을 칸은 대륙만 한 여덟 개뿐입니다
          ({@link Regions}). 서버가 가진 사실로 꼽습니다 — 사람이 골랐으면
          그것이 이기고, 목록에 없는 값이 오면 안 고른 것으로 봅니다.
        */
        String pickedRegion = known(region);
        if (pickedRegion == null) {
            pickedRegion = regionOf(dayList, placeList);
        }
        TripPost post = posts.save(TripPost.builder()
                .tripId(trip.getId())
                .authorId(me.id())
                .title(clean)
                .summary(summary == null || summary.isBlank() ? null : summary.trim())
                .region(pickedRegion)
                .tags(cleanTags(tags))
                .coverPhotoId(myPhoto(me, coverPhotoId))
                .visibility(visibility)
                /*
                  도장에 남긴 것을 함께 싣습니다.

                  <p>여행기의 알맹이가 이것입니다 — 어디를 갔는지는 일정이
                  말하고, <b>어땠는지</b>는 그 자리에서 남긴 사진과 한 줄이
                  말합니다. 돌아와서 다시 쓰라고 하면 안 씁니다.

                  <p>올린 사람 것만 봅니다. 같이 간 사람이 각자 찍은 도장은
                  그 사람 것이고, 남의 감상을 내 글에 실을 일이 아닙니다.
                */
                .snapshot(snapshotOf(clean, dayList, placeList,
                        storiesOf(me, trip, dayList, storyIds),
                        shownPhotos(placeList, placePhotoIds)))
                .dayCount(dayList.size())
                .placeCount(placeList.size())
                .feedback(feedback)
                .build());
        /* 모임 여행에서 나온 여행기인지 — 둘러보기의 혼자 · 모임 조건(V51). */
        post.setFromGroup(trip.getGroupId() != null);

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
    private String snapshotOf(String title, List<Day> dayList, List<Place> placeList,
                              List<Story> storyList, Map<String, List<String>> shownByPlace) {
        ObjectNode root = mapper.createObjectNode();
        root.put("title", title);

        /*
          같이 실은 피드 글.

          <p>여행기의 알맹이가 이것입니다 — 어디를 갔는지는 일정이 말하고,
          <b>어땠는지</b>는 그때 올린 사진과 한 줄이 말합니다. 돌아와서 다시
          쓰라고 하면 안 씁니다.

          <p>사본에 담으므로 나중에 그 글을 고치거나 지워도 여행기는 그대로
          입니다. 사본은 <b>그때의 모습</b>이고, 그것이 여행기가 사본인
          이유입니다.
        */
        ArrayNode storyNodes = root.putArray("stories");
        for (Story s : storyList) {
            ObjectNode n = storyNodes.addObject();
            n.put("text", s.text());
            n.put("author", s.author());
            n.put("at", s.at().toString());
            /* 몇째 날 사이에 끼울지. 없으면 일정 뒤에 섭니다. */
            if (s.dayIndex() != null) {
                n.put("dayIndex", s.dayIndex());
            }
            ArrayNode tagNodes = n.putArray("tags");
            s.tags().forEach(tagNodes::add);
            ArrayNode shots = n.putArray("photos");
            s.photos().forEach(shots::add);
        }

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

                /*
                  그 자리에서 남긴 것.

                  <p>사진 번호가 그대로 갑니다 — 사진 자체는 우리 서버에
                  있고, 보는 사람은 /api/photos/… 로 가져갑니다. 글이 공개면
                  그 사진도 함께 공개되는 셈이라, 올릴 때 무엇이 함께 가는지
                  화면이 보여 주어야 합니다.
                */
                /*
                  장소에 붙은 사진 — <b>고른 것만</b> 담습니다.

                  <p>한동안 하나도 안 담았습니다. 여기 남은 것이 「다니면서 볼
                  사진」이라서입니다 — 메뉴판, 예매 화면, 가는 길 지도. 통째로
                  담으면 <b>남의 여행기에 내 예매 QR 이 실립니다.</b>

                  <p>그래서 안 담는 쪽을 택했는데, 그러면 <b>장소마다 찍어 둔
                  진짜 사진도 같이 묻힙니다.</b> 여행기를 읽는 사람이 가장 보고
                  싶은 것이 그것인데 말입니다.

                  <p>올릴 때 고르게 합니다. 기본은 아무것도 안 고름입니다 —
                  공개로 돌리는 것은 한 장씩 고르는 일이어야 하고, 그래야 예매
                  화면이 섞여 나갈 일이 없습니다.
                */
                List<String> picked = shownByPlace.get(p.getId());
                if (picked != null && !picked.isEmpty()) {
                    ArrayNode shotNodes = n.putArray("photos");
                    picked.forEach(shotNodes::add);
                }
            }
        }
        return root.toString();
    }

    /**
     * 여행기에 같이 실을 피드 글을 골라 담습니다.
     *
     * <h3>내가 쓴 것만</h3>
     *
     * <p>같은 모임에서 남이 올린 사진을 내 여행기에 실어 <b>공개</b>로
     * 돌리는 일이 됩니다. 모임 안에서 보이는 것과 아무나 보는 것은 다른
     * 이야기이고, 그 결정은 찍은 사람이 합니다.
     *
     * <h3>이 여행의 글만</h3>
     *
     * <p>다른 여행 이야기가 섞이면 여행기가 그 여행의 기록이 아니게 됩니다.
     *
     * <h3>몇째 날 사이에 끼울지</h3>
     *
     * <p>글이 올라온 날짜를 일정의 날짜와 맞춰 봅니다. 여행 중에 올린 글은
     * 그날 자리에 끼이고, 돌아와서 올린 글은 일정 뒤에 섭니다. 올린 때가 곧
     * 겪은 때는 아니지만, 사람에게 날을 또 고르게 하는 것보다 낫습니다 —
     * 올리는 일이 길어지면 안 올립니다.
     */
    private List<Story> storiesOf(AuthPrincipal me, Trip trip, List<Day> dayList,
                                  List<String> storyIds) {
        if (storyIds == null || storyIds.isEmpty()) {
            return List.of();
        }
        List<String> want = storyIds.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
        if (want.size() > MAX_STORIES) {
            throw ApiException.badRequest("같이 실을 글은 " + MAX_STORIES + "편까지예요.");
        }

        /* 날짜 → 몇째 날인지. 고른 날만 들어 있습니다 — 안 올린 날에 걸리면
           그 글은 갈 데가 없으므로 뒤에 섭니다. */
        Map<java.time.LocalDate, Integer> whichDay = new java.util.HashMap<>();
        for (int i = 0; i < dayList.size(); i++) {
            java.time.LocalDate iso = dayList.get(i).getIso();
            if (iso != null) {
                whichDay.putIfAbsent(iso, i);
            }
        }

        String myName = users.findById(me.id()).map(User::getName).orElse("알 수 없음");
        List<Story> out = new ArrayList<>();
        for (String id : want) {
            net.weeniebeenie.fit.feed.domain.Post story = stories.findById(id)
                    .orElseThrow(() -> ApiException.badRequest("그런 글이 없어요."));
            if (!story.getAuthorId().equals(me.id())) {
                throw ApiException.badRequest("내가 쓴 글만 함께 실을 수 있어요.");
            }
            if (!trip.getId().equals(story.getTripId())) {
                throw ApiException.badRequest("이 여행의 글만 함께 실을 수 있어요.");
            }

            List<String> shots = storyPhotos.findAllByPostIdOrderBySortAsc(id).stream()
                    .map(net.weeniebeenie.fit.feed.domain.PostPhoto::getPhotoId)
                    .toList();
            java.time.LocalDate on = story.getCreatedAt()
                    .atZone(java.time.ZoneId.systemDefault()).toLocalDate();

            out.add(new Story(story.getText(), myName, story.getCreatedAt(),
                    whichDay.get(on), List.of(story.getTags()), shots));
        }
        /* 올린 차례대로. 고른 차례는 화면이 어떻게 늘어놓았느냐에 달렸는데,
           읽는 사람에게 뜻이 있는 것은 시간입니다. */
        out.sort(java.util.Comparator.comparing(Story::at));
        return out;
    }

    /**
     * 여행기에 실을 장소 사진을 골라 담습니다.
     *
     * <p>고른 번호가 <b>이 여행의 장소에 실제로 붙어 있는지</b>를 봅니다.
     * 안 보면 남의 사진 번호를 넣어 공개 글에 실을 수 있습니다 — 번호는
     * 난수라 찍어서 맞히기 어렵지만, 어렵다는 것이 막았다는 뜻은 아닙니다.
     *
     * <p>차례는 장소에 붙어 있던 차례 그대로입니다. 고른 차례는 화면이
     * 어떻게 늘어놓았느냐에 달렸는데, 읽는 사람에게 뜻이 있는 것은 그 장소에
     * 놓인 차례입니다.
     *
     * @return 장소 번호 → 그 장소에 실을 사진들
     */
    private Map<String, List<String>> shownPhotos(List<Place> placeList, List<String> want) {
        if (want == null || want.isEmpty()) {
            return Map.of();
        }
        Set<String> wanted = Set.copyOf(want);
        List<String> placeIds = placeList.stream().map(Place::getId).toList();

        Map<String, List<String>> out = new java.util.HashMap<>();
        for (net.weeniebeenie.fit.trip.domain.PlacePhoto pp :
                placePhotos.findAllByPlaceIdInOrderByPlaceIdAscSortAsc(placeIds)) {
            if (wanted.contains(pp.getPhotoId())) {
                out.computeIfAbsent(pp.getPlaceId(), k -> new ArrayList<>()).add(pp.getPhotoId());
            }
        }
        return out;
    }

    /**
     * 사본에 담기 직전의 글 한 편.
     *
     * @param dayIndex 몇째 날 뒤에 설지. 비어 있으면 일정 뒤입니다
     */
    private record Story(String text, String author, java.time.Instant at,
                         Integer dayIndex, List<String> tags, List<String> photos) {
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
        return list(sort, region, tag, days, q, null, pageable);
    }

    /**
     * @param who {@code solo} 혼자 여행에서 나온 것만 · {@code group} 모임 여행에서 · 비우면 전부
     */
    @Transactional(readOnly = true)
    public Page<TripPost> list(String sort, String region, String tag, String days, String q,
                               String who, Pageable pageable) {
        String cleanWho = "solo".equals(who) || "group".equals(who) ? who : "";
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
        if ("copied".equals(sort)) {
            return posts.findCopied(cleanRegion, cleanTag, minDays, maxDays, cleanWho, likePattern(q), pageable);
        }
        return "new".equals(sort) || "top".equals(sort)
                ? posts.search(cleanRegion, cleanTag, minDays, maxDays, cleanWho, likePattern(q), paged)
                : posts.findHot(cleanRegion, cleanTag, minDays, maxDays, cleanWho, likePattern(q), pageable);
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
     * 여행의 첫 장소 좌표로 지역을 꼽습니다. 여행이 없으면 {@code null} 입니다.
     */
    private String regionOf(String tripId) {
        return regionOf(days.findAllByTripIdOrderBySortAsc(tripId), places.findAllOfTrip(tripId));
    }

    /**
     * 올리는 일정의 지역.
     *
     * <h3>왜 첫날 첫 장소인가</h3>
     *
     * <p>장소를 모두 꼽아 가장 많은 지역을 고르는 길도 있습니다. 그런데
     * 「오사카 사흘, 교토 하루」 는 어느 쪽으로 세도 간사이라서 답이 같고,
     * 「도쿄 들렀다 하와이」 처럼 답이 갈리는 일정은 <b>떠난 곳</b>이 지역입니다.
     * 세는 쪽이 값만 더 들고 더 맞지는 않습니다.
     *
     * <p>좌표가 없는 장소는 건너뜁니다. 비워 둔 좌표는 0/0 으로 들어오는데,
     * 그 자리는 기니만 바다입니다 — 「그 밖」이라고 답하면 그것도 틀린 말입니다.
     *
     * @param dayList  날짜 순서대로
     * @param placeList 날 안에서는 {@code sort} 순서대로
     * @return {@link Regions#ALL} 안의 값, 또는 좌표가 하나도 없으면 {@code null}
     */
    private static String regionOf(List<Day> dayList, List<Place> placeList) {
        for (Day day : dayList) {
            for (Place place : placeList) {
                if (!day.getId().equals(place.getDayId())) {
                    continue;
                }
                if (place.getLat() == 0 && place.getLng() == 0) {
                    continue;
                }
                return Regions.of(place.getLat(), place.getLng());
            }
        }
        return null;
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
            throw ApiException.badRequest("올릴 날을 하나도 못 찾았어요.");
        }
        return out;
    }

    /**
     * 내가 올린 사진인지.
     *
     * <p>안 보면 남의 사진 번호를 표지로 박아 넣을 수 있습니다. 번호는
     * 난수라 찍어서 맞히기 어렵지만, 어렵다는 것이 막았다는 뜻은 아닙니다.
     */
    private String myPhoto(AuthPrincipal me, String photoId) {
        if (photoId == null || photoId.isBlank()) {
            return null;
        }
        return photos.findById(photoId)
                .filter(p -> p.getOwnerId().equals(me.id()))
                .map(p -> p.getId())
                .orElseThrow(() -> ApiException.badRequest("그런 사진이 없어요."));
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
    /**
     * 글 하나.
     *
     * @param viewerId 보는 사람. 로그인 안 했으면 null
     */
    public TripPost read(String postId, String viewerId) {
        TripPost post = posts.findById(postId)
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없어요."));
        if (post.isHidden()) {
            /* 내려간 글이 있다는 것 자체를 알릴 이유가 없습니다. */
            throw ApiException.notFound("글을 찾을 수 없어요.");
        }
        /*
          나만 보는 글.

          <p>없다고 답합니다 — "볼 수 없습니다" 는 <b>있다는 말</b>입니다.
          번호를 하나씩 넣어 보면 어느 것이 있는 글인지 가려낼 수 있습니다.

          <p>주소를 아는 사람만(LINK) 은 여기서 안 막습니다. 그것이 그 갈래의
          뜻입니다 — 목록과 검색에서 빠질 뿐입니다.
        */
        if (post.getVisibility() == Visibility.PRIVATE
                && !post.getAuthorId().equals(viewerId)) {
            throw ApiException.notFound("글을 찾을 수 없어요.");
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
                    "일정을 읽지 못했어요.");
        }
    }

    /* ------------------------------------------------------------- 추천 */

    @Transactional
    public boolean like(AuthPrincipal me, String postId, boolean on) {
        TripPost post = read(postId, me.id());
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
        TripPost post = read(postId, me.id());
        JsonNode snap = snapshotOf(post);

        LocalDate start = DayLabels.parse(startIso);
        Trip trip = trips.save(Trip.builder()
                .title(snap.path("title").asText(post.getTitle()))
                .ownerId(me.id())
                .build());

        /* 가져간 사람 수 — 같은 사람이 또 가져가면 안 셉니다. 제 글을 제가
           가져가는 것도 안 셉니다. */
        if (!post.getAuthorId().equals(me.id()) && posts.markCopied(post.getId(), me.id()) > 0) {
            posts.addCopy(post.getId());
        }

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
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없어요."));
        if (!post.getAuthorId().equals(me.id())) {
            throw ApiException.forbidden("내 글만 고칠 수 있어요.");
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
                         String region, List<String> tags, Boolean feedback,
                         String coverPhotoId, Visibility visibility) {
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
        /*
          지역도 좌표에서 꼽습니다 — 올릴 때와 같은 규칙입니다.

          <p>목록에 없는 값이 들어오면 아무것도 안 걸리는 글이 되므로
          버리는데, 버린 자리를 비워 두면 고치기 전보다 못해집니다. 여행의
          첫 장소 좌표로 다시 꼽습니다.

          <p>그래서 「지역 없음」으로는 못 고칩니다. 고를 칸에 「그 밖」이
          있어서 괜찮습니다 — 비우고 싶은 사람이 바라는 것이 그것입니다.
          여행을 이미 지웠으면 좌표가 없어 비워집니다.
        */
        if (region != null) {
            String picked = known(region);
            post.setRegion(picked != null ? picked : regionOf(post.getTripId()));
        }
        if (tags != null) {
            post.setTags(cleanTags(tags));
        }
        if (feedback != null) {
            post.setFeedback(feedback);
        }
        if (coverPhotoId != null) {
            /* 빈 값은 표지 지우기입니다. */
            post.setCoverPhotoId(coverPhotoId.isBlank() ? null : myPhoto(me, coverPhotoId));
        }
        if (visibility != null) {
            post.setVisibility(visibility);
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
            throw ApiException.badRequest("일정을 읽지 못했어요.");
        }
        ArrayNode dayNodes = (ArrayNode) root.path("days");
        if (dayAt < 0 || dayAt >= dayNodes.size()) {
            throw ApiException.notFound("그런 날이 없어요.");
        }
        JsonNode day = dayNodes.get(dayAt);
        if (!day.path("places").isArray()) {
            throw ApiException.badRequest("일정을 읽지 못했어요.");
        }
        ArrayNode placeNodes = (ArrayNode) day.path("places");
        if (placeAt < 0 || placeAt >= placeNodes.size()) {
            throw ApiException.notFound("그런 장소가 없어요.");
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
            throw ApiException.badRequest("마지막 장소는 뺄 수 없어요. 글을 내려 주세요.");
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
            shiftStories(root, dayAt);
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
    /**
     * 날이 하나 빠졌을 때, 같이 실은 글이 가리키는 날을 옮깁니다.
     *
     * <p>댓글과 같은 일인데 사는 곳이 다릅니다 — 댓글은 표에 있고 이것은
     * 사본 안에 있습니다. 안 옮기면 셋째 날에 끼워 둔 사진이 넷째 날 밑에
     * 붙습니다.
     *
     * <p>빠진 그 날에 붙어 있던 글은 <b>안 지웁니다.</b> 일정 뒤로 내립니다 —
     * 장소를 하나 빼는 일 때문에 올린 사진이 통째로 사라지면 안 됩니다. 댓글은
     * 그 장소에 대한 말이라 같이 가지만, 이쪽은 그날 있었던 일입니다.
     */
    private static void shiftStories(JsonNode root, int dayAt) {
        if (!root.path("stories").isArray()) {
            return;
        }
        for (JsonNode s : root.path("stories")) {
            if (!s.isObject() || !s.hasNonNull("dayIndex")) {
                continue;
            }
            int at = s.path("dayIndex").asInt();
            if (at == dayAt) {
                ((ObjectNode) s).remove("dayIndex");
            } else if (at > dayAt) {
                ((ObjectNode) s).put("dayIndex", at - 1);
            }
        }
    }

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
                    "일정을 담지 못했어요.");
        }
    }

    /* --------------------------------------------------------- 내리기·신고 */

    @Transactional
    public void remove(AuthPrincipal me, String postId) {
        TripPost post = posts.findById(postId)
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없어요."));
        boolean mine = post.getAuthorId().equals(me.id());
        if (!mine && me.role() != Role.ADMIN) {
            throw ApiException.forbidden("내 글만 내릴 수 있어요.");
        }
        /* 댓글을 코드가 지웁니다. post_comments.post_id 는 이제 두 표를
           가리켜 외래키가 없습니다(CommentKind) — DB 가 안 데려갑니다. */
        comments.deleteAllByPostId(postId);
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
        TripPost post = read(postId, me.id());
        if (post.getAuthorId().equals(me.id())) {
            throw ApiException.badRequest("내 글은 신고할 수 없어요.");
        }
        if (reports.existsByPostIdAndUserId(postId, me.id())) {
            throw ApiException.badRequest("이미 신고한 글이에요.");
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
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없어요."));
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
                       boolean liked, java.time.Instant createdAt,
                       /** 표지 사진. 목록에서 이 글이 무엇인지 가장 빨리 말하는 것입니다. */
                       String coverPhotoId,
                       /**
                        * 표지를 안 골랐을 때 대신 세울 <b>이 글의 첫 사진</b>.
                        * 글에 사진이 한 장도 없으면 비어 있습니다.
                        *
                        * <p>{@code coverPhotoId} 가 있어도 늘 채웁니다. 표지가 있으면
                        * 화면이 이 값을 안 보지만, 「표지가 없을 때만 채우는 칸」으로
                        * 두면 비어 있다는 것이 <b>사진이 없다</b>인지 <b>표지가 있다</b>
                        * 인지 받는 쪽에서 구별할 수 없습니다.
                        */
                       String firstPhotoId,
                       /** 「내 여행으로 가져오기」 한 사람 수 · 모임 여행에서 나왔는지 */
                       int copyCount, boolean fromGroup) {
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
                    mine.contains(p.getId()), p.getCreatedAt(), p.getCoverPhotoId(),
                    firstPhotoOf(p),
                    p.getCopyCount(), p.isFromGroup()));
        }
        return out;
    }

    /**
     * 이 글의 첫 사진 — 표지를 안 골랐을 때 목록이 세울 것.
     *
     * <h3>어디서 꼽는가 — 사본입니다</h3>
     *
     * <p>고를 수 있던 자리가 셋이었습니다.
     *
     * <ul>
     *   <li>{@code placePhotos} 의 지금 모습 — <b>안 됩니다.</b> 거기 남은 것은
     *       「다니면서 볼 사진」이라 메뉴판·예매 QR 이 섞여 있습니다
     *       ({@link net.weeniebeenie.fit.trip.domain.PlacePhoto}). 공개 목록의
     *       표지 자리에 남의 예매 화면을 세우는 일이 됩니다.
     *   <li>{@code storyPhotos} 의 지금 모습 — <b>안 됩니다.</b> 글쓴이가 여행기에
     *       싣겠다고 고른 것만 공개인데, 그 표를 그대로 읽으면 안 고른 피드 사진까지
     *       걸립니다. 원본 여행이 지워진 옛 글은 걸 데조차 없습니다.
     *   <li><b>사본</b> — 이것입니다. 사본에 든 사진은 올릴 때 글쓴이가 하나씩 골라
     *       공개로 돌린 것이고, 읽는 사람이 글에서 실제로 보는 사진과 정확히 같은
     *       묶음입니다. 「이 여행의 첫 사진」이 뜻하는 것이 그것입니다.
     * </ul>
     *
     * <p>질의가 <b>하나도</b> 안 붙는다는 것이 덤입니다. 사본은 글 줄에 딸려
     * 이미 메모리에 있어서({@code trip_posts.snapshot}), 목록 한 쪽에 사진을
     * 채우는 값이 JSON 파싱 스물 번뿐입니다. 그 대신 그만큼의 구글 Static Maps
     * 호출이 사라집니다 — 바깥 왕복을 CPU 몇 밀리초로 바꾸는 셈입니다.
     *
     * <h3>차례는 글을 읽는 차례입니다</h3>
     *
     * <p>글은 날마다 「장소들 → 그 날에 걸린 피드 글」 순서로 그려지고, 날에 안
     * 걸린 글은 맨 뒤에 섭니다({@code community/[id].tsx}). 그 순서를 그대로
     * 훑어 처음 만나는 한 장을 냅니다. 화면이 보여 주는 첫 사진과 목록의 사진이
     * 같아야, 들어가 보고 "아까 그 사진이 어디 갔나" 가 안 됩니다.
     *
     * <p>사진이 없는 옛 글도 있습니다 — 장소 사진을 아예 안 담던 시절의 사본에는
     * {@code photos} 칸이 없습니다. 그때는 {@code null} 이고, 빈 자리를 가리킬
     * 번호를 억지로 지어내지 않습니다. 동선 그림이 그 자리를 맡습니다.
     *
     * @return 사진 번호, 또는 사진이 없거나 사본을 못 읽었으면 {@code null}
     */
    private String firstPhotoOf(TripPost post) {
        try {
            return firstPhotoIn(mapper.readTree(post.getSnapshot()));
        } catch (Exception e) {
            /* 목록 한 쪽이 사본 한 줄 때문에 통째로 깨지면 안 됩니다. 사진은
               있으면 좋은 것이고, 없으면 동선 그림이 섭니다 — 상세 화면은
               그대로 500 으로 답하니({@link #snapshotOf}) 고장이 묻히지도
               않습니다. */
            return null;
        }
    }

    /**
     * 사본 안을 읽는 차례대로 훑어 처음 만나는 사진.
     *
     * <p>{@link #firstPhotoOf(TripPost)} 와 나눠 둔 것은 차례를 그 자체로 짚을 수
     * 있게 하려는 것입니다. 「장소보다 글이 먼저냐」 같은 것은 눈으로 봐서는 알 수
     * 없고, 어긋나면 목록과 상세가 다른 사진을 보여 줍니다.
     */
    static String firstPhotoIn(JsonNode snap) {
        JsonNode stories = snap.path("stories");

        int at = 0;
        for (JsonNode day : snap.path("days")) {
            for (JsonNode place : day.path("places")) {
                String shot = firstOf(place.path("photos"));
                if (shot != null) {
                    return shot;
                }
            }
            String told = storyPhotoOn(stories, at);
            if (told != null) {
                return told;
            }
            at++;
        }
        /* 날에 안 걸린 글 — 글이 올라온 날이 올린 날들 가운데 없을 때입니다.
           글에서도 맨 뒤에 서므로 여기서도 맨 뒤입니다. */
        return storyPhotoOn(stories, null);
    }

    /**
     * 그 날에 걸린 피드 글의 첫 사진.
     *
     * @param on 몇째 날인지(0부터). {@code null} 이면 날에 안 걸린 글만 봅니다
     */
    private static String storyPhotoOn(JsonNode stories, Integer on) {
        for (JsonNode story : stories) {
            JsonNode which = story.path("dayIndex");
            boolean here = on == null ? !which.isInt() : which.isInt() && which.asInt() == on;
            if (!here) {
                continue;
            }
            String shot = firstOf(story.path("photos"));
            if (shot != null) {
                return shot;
            }
        }
        return null;
    }

    /**
     * 사진 번호 배열의 첫 값.
     *
     * <p>빈 글자를 걸러 냅니다. 받는 쪽은 번호를 그대로 주소에 붙이므로
     * ({@code /api/photos/…}), 빈 값이 가면 없는 사진을 부르는 호출이 됩니다.
     */
    private static String firstOf(JsonNode photos) {
        for (JsonNode id : photos) {
            if (id.isTextual() && !id.asText().isBlank()) {
                return id.asText();
            }
        }
        return null;
    }
}
