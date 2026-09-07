package net.weeniebeenie.fit.admin.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 운영 화면에 들어온 사람이 지금도 운영자인지 다시 확인합니다.
 *
 * <p>SecurityConfig 는 액세스 토큰 안의 role 만 보고 통과시킵니다. 그런데
 * 토큰은 한 번 나가면 만료(기본 15분)까지 되돌릴 수 없습니다. 방금 권한을
 * 뺏겼거나 잠긴 계정이 그 15분 동안 계정 관리 화면을 계속 쓸 수 있다는
 * 뜻입니다.
 *
 * <p>운영 API 는 호출이 잦지 않으므로, 여기서만 DB 를 한 번 더 읽어 그
 * 틈을 막습니다. 일반 API 까지 이렇게 하면 요청마다 조회가 붙습니다.
 */
@Component
@RequiredArgsConstructor
public class AdminGuard {

    private final UserRepository users;

    @Transactional(readOnly = true)
    public User requireAdmin(AuthPrincipal me) {
        if (me == null) {
            throw ApiException.unauthorized("로그인이 필요합니다.");
        }
        User actor = users.findById(me.id())
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요합니다."));
        if (actor.isDisabled() || !actor.isAdmin()) {
            throw ApiException.forbidden("권한이 없습니다.");
        }
        return actor;
    }
}
