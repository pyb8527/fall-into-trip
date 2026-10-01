package net.weeniebeenie.fit.group.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.group.domain.*;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.Trip;
import net.weeniebeenie.fit.trip.domain.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 모임.
 *
 * <h3>만드는 것이 가벼워야 합니다</h3>
 *
 * <p>사람을 부르는 길이 모임 하나입니다. 그래서 「이번 여행만 같이 짜는
 * 동료」에게도 모임을 만들어야 하고, 그러려면 이름 하나로 끝나야 합니다.
 *
 * <h3>자리는 둘뿐입니다</h3>
 *
 * <p>만든 사람과 그 밖의 모두. 운영진·부방장 같은 것은 안 둡니다 — 스무
 * 명짜리 모임에 결재선이 필요하지 않습니다.
 *
 * <p>초대는 <b>멤버도 만듭니다.</b> 모임에 사람을 부르는 것은 흔한 일이고,
 * 주인만 할 수 있게 하면 주인이 안 들어온 날에는 아무도 못 부릅니다.
 */
@Service
@RequiredArgsConstructor
public class GroupService {

    /**
     * 한 사람이 속할 수 있는 모임 수.
     *
     * <p>모임이 쉰을 넘기는 일은 없습니다. 넘으면 그것은 모임이 아니라 다른
     * 무엇입니다.
     */
    private static final int MAX_PER_USER = 50;

    /**
     * 한 모임의 사람 수.
     *
     * <p>넘으면 닫힌 모임이 아닙니다 — 백 명이 서로 아는 사이일 수 없습니다.
     */
    private static final int MAX_MEMBERS = 100;

    private final GroupRepository groups;
    private final GroupMemberRepository members;
    private final TripRepository trips;
    private final UserRepository users;
    private final AuditService audit;

    /* ------------------------------------------------------------- 만들기 */

