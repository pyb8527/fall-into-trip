package net.weeniebeenie.fit.account.application;

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

        return new Profile(
                user.getId(),
                user.getName(),
                user.getMark(),
                user.getBio(),
                user.getCreatedAt(),
                mine,
                companionsOf(target),
                new Counts(
                        trips.countByOwnerId(target),
                        posts.countByAuthorId(target),
                        tips.countByUserIdAndHiddenFalseAndStarsIsNotNull(target),
                        members.countByIdUserId(target)));
    }

    /**
     * 이름과 한 줄 소개를 고칩니다. 늘 제 것만입니다.
     *
     * <p>{@code null} 인 칸은 그대로 둡니다. 소개를 지우는 것은 빈 글("")입니다.
     */
    @Transactional
    public Profile edit(AuthPrincipal me, String name, String bio) {
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
            user.setName(clean);
        }
        if (bio != null) {
            String clean = bio.strip();
            if (clean.length() > 80) {
                throw ApiException.badRequest("한 줄 소개는 80자까지예요.");
            }
            user.setBio(clean.isEmpty() ? null : clean);
        }
        return of(me, me.id());
    }

    /**
     * 함께한 사람 — 이 사람과 같은 모임에 든 사람 수(자기 빼고, 겹치면 한 번).
     *
     * <p>「2026년 9월부터」 대신 서는 기록입니다. 가입한 달은 그 사람에 대해
     * 아무것도 말하지 않지만, 몇 사람과 다녀 왔나는 이 앱에서의 그 사람입니다.
     */
    private long companionsOf(String userId) {
        Set<String> groups = new HashSet<>();
        for (GroupMember m : members.findAllByIdUserId(userId)) {
            groups.add(m.getId().getGroupId());
        }
        Set<String> people = new HashSet<>();
        for (String g : groups) {
            for (GroupMember m : members.findAllByIdGroupId(g)) {
                people.add(m.getId().getUserId());
            }
        }
        people.remove(userId);
        return people.size();
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
     * @param mark 골라 둔 표식. 안 골랐으면 비어 있고, 화면이 로고를 세웁니다
     * @param mine 내 것인지. 「내 계정」 줄을 붙일지를 이걸로 정합니다
     */
    public record Profile(String id, String name, String mark, String bio, Instant since,
                          boolean mine, long companions, Counts counts) {
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
