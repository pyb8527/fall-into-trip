package net.weeniebeenie.fit.admin.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.AdminUserView;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.DisabledRequest;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.PageView;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.PasswordResetRequest;
import net.weeniebeenie.fit.admin.api.dto.AdminDtos.RoleRequest;
import net.weeniebeenie.fit.admin.application.AdminUserService;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.function.Function;

/**
 * 운영자용 계정 관리.
 *
 * <p>{@code /api/admin/**} 는 SecurityConfig 에서 이미 ADMIN 만 통과합니다.
 * 그래도 서비스 계층에서 한 번 더 확인합니다. 토큰은 발급된 뒤 만료까지
 * 되돌릴 수 없어서, 방금 권한을 잃은 사람이 잠깐 남아 있을 수 있습니다.
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService admins;

    @GetMapping
    public PageView<AdminUserView> list(@CurrentUser AuthPrincipal me,
                                        @RequestParam(name = "q", required = false) String q,
                                        @RequestParam(name = "role", required = false) String role,
                                        @RequestParam(name = "disabled", required = false) Boolean disabled,
                                        @RequestParam(name = "page", defaultValue = "0") int page,
                                        @RequestParam(name = "size", defaultValue = "20") int size) {

        Page<AdminUserView> found = admins.search(me, q, parseRole(role), disabled,
                PageRequest.of(Math.max(page, 0), AdminPaging.size(size),
                        Sort.by(Sort.Direction.DESC, "createdAt")));

        return PageView.of(found, Function.identity());
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return Map.of("user", admins.detail(me, id));
    }

    @PatchMapping("/{id}/role")
    public Map<String, Object> changeRole(@CurrentUser AuthPrincipal me,
                                          @PathVariable String id,
                                          @Valid @RequestBody RoleRequest req) {
        return Map.of("user", admins.changeRole(me, id, req.role()));
    }

    /** 잠그면 로그인도, 이미 열려 있던 세션도 함께 막힙니다. */
    @PatchMapping("/{id}/disabled")
    public Map<String, Object> setDisabled(@CurrentUser AuthPrincipal me,
                                           @PathVariable String id,
                                           @Valid @RequestBody DisabledRequest req) {
        return Map.of("user", admins.setDisabled(me, id, req.disabled()));
    }

    /** 임시 비밀번호를 넣어 줍니다. 본인은 받은 뒤 스스로 다시 바꿔야 합니다. */
    @PostMapping("/{id}/password")
    public Map<String, Object> resetPassword(@CurrentUser AuthPrincipal me,
                                             @PathVariable String id,
                                             @Valid @RequestBody PasswordResetRequest req) {
        admins.resetPassword(me, id, req.password());
        return Map.of("ok", true);
    }

    @PostMapping("/{id}/logout")
    public Map<String, Object> forceLogout(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return Map.of("ok", true, "revoked", admins.forceLogout(me, id));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        admins.delete(me, id);
        return Map.of("ok", true);
    }

    private static Role parseRole(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Role.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("알 수 없는 역할입니다: " + raw);
        }
    }
}
