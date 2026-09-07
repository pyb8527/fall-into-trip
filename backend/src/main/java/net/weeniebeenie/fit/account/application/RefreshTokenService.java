package net.weeniebeenie.fit.account.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.shared.domain.Ids;
import net.weeniebeenie.fit.account.domain.RefreshToken;
import net.weeniebeenie.fit.account.domain.RefreshTokenRepository;
import net.weeniebeenie.fit.account.infrastructure.security.JwtProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

/**
 * 리프레시 토큰 발급·회전·폐기.
 *
 * <p>원본 문자열은 저장하지 않고 sha256 만 둡니다. 여기서는 굳이 느린 해시를
 * 쓰지 않습니다 — 토큰은 사람이 정한 비밀번호와 달리 32바이트 난수라 사전
 * 대입이 통하지 않고, 요청마다 검증해야 해서 빨라야 합니다.
 *
 * <p>재발급할 때마다 새 토큰으로 갈아 끼우고 옛 것은 쓴 것으로 표시합니다.
 * 이미 쓴 토큰이 다시 들어오면 누군가 가로챈 것으로 보고, 그 로그인에서
 * 파생된 토큰(family)을 통째로 끊습니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository repository;
    private final JwtProperties props;

    /** 새로 로그인했을 때. 새 family 가 시작됩니다. */
    @Transactional
    public String issue(String userId, String userAgent, String ip) {
        return persist(userId, null, userAgent, ip);
    }

    /**
     * 들고 온 토큰을 새 토큰으로 갈아 끼웁니다.
     *
     * @return 새 토큰. 토큰이 없거나 이미 쓴 것이면 비어 있습니다.
     */
    @Transactional
    public Optional<Rotated> rotate(String rawToken, String userAgent, String ip) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        Optional<RefreshToken> found = repository.findByTokenHash(sha256(rawToken));
        if (found.isEmpty()) {
            return Optional.empty();
        }
        RefreshToken token = found.get();
        Instant now = Instant.now();

        /* 이미 쓴 토큰이 다시 왔다 — 가로챈 쪽과 원래 주인이 같은 토큰을 들고
           있다는 뜻이므로 그 로그인 전체를 끊는다. */
        if (token.getUsedAt() != null || token.getRevokedAt() != null) {
            int killed = repository.revokeFamily(token.getFamilyId(), now);
            log.warn("리프레시 토큰 재사용 감지 — user={} family={} 끊은 토큰={}",
                    token.getUserId(), token.getFamilyId(), killed);
            return Optional.empty();
        }
        if (!token.getExpiresAt().isAfter(now)) {
            return Optional.empty();
        }

        token.setUsedAt(now);
        String next = persist(token.getUserId(), token.getFamilyId(), userAgent, ip);
        token.setReplacedBy(repository.findByTokenHash(sha256(next)).map(RefreshToken::getId).orElse(null));
        return Optional.of(new Rotated(token.getUserId(), next));
    }

    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        repository.findByTokenHash(sha256(rawToken))
                .ifPresent(t -> t.setRevokedAt(Instant.now()));
    }

    /** 비밀번호 변경·계정 정지처럼 전 기기를 내보내야 할 때. */
    @Transactional
    public int revokeAllOf(String userId) {
        return repository.revokeAllOfUser(userId, Instant.now());
    }

    @Transactional
    public int purgeExpired() {
        return repository.deleteExpired(Instant.now());
    }

    private String persist(String userId, String familyId, String userAgent, String ip) {
        String raw = Ids.secret();
        RefreshToken token = RefreshToken.builder()
                .tokenHash(sha256(raw))
                .userId(userId)
                .familyId(familyId)
                .expiresAt(Instant.now().plus(props.getRefreshTtl()))
                .userAgent(userAgent == null ? null : userAgent.substring(0, Math.min(200, userAgent.length())))
                .ip(ip)
                .build();
        if (familyId == null) {
            token.setFamilyId(token.getId());
        }
        repository.save(token);
        return raw;
    }

    private static String sha256(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("토큰을 처리하지 못했습니다.", e);
        }
    }

    public record Rotated(String userId, String token) {
    }
}
