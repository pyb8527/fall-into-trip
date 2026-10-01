package net.weeniebeenie.fit.group.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.group.application.GroupInviteService;
import net.weeniebeenie.fit.group.domain.GroupInvite;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 모임에 부르는 링크.
 *
 * <p>미리보기만 로그인 없이 열립니다 — 링크를 받은 사람이 가입하기 전에
 * 무엇인지 봐야 합니다. 나머지는 멤버만 합니다.
 */
@RestController
@RequiredArgsConstructor
public class GroupInviteController {

    private final GroupInviteService invites;

    /** 멤버면 누구나 만듭니다. 토큰은 여기서 한 번만 나갑니다. */
    @PostMapping("/api/groups/{id}/invites")
    public Map<String, Object> create(@CurrentUser AuthPrincipal me,
                                      @PathVariable String id,
                                      @RequestBody(required = false) CreateRequest req) {
        GroupInviteService.NewInvite made = invites.create(me, id,
                req == null ? null : req.days(),
                req == null ? null : req.maxUses());
        return Map.of("invite", made);
    }

    /**
     * @param days    며칠 동안 쓸 수 있는지. 0 이면 기한 없음, 안 주면 7일
     * @param maxUses 몇 명이 쓸 수 있는지. 안 주면 한 명
     */
    public record CreateRequest(Integer days, Integer maxUses) {
    }

    @GetMapping("/api/groups/{id}/invites")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        List<Map<String, Object>> out = invites.listOf(me, id).stream()
                .map(i -> {
                    java.util.Map<String, Object> one = new java.util.HashMap<>();
                    one.put("id", i.getId());
                    one.put("expiresAt", i.getExpiresAt());
                    one.put("maxUses", i.getMaxUses());
                    one.put("usedCount", i.getUsedCount());
                    one.put("usable", i.usable(Instant.now()));
                    return one;
                })
                .toList();
        return Map.of("invites", out);
    }

    @DeleteMapping("/api/group-invites/{inviteId}")
    public Map<String, Object> revoke(@CurrentUser AuthPrincipal me, @PathVariable String inviteId) {
        invites.revoke(me, inviteId);
        return Map.of("ok", true);
    }

    /** 로그인 없이 열립니다. 무엇인지 보고 나서 가입을 정합니다. */
    @GetMapping("/api/group-invites/{token}/preview")
    public Map<String, Object> peek(@PathVariable String token) {
        return Map.of("invite", invites.peek(token));
    }

    @PostMapping("/api/group-invites/{token}/accept")
    public Map<String, Object> accept(@CurrentUser AuthPrincipal me, @PathVariable String token) {
        return Map.of("groupId", invites.accept(me, token));
    }
}
