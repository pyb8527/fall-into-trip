package net.weeniebeenie.fit.news.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.TripMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 내가 없는 동안 무엇이 바뀌었나.
 *
 * <h3>쌓지 않고 읽습니다</h3>
 *
 * <p>소식을 따로 저장하지 않습니다. 일이 벌어지는 자리마다 "소식 한 줄을
 * 남겨라" 를 심으면, 심는 것을 빠뜨린 자리가 조용히 안 보이게 됩니다.
 * 여기서는 이미 저장되고 있는 시각들을 읽을 때 모읍니다 — 빠뜨릴 자리가
 * 없습니다.
 *
 * <p>대신 느려질 수 있습니다. 여행 다섯에 장소 수백이면 질의 다섯이
 * 무거워집니다. 그때는 벌어지는 자리에서 쌓는 쪽으로 옮깁니다 — 그 문장을
 * 만드는 코드가 이미 {@code PlaceService.announce} 에 있습니다.
 *
 * <h3>한 곳에서 온 것은 한 줄입니다</h3>
 *
 * <p>추천 하나를 소식 한 줄로 올리면, 글 하나가 좀 받은 날 목록이 그것만으로
 * 찹니다. 서른 줄이 전부 "추천했습니다" 가 되고 동행자가 고친 일정은 그
 * 아래로 밀려납니다. 소식함은 <b>내가 없는 동안 무엇이 바뀌었나</b>를 보는
 * 자리이지 인기를 세는 자리가 아닙니다.
 *
 * <p>그래서 추천·댓글·표는 글마다·후보마다 접습니다. 한 사람이면 이름을
 * 붙이고, 여럿이면 몇 사람인지만 적습니다 — 누구누구인지는 들어가서 볼
 * 일입니다.
 *
 * <h3>내가 한 일은 안 담습니다</h3>
 *
 * <p>다섯 질의가 전부 "나 말고" 로 좁힙니다. 내가 방금 넣은 장소가 소식으로
 * 돌아오면 목록이 내 발자국으로 찹니다. 푸시도 같은 규칙입니다.
 */
@Service
@RequiredArgsConstructor
public class NewsService {

    /**
     * 얼마나 거슬러 보는가.
     *
     * <p>마지막으로 본 시각이 아닙니다. 열어 본 뒤에 어제 것이 사라지면
     * "아까 그게 뭐였더라" 를 할 수 없습니다. 본 시각은 점을 찍을지만
     * 정합니다.
     */
    private static final Duration WINDOW = Duration.ofDays(30);

    /** 한 화면에 올릴 최대. 근거 없이 고른 수입니다 — 붙여 놓고 봅니다. */
    private static final int LIMIT = 30;

    private final NewsFeed feed;
    private final TripMemberRepository members;
    private final UserRepository users;

    /**
     * 소식 한 줄.
     *
     * <p>{@code tripId} 와 {@code postId} 는 <b>둘 중 하나만</b> 찹니다.
     * 여행에서 벌어진 일과 내 글에서 벌어진 일은 갈 곳이 다릅니다.
     *
     * <p>{@code actorName} 은 <b>비어 있을 수 있습니다.</b> 여럿이 한 줄로
     * 접힌 것이고, 그때는 몇 사람인지가 {@code text} 안에 들어 있습니다.
     */
    public record Item(Instant at, String kind, String actorName,
                       String tripId, String tripTitle,
                       String postId, String postTitle,
                       String text, String url, boolean fresh) {}

    public record View(List<Item> items, long unseen, Instant seenAt) {}

