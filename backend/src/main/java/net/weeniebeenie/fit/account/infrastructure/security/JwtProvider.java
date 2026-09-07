package net.weeniebeenie.fit.account.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * 액세스 토큰 발급·검증.
 *
 * 액세스 토큰은 짧게(기본 15분) 두고 서버에 저장하지 않습니다. 대신 계정이
 * 정지되거나 비밀번호가 바뀌면 리프레시 토큰을 끊어, 길어도 15분 안에 접근이
 * 막히도록 했습니다.
 */
@Component
@RequiredArgsConstructor
public class JwtProvider {

    private final JwtProperties props;

    private SecretKey key() {
        byte[] bytes = props.getSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("fit.jwt.secret 은 32바이트 이상이어야 합니다.");
        }
        return Keys.hmacShaKeyFor(bytes);
    }

    public String issue(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(props.getIssuer())
                .subject(user.getId())
                .claim("email", user.getEmail())
                .claim("name", user.getName())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.getAccessTtl())))
                .signWith(key())
                .compact();
    }

    /** 서명과 만료가 모두 맞을 때만 claim 을 돌려줍니다. 아니면 null. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key())
                    .requireIssuer(props.getIssuer())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public long accessTtlSeconds() {
        return props.getAccessTtl().toSeconds();
    }
}
