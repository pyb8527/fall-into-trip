package net.weeniebeenie.fit.account.infrastructure.security;

import net.weeniebeenie.fit.account.domain.Role;

/** 요청을 보낸 사람. 토큰에서 꺼낸 값만 담습니다. */
public record AuthPrincipal(String id, String email, String name, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
