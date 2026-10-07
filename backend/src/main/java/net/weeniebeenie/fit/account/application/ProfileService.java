package net.weeniebeenie.fit.account.application;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.feed.domain.PostRepository;
import net.weeniebeenie.fit.group.domain.GroupMember;
import net.weeniebeenie.fit.group.domain.GroupMemberRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.tip.domain.PlaceTipRepository;
import net.weeniebeenie.fit.trip.domain.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

/**
 * 마이페이지가 묻는 것 — 이 사람이 어떤 여행을 해 왔나.
 *
 * <h3>내 것과 남의 것이 같은 화면입니다</h3>
 *
 * <p>화면(G-10)이 하나입니다. 내 것일 때만 「내 계정」 줄이 붙고, 나머지는
 * 같습니다. 그래서 길도 하나로 두고 <b>누구를 보는지</b>만 다르게 받습니다.
 *
 * <h3>남의 것은 같은 모임 사람에게만</h3>
 *
 * <p>모르는 사람의 여행 기록을 아무나 들여다볼 수 있으면 그것은 공개
 * 프로필입니다. 이 앱의 모임은 닫혀 있습니다 —
 * {@code docs/groups/verdict.md} 가 공개 그룹과 친구를 「안 한다」로 끝냈고,
 * 그 결로 프로필도 닫아 둡니다.
 *
 * <p>볼 수 없는 사람에게는 <b>404</b> 입니다. 403 을 주면 「그런 사람이
 * 있다」가 새어 나갑니다 — 권한은 한 문으로, 없는 것엔 404
 * ({@code TripAccessPolicy} 와 같은 규칙).
 */
