package net.weeniebeenie.fit.account.infrastructure.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authorization: Bearer &lt;access token&gt; 를 읽어 인증을 채웁니다.
 *
 * 토큰이 없거나 틀려도 여기서 막지 않고 그냥 비워 둡니다. 접근 거부는
 * SecurityConfig 의 규칙과 메서드 단위 권한 검사가 담당합니다.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIX = "Bearer ";

    private final JwtProvider jwt;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(PREFIX)) {
            Claims claims = jwt.parse(header.substring(PREFIX.length()).trim());
            if (claims != null) {
                Role role = parseRole(claims.get("role", String.class));
                AuthPrincipal principal = new AuthPrincipal(
                        claims.getSubject(),
                        claims.get("email", String.class),
                        claims.get("name", String.class),
                        role);
                var auth = new UsernamePasswordAuthenticationToken(
                        principal, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
                auth.setDetails(request.getRemoteAddr());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }

    private static Role parseRole(String raw) {
        try {
            return Role.valueOf(raw);
        } catch (IllegalArgumentException | NullPointerException e) {
            return Role.MEMBER;
        }
    }
}