    @Transactional
    public Group create(AuthPrincipal me, String name, String about, String emoji) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("모임 이름을 적어 주세요.");
        }
        if (clean.length() > 40) {
            throw ApiException.badRequest("모임 이름이 너무 길어요. 40자 아래로 적어 주세요.");
        }
        if (members.countByIdUserId(me.id()) >= MAX_PER_USER) {
            throw ApiException.badRequest("속할 수 있는 모임 수를 넘었어요.");
        }

        Group made = groups.save(new Group(clean, me.id()));
        made.setAbout(trimmed(about, 200));
        made.setEmoji(trimmed(emoji, 8));
        members.save(new GroupMember(made.getId(), me.id(), GroupRole.OWNER));

        audit.log(me.id(), "group.create", made.getId());
        return made;
    }

    /* --------------------------------------------------------------- 읽기 */

    /** 내가 속한 모임들. */
    @Transactional(readOnly = true)
    public List<Group> mine(AuthPrincipal me) {
        return groups.findAllOfUser(me.id());
    }

    /** 멤버만 볼 수 있습니다. 아니면 404 — 있다는 사실도 안 알려 줍니다. */
    @Transactional(readOnly = true)
    public Group read(AuthPrincipal me, String groupId) {
        requireMember(groupId, me.id());
        return groups.findById(groupId)
                .orElseThrow(() -> ApiException.notFound("모임을 찾을 수 없어요."));
    }

    /** 이 모임의 사람들. 주인이 맨 앞입니다. */
    @Transactional(readOnly = true)
    public List<Mate> peopleOf(AuthPrincipal me, String groupId) {
        requireMember(groupId, me.id());
        return members.findAllByIdGroupId(groupId).stream()
                .map(m -> {
                    User u = users.findById(m.getId().getUserId()).orElse(null);
                    return new Mate(
                            m.getId().getUserId(),
                            u == null ? "알 수 없음" : u.getName(),
                            u == null ? null : u.getMark(),
                            m.getRole(),
                            m.getRole() == GroupRole.OWNER);
                })
                .sorted((a, b) -> Boolean.compare(b.owner(), a.owner()))
                .toList();
    }

    /** 이 모임의 여행들. 최근 것부터. */
    @Transactional(readOnly = true)
    public List<Trip> tripsOf(AuthPrincipal me, String groupId) {
        requireMember(groupId, me.id());
        return trips.findAllByGroupIdIn(List.of(groupId));
    }

    /* --------------------------------------------------------------- 고치기 */

    @Transactional
    public Group update(AuthPrincipal me, String groupId, String name, String about,
                        String emoji, String coverPhotoId) {
        Group group = requireOwner(groupId, me.id());
        if (name != null) {
            String clean = name.trim();
            if (clean.isEmpty() || clean.length() > 40) {
                throw ApiException.badRequest("모임 이름은 1자에서 40자까지예요.");
            }
            group.setName(clean);
        }
        if (about != null) {
            group.setAbout(trimmed(about, 200));
        }
        if (emoji != null) {
            group.setEmoji(trimmed(emoji, 8));
        }
        if (coverPhotoId != null) {
            group.setCoverPhotoId(coverPhotoId.isBlank() ? null : coverPhotoId);
        }
        return group;
    }

    /**
     * 모임을 지웁니다.
     *
     * <p><b>여행은 안 지웁니다.</b> 그룹에서 떼기만 하고 만든 사람의 혼자
     * 여행으로 남습니다 — 방을 정리하려다 지난 여행이 통째로 사라지면 안
     * 됩니다.
     */
    @Transactional
    public void delete(AuthPrincipal me, String groupId) {
        requireOwner(groupId, me.id());
        trips.findAllByGroupIdIn(List.of(groupId)).forEach(t -> t.setGroupId(null));
        groups.deleteById(groupId);
        audit.log(me.id(), "group.delete", groupId);
    }

    /* ------------------------------------------------------------- 사람들 */

    /**
     * 나갑니다.
     *
     * <p>주인은 못 나갑니다 — 먼저 넘기거나 모임을 지워야 합니다. 주인 없는
     * 모임이 남으면 아무도 이름을 고치거나 지울 수 없습니다.
     *
     * <p>나가면 그 모임의 여행이 안 보이게 됩니다. 내가 만든 여행은 내
     * 것이라 그대로 보입니다.
     */
    @Transactional
    public void leave(AuthPrincipal me, String groupId) {
        GroupMember mine = requireMember(groupId, me.id());
        if (mine.getRole() == GroupRole.OWNER) {
            throw ApiException.badRequest("모임을 만든 사람은 먼저 주인을 넘기거나 모임을 지워야 해요.");
        }
        members.deleteByIdGroupIdAndIdUserId(groupId, me.id());
        audit.log(me.id(), "group.leave", groupId);
    }

    /** 내보냅니다. 주인만 할 수 있고, 제 자신은 못 내보냅니다. */
    @Transactional
    public void remove(AuthPrincipal me, String groupId, String userId) {
        requireOwner(groupId, me.id());
        if (me.id().equals(userId)) {
            throw ApiException.badRequest("스스로를 내보낼 수는 없어요.");
        }
        requireMember(groupId, userId);
        members.deleteByIdGroupIdAndIdUserId(groupId, userId);
        audit.log(me.id(), "group.remove", groupId, Map.of("user", userId));
    }

    /** 주인을 넘깁니다. 받는 사람은 이미 멤버여야 합니다. */
    @Transactional
    public void handOver(AuthPrincipal me, String groupId, String userId) {
        Group group = requireOwner(groupId, me.id());
        GroupMember next = requireMember(groupId, userId);

        GroupMember was = requireMember(groupId, me.id());
        was.setRole(GroupRole.MEMBER);
        next.setRole(GroupRole.OWNER);
        group.setOwnerId(userId);

        audit.log(me.id(), "group.handover", groupId, Map.of("to", userId));
    }

    /* ---------------------------------------------------------------- 울타리 */

    public GroupMember requireMember(String groupId, String userId) {
        return members.findByIdGroupIdAndIdUserId(groupId, userId)
                .orElseThrow(() -> ApiException.notFound("모임을 찾을 수 없어요."));
    }

    public Group requireOwner(String groupId, String userId) {
        GroupMember mine = requireMember(groupId, userId);
        if (mine.getRole() != GroupRole.OWNER) {
            throw ApiException.forbidden("모임을 만든 사람만 할 수 있어요.");
        }
        return groups.findById(groupId)
                .orElseThrow(() -> ApiException.notFound("모임을 찾을 수 없어요."));
    }

    /** 사람이 더 들어올 자리가 있는지. 초대를 받을 때 봅니다. */
    public void requireRoom(String groupId) {
        if (members.countByIdGroupId(groupId) >= MAX_MEMBERS) {
            throw ApiException.badRequest("이 모임은 자리가 다 찼어요.");
        }
    }

    private static String trimmed(String raw, int max) {
        if (raw == null) {
            return null;
        }
        String clean = raw.trim();
        if (clean.isEmpty()) {
            return null;
        }
        return clean.length() > max ? clean.substring(0, max) : clean;
    }

    public record Mate(String id, String name, String mark, GroupRole role, boolean owner) {
    }
}