@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository users;
    private final TripRepository trips;
    private final PostRepository posts;
    private final PlaceTipRepository tips;
    private final GroupMemberRepository members;
    private final net.weeniebeenie.fit.group.domain.GroupRepository groupBook;
    private final net.weeniebeenie.fit.trip.domain.DayRepository days;
    /* 얼굴 사진이 올린 사람의 것인지 보는 자리. */
    private final net.weeniebeenie.fit.photo.domain.PhotoRepository photos;
    /*
      바꿔 끼운 뒤에 옛 장을 지우는 자리.

      <p>표를 직접 건드리지 않고 이것을 거칩니다 — 올린 글에 실려 있으면
      파일을 두고 떼기만 하는 규칙이 그쪽에 있습니다.
    */
    private final net.weeniebeenie.fit.photo.application.PhotoService photoBook;
    /* 막은 사이면 소개 · 사진 · 우리 사이를 비웁니다. */
    private final net.weeniebeenie.fit.safety.application.BlockService blocks;
    /* 신고가 쌓였으면 소개와 사진을 남에게 감춥니다. */
    private final net.weeniebeenie.fit.safety.application.ProfileReportService reports;

    /**
     * 한 사람의 프로필.
     *
     * @param meId  보는 사람
     * @param whose 볼 사람. {@code meId} 와 같으면 내 것입니다
     */
    @Transactional(readOnly = true)
    public Profile of(AuthPrincipal me, String whose) {
        String target = whose == null || whose.isBlank() ? me.id() : whose;
        boolean mine = target.equals(me.id());

        if (!mine && !sharesGroup(me.id(), target)) {
            /* 「그런 사람이 없다」와 「볼 수 없다」를 같은 말로 둡니다. */
            throw ApiException.notFound("찾을 수 없어요.");
        }

        User user = users.findById(target)
                .orElseThrow(() -> ApiException.notFound("찾을 수 없어요."));

        if (mine) {
            return new Profile(
                    user.getId(), user.getName(), user.getMark(), user.getPhotoId(),
                    user.getBio(), user.getCreatedAt(), true,
                    companionsOf(target, groupsOf(target)),
                    new Counts(
                            trips.countByOwnerId(target),
                            posts.countByAuthorId(target),
                            tips.countByUserIdAndHiddenFalseAndStarsIsNotNull(target),
                            members.countByIdUserId(target)),
                    null, false);
        }

        /*
          막은 사이 — 이름과 표식만 둡니다.

          <p>404 로 닫지 않습니다. 막은 사람은 이 화면에서 「차단 풀기」를
          눌러야 하고, 막힌 사람에게 404 는 「모임에서 나갔다」와 구별이 안
          되지만 그 사람이 여전히 모임 사람 목록에 서 있으니 오히려 무언가
          일어났다는 말이 됩니다. 비어 보이는 프로필은 그냥 조용한 사람입니다.

          <p>{@code blocked} 는 <b>내가 막았을 때만</b> 켭니다. 막힌 쪽에 켜면
          그것이 곧 「당신은 막혔다」는 알림입니다.
        */
        if (blocks.between(me.id(), target)) {
            return new Profile(
                    user.getId(), user.getName(), user.getMark(), null, null,
                    user.getCreatedAt(), false, 0,
                    new Counts(0, 0, 0, 0),
                    new Between(List.of(), List.of()),
                    blocks.hasBlocked(me.id(), target));
        }

        /*
          신고가 쌓인 프로필 — 운영자가 볼 때까지 소개와 사진을 비웁니다.
          이름은 둡니다(ProfileReportService 의 설명). 내 것에는 이 일이 없습니다 —
          위에서 이미 돌아갔고, 제 소개를 고칠 수 있어야 합니다.
        */
        boolean held = reports.held(target);

        /*
          남의 페이지 — 숫자를 <b>함께 속한 모임</b> 안으로 좁힙니다.

          <p>「모임 n」이 그 사람의 전체 모임 수였습니다. 그러면 내가 안 든
          모임이 몇 개인지가 새어 나갑니다 — 여행 수도, 글 수도, 함께한 사람
          수도 같습니다. 그 사람이 다른 모임에서 한 일은 그 모임 사람의
          것입니다. 리뷰는 장소에 공개로 달리는 것이라 그대로 셉니다.
        */
        Set<String> shared = groupsOf(me.id());
        shared.retainAll(groupsOf(target));
        List<net.weeniebeenie.fit.trip.domain.Trip> ours = shared.isEmpty() ? List.of()
                : trips.findAllByGroupIdIn(new ArrayList<>(shared));

        long theirTrips = ours.stream().filter(t -> t.getOwnerId().equals(target)).count();
        long theirPosts = shared.isEmpty() ? 0
                : posts.ofAuthorIn(target, shared, "", org.springframework.data.domain.PageRequest.of(0, 1))
                        .getTotalElements();

        List<GroupRef> groupRefs = new ArrayList<>();
        groupBook.findAllById(shared).forEach(g -> groupRefs.add(new GroupRef(g.getId(), g.getName(), g.getEmoji())));

        /* 함께한 여행 — 함께 속한 모임의 여행. 다가오는 것과 지난 것 모두. */
        List<TripRef> tripRefs = ours.stream().map(t -> {
            var list = days.findAllByTripIdOrderBySortAsc(t.getId());
            return new TripRef(t.getId(), t.getTitle(),
                    list.isEmpty() ? null : list.get(0).getIso(),
                    list.isEmpty() ? null : list.get(list.size() - 1).getIso());
        }).sorted(Comparator.comparing((TripRef t) -> t.startIso() == null ? "" : t.startIso().toString()).reversed())
                .toList();

        return new Profile(
                user.getId(), user.getName(), user.getMark(), held ? null : user.getPhotoId(),
                held ? null : user.getBio(), user.getCreatedAt(), false,
                companionsOf(target, shared),
                new Counts(theirTrips, theirPosts,
                        tips.countByUserIdAndHiddenFalseAndStarsIsNotNull(target),
                        shared.size()),
                new Between(groupRefs, tripRefs), false);
    }

    /**
     * 이름·한 줄 소개·얼굴 사진을 고칩니다. 늘 제 것만입니다.
     *
     * <p>{@code null} 인 칸은 그대로 둡니다. 지우는 것은 빈 글("")입니다 —
     * 소개도, 얼굴 사진도 같습니다. 둘을 가르면 「안 보냈다」와 「비웠다」를
     * 구별할 길이 없어져서, 한 번 올린 사진을 뺄 수가 없습니다.
     */
    @Transactional
    public Profile edit(AuthPrincipal me, String name, String bio, String photoId) {
        User user = users.findById(me.id())
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요해요."));
        if (name != null) {
            String clean = name.trim();
            if (clean.isEmpty()) {
                throw ApiException.badRequest("이름이 비어 있어요.");
            }
            if (clean.length() > 80) {
                throw ApiException.badRequest("이름이 너무 길어요.");
            }
            /* 이름은 신고가 쌓여도 안 감춥니다(ProfileReportService) — 그러니
               올릴 때 막는 것이 유일한 자리입니다. */
            net.weeniebeenie.fit.support.moderation.BadWords.check(clean);
            user.setName(clean);
        }
        if (bio != null) {
            String clean = bio.strip();
            if (clean.length() > 80) {
                throw ApiException.badRequest("한 줄 소개는 80자까지예요.");
            }
            net.weeniebeenie.fit.support.moderation.BadWords.check(clean);
            user.setBio(clean.isEmpty() ? null : clean);
        }
        if (photoId != null) {
            setFace(me, user, photoId.trim());
        }
        return of(me, me.id());
    }

    /**
     * 얼굴 사진을 바꿔 끼웁니다.
     *
     * <h3>내 사진인지 봅니다</h3>
     *
     * <p>안 보면 <b>남의 사진 번호를 제 얼굴에 박아 넣을 수 있습니다.</b> 그러면
     * 그 사람이 가족 사진을 올린 것이 남의 프로필에 서고, 올린 사람은 그 일이
     * 일어난 것을 모릅니다. 번호는 열여섯 글자 난수라 찍어서 맞히기 어렵지만,
     * 어렵다는 것이 막았다는 뜻은 아닙니다 —
     * {@code FeedService.minePhotos} 와 같은 자리입니다.
     *
     * <p>없는 사진과 남의 사진에 <b>같은 말</b>을 돌려줍니다. 가르면 번호를
     * 하나씩 넣어 보는 것으로 「이 번호는 있는데 남의 것」을 알아낼 수 있고,
     * 그것이 곧 사진이 몇 장 올라가 있는지를 세는 길이 됩니다.
     *
     * <h3>바꿔 끼운 뒤에 옛 장을 지웁니다</h3>
     *
     * <p>얼굴 사진도 사람당 1000장을 함께 먹습니다(PhotoService 의
     * MAX_PER_USER). 얼굴은 바꾸는 것이라 그대로 두면 바꾼 횟수만큼 묵은 장이
     * 남습니다 — 스무 번 바꾼 사람이 스무 장을 먹습니다.
     *
     * <p><b>바꿔 끼운 다음에</b> 지웁니다. 고르는 자리에서 바로 지우면 판을
     * 저장 안 하고 닫은 사람의 얼굴이 깨집니다 — 사람은 아직 옛 장을
     * 가리키는데 그 장이 없어진 상태입니다.
     *
     * <p>지우는 일은 {@code PhotoService.drop} 에 맡깁니다 — 올린 글에 실려
     * 있으면 파일을 두고 떼기만 하는 규칙이 거기 있습니다. 여기서 직접
     * 지우면 그 규칙이 두 군데에 생기고, 한쪽만 고치는 날 남이 보던 여행기에
     * 깨진 자리가 납니다.
     *
     * <p><b>부르기 전에 그 장이 내 것인지 먼저 봅니다.</b> {@code drop} 은
     * 같은 트랜잭션에 들어오므로, 거기서 던진 예외를 여기서 받아 삼켜도
     * 스프링이 트랜잭션을 「되돌릴 것」으로 표시해 둡니다 — 그러면 프로필을
     * 고친 것까지 통째로 날아가고, 커밋할 때 엉뚱한 오류가 납니다. 던질
     * 자리를 미리 없애는 쪽이 맞습니다.
     *
     * @param face 새 사진 번호. 빈 글이면 얼굴을 뺍니다
     */
    private void setFace(AuthPrincipal me, User user, String face) {
        String was = user.getPhotoId();
        String now = face.isEmpty() ? null : face;

        if (now != null) {
            photos.findById(now)
                    .filter(p -> p.getOwnerId().equals(me.id()))
                    .orElseThrow(() -> ApiException.badRequest("그런 사진이 없어요."));
        }
        if (Objects.equals(was, now)) {
            /* 안 바뀌었습니다. 같은 번호를 다시 보낸 것으로 옛 장을 지우면
               방금 끼운 그 사진을 지웁니다. */
            return;
        }

        user.setPhotoId(now);

        /*
          옛 장이 아직 내 것으로 남아 있을 때만 지웁니다.

          <p>이미 보관함에서 지운 장이면 users.photo_id 가 그때 비워졌으므로
          (V55 의 ON DELETE SET NULL) 여기 올 일이 거의 없습니다. 그래도
          봅니다 — 없는 번호로 drop 을 부르면 그것이 위에 적은 「되돌릴
          것」 표시가 됩니다.
        */
        if (was != null && photos.findById(was).filter(p -> p.getOwnerId().equals(me.id())).isPresent()) {
            photoBook.drop(me, was);
        }
    }

    /**
     * 함께한 사람 — 이 사람과 같은 모임에 든 사람 수(자기 빼고, 겹치면 한 번).
     *
     * <p>「2026년 9월부터」 대신 서는 기록입니다. 가입한 달은 그 사람에 대해
     * 아무것도 말하지 않지만, 몇 사람과 다녀 왔나는 이 앱에서의 그 사람입니다.
     */
    private long companionsOf(String userId, Set<String> groups) {
        Set<String> people = new HashSet<>();
        for (String g : groups) {
            for (GroupMember m : members.findAllByIdGroupId(g)) {
                people.add(m.getId().getUserId());
            }
        }
        people.remove(userId);
        return people.size();
    }

    private Set<String> groupsOf(String userId) {
        Set<String> out = new HashSet<>();
        for (GroupMember m : members.findAllByIdUserId(userId)) {
            out.add(m.getId().getGroupId());
        }
        return out;
    }

    /**
     * 둘이 같은 모임에 있나.
     *
     * <p>모임 목록을 양쪽에서 받아 겹치는 것이 있는지만 봅니다. 사람이 든
     * 모임은 많아도 몇 개라, 질의 둘로 끝납니다.
     */
    private boolean sharesGroup(String meId, String other) {
        Set<String> mine = new HashSet<>();
        for (GroupMember m : members.findAllByIdUserId(meId)) {
            mine.add(m.getId().getGroupId());
        }
        if (mine.isEmpty()) {
            return false;
        }
        for (GroupMember m : members.findAllByIdUserId(other)) {
            if (mine.contains(m.getId().getGroupId())) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param mark    골라 둔 표식. 안 골랐으면 비어 있고, 화면이 로고를 세웁니다
     * @param photoId 올려 둔 얼굴 사진. 비어 있으면 {@code mark} 가 그 자리에
     *                섭니다. 표식을 대신하지 않습니다 — 지도의 핀은 계속
     *                표식입니다({@code User.photoId})
     * @param mine    내 것인지. 「내 계정」 줄을 붙일지를 이걸로 정합니다
     * @param blocked 내가 이 사람을 막았는지. 화면이 「차단」과 「차단 풀기」 중
     *                무엇을 세울지 여기서 정합니다. <b>나를 막은 사람이면 꺼져
     *                있습니다</b> — 켜면 그것이 곧 막혔다는 알림입니다
     */
    public record Profile(String id, String name, String mark, String photoId, String bio,
                          Instant since, boolean mine, long companions, Counts counts,
                          Between between, boolean blocked) {
    }

    /**
     * 우리 사이 — 남의 페이지에만 있습니다. 함께 속한 모임과 그 모임의 여행.
     */
    public record Between(List<GroupRef> groups, List<TripRef> trips) {
    }

    public record GroupRef(String id, String name, String emoji) {
    }

    public record TripRef(String id, String title, java.time.LocalDate startIso, java.time.LocalDate endIso) {
    }

    /**
     * 화면 위 숫자 칸.
     *
     * <p>「여행 7 · 글 23 · 리뷰 11 · 모임 3」입니다. 사진 수는 안 셉니다 —
     * 화면 시안에는 있지만, 그 수를 내려면 글마다 사진을 세야 하고 그것은
     * 숫자 하나를 띄우려고 치르는 값이 큽니다. 글 수가 이미 비슷한 말을
     * 합니다.
     *
     * @param trips  내가 만든 여행. 남이 만든 모임 여행은 안 셉니다
     * @param reviews 별점을 준 것만. 한 줄만 남긴 것은 리뷰로 안 셉니다
     */
    public record Counts(long trips, long posts, long reviews, long groups) {
    }
}
