package net.weeniebeenie.fit.group.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.group.domain.*;
import net.weeniebeenie.fit.safety.application.BlockService;
import net.weeniebeenie.fit.shared.domain.Ids;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * 모임에 부르는 링크.
 *
 * <p>여행 초대를 그대로 옮긴 것입니다. 토큰은 만들 때 한 번만 내보내고
 * 서버에는 해시만 남습니다 — 저장소를 들여다본 사람이 링크를 그대로 들고
 * 나갈 수 없습니다. 잃어버리면 새로 만듭니다.
 *
 * <p>미리보기는 <b>로그인 없이</b> 열립니다. 링크를 받은 사람이 가입하기
 * 전에 무엇인지 봐야 합니다.
 */
@Service
@RequiredArgsConstructor
public class GroupInviteService {

    private static final Duration DEFAULT_TTL = Duration.ofDays(7);
    private static final Duration MAX_TTL = Duration.ofDays(30);
    private static final int MAX_USES_LIMIT = 20;

    private final GroupInviteRepository invites;
    private final GroupMemberRepository members;
    private final GroupRepository groups;
    private final UserRepository users;
    private final GroupService service;
    private final AuditService audit;
    /* 링크를 만든 사람이 나를 막았으면 그 링크로는 못 들어옵니다. */
    private final BlockService blocks;

    /**
     * 링크를 만듭니다.
     *
     * <p><b>멤버면 누구나</b> 만듭니다. 주인만 할 수 있게 하면 주인이 안
     * 들어온 날에는 아무도 못 부릅니다.
     */
    @Transactional
    public NewInvite create(AuthPrincipal me, String groupId, Integer days, Integer maxUses) {
        service.requireMember(groupId, me.id());

        /* days 를 0 으로 주면 기한을 두지 않습니다. 대신 계속 열려 있는
           열쇠가 되므로, 새어 나갔다 싶으면 취소로 닫아야 합니다. */
        Instant expiresAt = null;
        if (days == null || days > 0) {
            Duration ttl = days == null ? DEFAULT_TTL : Duration.ofDays(days);
            if (ttl.compareTo(MAX_TTL) > 0) {
                ttl = MAX_TTL;
            }
            expiresAt = Instant.now().plus(ttl);
        }
        int uses = maxUses == null ? 1 : Math.max(1, Math.min(MAX_USES_LIMIT, maxUses));

        String raw = Ids.secret();
        GroupInvite invite = invites.save(GroupInvite.builder()
                .groupId(groupId)
                .tokenHash(sha256(raw))
                .createdBy(me.id())
                .expiresAt(expiresAt)
                .maxUses(uses)
                .build());

        audit.log(me.id(), "group.invite.create", invite.getId(), Map.of("group", groupId));
        return new NewInvite(invite.getId(), raw, invite.getExpiresAt(), invite.getMaxUses());
    }

    /** 링크를 눌렀을 때 어떤 모임인지. 아직 들어가지는 않습니다. */
    @Transactional(readOnly = true)
    public Preview peek(String rawToken) {
        GroupInvite invite = usable(rawToken);
        Group group = groups.findById(invite.getGroupId())
                .orElseThrow(() -> ApiException.notFound("모임을 찾을 수 없어요."));

        List<String> names = members.findAllByIdGroupId(group.getId()).stream()
                .map(m -> users.findById(m.getId().getUserId()).map(User::getName).orElse(null))
                .filter(n -> n != null)
                .limit(5)
                .toList();

        return new Preview(
                group.getName(),
                group.getAbout(),
                group.getEmoji(),
                names,
                (int) members.countByIdGroupId(group.getId()),
                invite.getExpiresAt());
    }

    /** 링크로 들어갑니다. */
    @Transactional
    public String accept(AuthPrincipal me, String rawToken) {
        GroupInvite invite = usable(rawToken);

        /* 이미 들어와 있으면 링크를 쓰지 않고 그냥 통과시킵니다. 두 번 눌렀다고
           남의 몫이 하나 줄어들 이유가 없습니다. */
        if (members.findByIdGroupIdAndIdUserId(invite.getGroupId(), me.id()).isPresent()) {
            return invite.getGroupId();
        }

        /*
          링크를 만든 사람이 나를 막았으면 들어오지 못합니다.

          <p>링크는 건네지는 것이라 막힌 사람 손에 들어갈 수 있습니다 — 단톡방에
          올린 링크가 그렇습니다. 막은 사람이 그 모임에서 다시 마주치지 않게
          여기서 돌려보냅니다.

          <p>말은 「막혔다」고 하지 않습니다. 조용히 막는 것이 약속이라
          (BlockService), 링크가 안 맞는다는 말만 하고 다른 사람에게 받아
          보라고 합니다. 모임의 다른 사람이 만든 링크는 막지 않습니다 — 그
          사람은 막지 않았습니다.

          <p>이미 든 사람은 위에서 지나갔습니다. 함께 쓰던 모임과 여행은 막은
          뒤에도 그대로입니다.
        */
        if (blocks.hasBlocked(invite.getCreatedBy(), me.id())) {
            throw ApiException.forbidden("이 링크로는 들어갈 수 없어요. 모임의 다른 사람에게 링크를 받아 주세요.");
        }

        service.requireRoom(invite.getGroupId());
        members.save(new GroupMember(invite.getGroupId(), me.id(), GroupRole.MEMBER));
        invite.setUsedCount(invite.getUsedCount() + 1);

        audit.log(me.id(), "group.invite.accept", invite.getId(),
                Map.of("group", invite.getGroupId()));
        return invite.getGroupId();
    }

    @Transactional(readOnly = true)
    public List<GroupInvite> listOf(AuthPrincipal me, String groupId) {
        service.requireMember(groupId, me.id());
        return invites.findAllByGroupIdOrderByCreatedAtDesc(groupId);
    }

    /** 잘못 보낸 링크를 막습니다. 만든 사람이나 모임 주인이 할 수 있습니다. */
    @Transactional
    public void revoke(AuthPrincipal me, String inviteId) {
        GroupInvite invite = invites.findById(inviteId)
                .orElseThrow(() -> ApiException.notFound("초대를 찾을 수 없어요."));
        GroupMember mine = service.requireMember(invite.getGroupId(), me.id());
        if (!invite.getCreatedBy().equals(me.id()) && mine.getRole() != GroupRole.OWNER) {
            throw ApiException.forbidden("이 초대를 막을 권한이 없어요.");
        }
        invite.setRevokedAt(Instant.now());
        audit.log(me.id(), "group.invite.revoke", inviteId);
    }

    private GroupInvite usable(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ApiException.notFound("초대를 찾을 수 없어요.");
        }
        GroupInvite invite = invites.findByTokenHash(sha256(rawToken))
                .orElseThrow(() -> ApiException.notFound("초대를 찾을 수 없어요."));
        if (!invite.usable(Instant.now())) {
            throw ApiException.badRequest("이 링크는 더 쓸 수 없어요. 모임에 있는 사람에게 새로 받아 주세요.");
        }
        return invite;
    }

    private static String sha256(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("초대 토큰을 처리하지 못했어요.", e);
        }
    }

    public record NewInvite(String id, String token, Instant expiresAt, int maxUses) {
    }

    /**
     * 링크를 받은 사람이 보는 것.
     *
     * <p>누가 있는지와 몇 명인지를 냅니다 — 「아는 이름」이 하나라도 있으면
     * 들어갈지를 바로 정할 수 있습니다.
     */
    public record Preview(String name, String about, String emoji,
                          List<String> someNames, int memberCount, Instant expiresAt) {
    }
}
