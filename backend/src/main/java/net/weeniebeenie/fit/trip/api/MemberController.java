package net.weeniebeenie.fit.trip.api;

import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.MemberService;
import net.weeniebeenie.fit.trip.domain.TripInvite;
import net.weeniebeenie.fit.trip.domain.TripRole;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 동행자와 초대.
 *
 * <p>이메일로 사람을 찾는 길은 열어 두지 않았습니다. 주인이 링크를 만들어
 * 보내고, 받은 사람이 눌러 들어옵니다.
 */
@RestController
@RequiredArgsConstructor
public class MemberController {

    private final MemberService members;

    @GetMapping("/api/trips/{tripId}/members")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        return Map.of("members", members.listOf(me, tripId));
    }

    /** 초대 링크 만들기. 토큰은 이때 한 번만 나옵니다. */
    @PostMapping("/api/trips/{tripId}/invites")
    public Map<String, Object> invite(@CurrentUser AuthPrincipal me,
                                      @PathVariable String tripId,
                                      @RequestBody(required = false) InviteRequest req) {
        InviteRequest r = req == null ? new InviteRequest(null, null, null) : req;
        MemberService.NewInvite invite = members.invite(me, tripId, r.role(), r.days(), r.maxUses());
        return Map.of("invite", invite);
    }

    @GetMapping("/api/trips/{tripId}/invites")
    public Map<String, Object> listInvites(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        List<InviteView> views = members.listInvites(me, tripId).stream()
                .map(InviteView::of)
                .toList();
        return Map.of("invites", views);
    }

    @DeleteMapping("/api/invites/{inviteId}")
    public Map<String, Object> revoke(@CurrentUser AuthPrincipal me, @PathVariable String inviteId) {
        members.revokeInvite(me, inviteId);
        return Map.of("ok", true);
    }

    /** 링크를 눌렀을 때 어떤 여행인지 먼저 보여 줍니다. */
    @GetMapping("/api/invites/{token}/preview")
    public Map<String, Object> preview(@PathVariable String token) {
        return Map.of("invite", members.peek(token));
    }

    @PostMapping("/api/invites/{token}/accept")
    public Map<String, Object> accept(@CurrentUser AuthPrincipal me, @PathVariable String token) {
        return Map.of("tripId", members.accept(me, token));
    }

    @DeleteMapping("/api/trips/{tripId}/members/{userId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me,
                                      @PathVariable String tripId,
                                      @PathVariable String userId) {
        members.remove(me, tripId, userId);
        return Map.of("ok", true);
    }

    @PostMapping("/api/trips/{tripId}/leave")
    public Map<String, Object> leave(@CurrentUser AuthPrincipal me, @PathVariable String tripId) {
        members.leave(me, tripId);
        return Map.of("ok", true);
    }

    /**
     * @param days 며칠 동안 쓸 수 있게 할지. 0 이면 기한을 두지 않고, 아예
     *             주지 않으면 기본 기한이 붙습니다.
     */
    public record InviteRequest(TripRole role, Integer days, Integer maxUses) {
    }

    /**
     * 목록에는 토큰을 싣지 않습니다. 만들 때 한 번 준 것이 전부입니다.
     *
     * <p>expiresAt 은 비어 있을 수 있습니다. 기한 없는 링크라는 뜻입니다.
     */
    public record InviteView(String id, TripRole role, Instant createdAt, Instant expiresAt,
                             int maxUses, int usedCount, boolean revoked) {

        static InviteView of(TripInvite i) {
            return new InviteView(i.getId(), i.getRole(), i.getCreatedAt(), i.getExpiresAt(),
                    i.getMaxUses(), i.getUsedCount(), i.getRevokedAt() != null);
        }
    }
}