    @Transactional(readOnly = true)
    public View of(AuthPrincipal me) {
        Instant since = Instant.now().minus(WINDOW);
        Instant seenAt = users.findById(me.id()).map(User::getNewsSeenAt).orElse(null);

        List<String> tripIds = members.findAllByIdUserId(me.id()).stream()
                .map(m -> m.getId().getTripId())
                .toList();

        List<Item> rows = new ArrayList<>();
        for (PlaceRow r : feed.places(tripIds, me.id(), since, LIMIT)) {
            /* 넣은 것과 고친 것. 아직 아무도 안 고쳤으면 두 시각이 같습니다.
               푸시가 그 순간에 쓰는 말과 맞춥니다. */
            boolean born = !r.at().isAfter(r.bornAt());
            rows.add(inTrip(r.at(), born ? "place.add" : "place.edit", r.actorId(),
                    r.tripId(), r.tripTitle(),
                    born ? r.dayLabel() + "에 " + quoted(r.name()) + " 를 넣었습니다."
                         : quoted(r.name()) + " 를 고쳤습니다."));
        }
        for (CandidateRow r : feed.candidates(tripIds, me.id(), since, LIMIT)) {
            rows.add(inTrip(r.at(), "candidate.add", r.actorId(), r.tripId(), r.tripTitle(),
                    quoted(r.name()) + " 를 후보로 올렸습니다."));
        }
        for (VoteAggRow r : feed.votes(tripIds, me.id(), since, LIMIT)) {
            /* 한 사람이면 좋다·아니라를 그대로 말합니다. 여럿이면 갈렸을 수
               있어 "답했습니다" 로 둡니다 — 어느 쪽인지는 투표장이 보여
               줍니다. */
            boolean one = r.people() == 1;
            rows.add(inTrip(r.at(), "candidate.vote", one ? r.actorId() : null,
                    r.tripId(), r.tripTitle(),
                    one ? quoted(r.name()) + " 에 " + (r.yes() == 1 ? "좋다고" : "아니라고") + " 했습니다."
                        : quoted(r.name()) + " 에 " + r.people() + "명이 답했습니다."));
        }
        for (PostAggRow r : feed.likes(me.id(), since, LIMIT)) {
            boolean one = r.people() == 1;
            rows.add(inPost(r.at(), "post.like", one ? r.actorId() : null,
                    r.postId(), r.postTitle(),
                    one ? quoted(r.postTitle()) + " 를 추천했습니다."
                        : quoted(r.postTitle()) + " 를 " + r.people() + "명이 추천했습니다."));
        }
        for (PostAggRow r : feed.comments(me.id(), since, LIMIT)) {
            boolean one = r.people() == 1;
            rows.add(inPost(r.at(), "post.comment", one ? r.actorId() : null,
                    r.postId(), r.postTitle(),
                    one ? quoted(r.postTitle()) + " 에 댓글을 남겼습니다."
                        : quoted(r.postTitle()) + " 에 " + r.people() + "명이 댓글을 남겼습니다."));
        }

        rows.sort(Comparator.comparing(Item::at).reversed());
        List<Item> items = named(rows.size() > LIMIT ? rows.subList(0, LIMIT) : rows);

        /* 본 시각보다 나중 것이 새것입니다. 한 번도 안 열었으면 전부입니다. */
        long unseen = items.stream().filter(i -> isFresh(i, seenAt)).count();
        return new View(
                items.stream().map(i -> isFresh(i, seenAt) ? withFresh(i) : i).toList(),
                unseen, seenAt);
    }

    /**
     * 봤다고 표시합니다.
     *
     * <p>목록은 그대로 둡니다. 여기서 지우는 것은 점 하나뿐입니다.
     */
    @Transactional
    public Instant seen(AuthPrincipal me) {
        User user = users.findById(me.id())
                .orElseThrow(() -> ApiException.notFound("계정을 찾을 수 없습니다."));
        Instant now = Instant.now();
        user.setNewsSeenAt(now);
        return now;
    }

    private static boolean isFresh(Item item, Instant seenAt) {
        return seenAt == null || item.at().isAfter(seenAt);
    }

    /** 이름을 낫표로 감쌉니다. 푸시가 쓰는 모양 그대로입니다. */
    private static String quoted(String name) {
        return "「" + name + "」";
    }

    private static Item inTrip(Instant at, String kind, String actorId,
                               String tripId, String tripTitle, String text) {
        return new Item(at, kind, actorId, tripId, tripTitle, null, null,
                text, "/trip/" + tripId, false);
    }

    private static Item inPost(Instant at, String kind, String actorId,
                               String postId, String postTitle, String text) {
        return new Item(at, kind, actorId, null, null, postId, postTitle,
                text, "/community/" + postId, false);
    }

    private static Item withFresh(Item i) {
        return new Item(i.at(), i.kind(), i.actorName(), i.tripId(), i.tripTitle(),
                i.postId(), i.postTitle(), i.text(), i.url(), true);
    }

    /**
     * 번호 자리에 이름을 넣습니다.
     *
     * <p>여기까지 {@code actorName} 칸에는 사용자 번호가 들어 있습니다.
     * 목록을 자른 <b>뒤에</b> 한 번에 찾습니다 — 줄마다 찾으면 같은 사람을
     * 서른 번 찾고, 자르기 전에 찾으면 버릴 줄까지 찾습니다.
     *
     * <p>지워진 사람은 "누군가" 입니다. 번호를 그대로 내보내면 화면에 뜻
     * 모를 열두 글자가 뜹니다.
     *
     * <p><b>비어 있으면 비운 채로 둡니다.</b> 여럿이 한 줄로 접힌 것이고,
     * 그 줄은 문장 안에 몇 사람인지를 이미 담고 있습니다. 여기서 "누군가" 를
     * 채우면 셋이 한 사람으로 보입니다.
     */
    private List<Item> named(List<Item> items) {
        Set<String> ids = items.stream()
                .map(Item::actorName)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));
        Map<String, String> names = users.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getName, (a, b) -> a));
        return items.stream()
                .map(i -> new Item(i.at(), i.kind(),
                        i.actorName() == null ? null : names.getOrDefault(i.actorName(), "누군가"),
                        i.tripId(), i.tripTitle(), i.postId(), i.postTitle(),
                        i.text(), i.url(), i.fresh()))
                .toList();
    }
}
