package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Ids;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.*;
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
 * 동행자 부르기.
 *
 * <p>이메일로 사람을 찾아 넣는 방식은 쓰지 않습니다. 그러면 아무나 로그인해서
 * 주소를 하나씩 넣어 보며 누가 가입했는지 알아낼 수 있습니다. 대신 주인이
 * 링크를 만들어 보내고, 받은 사람이 눌러 들어옵니다.
 */
@Service
@RequiredArgsConstructor
public class MemberService {

    private static final Duration DEFAULT_TTL = Duration.ofDays(7);
    private static final Duration MAX_TTL = Duration.ofDays(30);
    private static final int MAX_USES_LIMIT = 20;

    private final TripInviteRepository invites;
    private final TripMemberRepository members;
    private final TripRepository trips;
    private final UserRepository users;
    private final TripAccessPolicy access;
    private final AuditService audit;

    /** 이 여행의 동행자들. 볼 수 있는 사람이면 누구인지 압니다. */
    @Transactional(readOnly = true)
    public List<Companion> listOf(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());
        Trip trip = trips.findById(tripId).orElseThrow(() -> ApiException.notFound("여행을 찾을 수 없습니다."));

        return members.findAllByIdTripId(tripId).stream()
                .map(m -> users.findById(m.getUserId())
                        .map(u -> new Companion(u.getId(), u.getName(), u.getEmail(),
                                u.getMark(), m.getRole(),
                                u.getId().equals(trip.getOwnerId())))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .sorted(java.util.Comparator.comparing(Companion::owner).reversed()
                        .thenComparing(Companion::name))
                .toList();
    }

    /**
     * 초대 링크를 만듭니다. 만든 즉시 한 번만 원본을 돌려주고, 서버에는 해시만
     * 남습니다. 잃어버리면 새로 만들어야 합니다.
     */
    @Transactional
    public NewInvite invite(AuthPrincipal me, String tripId, TripRole role, Integer days, Integer maxUses) {
        Trip trip = access.requireOwner(tripId, me.id());

        /*
          days 를 0 으로 주면 기한을 두지 않습니다. 여행이 끝날 때까지 같은
          링크를 계속 쓰는 경우가 있어서입니다. 대신 계속 열려 있는 열쇠가
          되므로, 새어 나갔다 싶으면 취소로 닫아야 합니다.

          아예 안 주면(null) 예전처럼 기본 기한이 붙습니다.
        */
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
        TripInvite invite = invites.save(TripInvite.builder()
                .tripId(trip.getId())
                .tokenHash(sha256(raw))
                .role(role == null ? TripRole.EDITOR : role)
                .createdBy(me.id())
                .expiresAt(expiresAt)
                .maxUses(uses)
                .build());

        audit.log(me.id(), "invite.create", invite.getId(), Map.of("trip", trip.getId()));
        return new NewInvite(invite.getId(), raw, invite.getRole(), invite.getExpiresAt(), invite.getMaxUses());
    }

    /** 링크를 눌렀을 때 어떤 여행인지 미리 보여 줍니다. 아직 들어가지는 않습니다. */
    @Transactional(readOnly = true)
    public InvitePreview peek(String rawToken) {
        TripInvite invite = usable(rawToken);
        Trip trip = trips.findById(invite.getTripId())
                .orElseThrow(() -> ApiException.notFound("여행을 찾을 수 없습니다."));
        String ownerName = users.findById(trip.getOwnerId()).map(User::getName).orElse(null);
        return new InvitePreview(trip.getTitle(), ownerName, invite.getRole(), invite.getExpiresAt());
    }

    /** 링크로 여행에 들어갑니다. */
    @Transactional
    public String accept(AuthPrincipal me, String rawToken) {
        TripInvite invite = usable(rawToken);

        if (members.findByIdTripIdAndIdUserId(invite.getTripId(), me.id()).isPresent()) {
            /* 이미 들어와 있으면 링크를 쓰지 않고 그냥 통과시킵니다. */
            return invite.getTripId();
        }
        members.save(new TripMember(invite.getTripId(), me.id(), invite.getRole()));
        invite.use();

        audit.log(me.id(), "invite.accept", invite.getId(), Map.of("trip", invite.getTripId()));
        return invite.getTripId();
    }

    @Transactional(readOnly = true)
    public List<TripInvite> listInvites(AuthPrincipal me, String tripId) {
        access.requireOwner(tripId, me.id());
        return invites.findAllByTripIdOrderByCreatedAtDesc(tripId);
    }

    @Transactional
    public void revokeInvite(AuthPrincipal me, String inviteId) {
        TripInvite invite = invites.findById(inviteId)
                .orElseThrow(() -> ApiException.notFound("초대를 찾을 수 없습니다."));
        access.requireOwner(invite.getTripId(), me.id());
        invite.revoke();
        audit.log(me.id(), "invite.revoke", invite.getId());
    }

    /** 동행자를 내보냅니다. 주인은 내보낼 수 없습니다. */
    @Transactional
    public void remove(AuthPrincipal me, String tripId, String userId) {
        Trip trip = access.requireOwner(tripId, me.id());
        if (trip.getOwnerId().equals(userId)) {
            throw ApiException.badRequest("여행을 만든 사람은 내보낼 수 없습니다.");
        }
        members.findByIdTripIdAndIdUserId(tripId, userId)
                .orElseThrow(() -> ApiException.notFound("동행자가 아닙니다."));
        members.deleteByIdTripIdAndIdUserId(tripId, userId);
        audit.log(me.id(), "member.remove", userId, Map.of("trip", tripId));
    }

    /** 스스로 나갑니다. 주인은 나갈 수 없고, 여행을 지워야 합니다. */
    @Transactional
    public void leave(AuthPrincipal me, String tripId) {
        Trip trip = trips.findById(tripId)
                .orElseThrow(() -> ApiException.notFound("여행을 찾을 수 없습니다."));
        if (trip.getOwnerId().equals(me.id())) {
            throw ApiException.badRequest("여행을 만든 사람은 나갈 수 없습니다. 여행을 지워 주세요.");
        }
        access.requireCanRead(tripId, me.id());
        members.deleteByIdTripIdAndIdUserId(tripId, me.id());
        audit.log(me.id(), "member.leave", me.id(), Map.of("trip", tripId));
    }

    private TripInvite usable(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ApiException.notFound("초대 링크가 올바르지 않습니다.");
        }
        TripInvite invite = invites.findByTokenHash(sha256(rawToken))
                .orElseThrow(() -> ApiException.notFound("초대 링크가 올바르지 않습니다."));
        if (!invite.isUsable(Instant.now())) {
            throw ApiException.badRequest("만료되었거나 이미 다 쓴 초대 링크입니다.");
        }
        return invite;
    }

    private static String sha256(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("초대 토큰을 처리하지 못했습니다.", e);
        }
    }

    public record Companion(String id, String name, String email, String mark,
                            TripRole role, boolean owner) {
    }

    public record NewInvite(String id, String token, TripRole role, Instant expiresAt, int maxUses) {
    }

    public record InvitePreview(String tripTitle, String ownerName, TripRole role, Instant expiresAt) {
    }
}
