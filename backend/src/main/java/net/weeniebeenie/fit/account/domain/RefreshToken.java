package net.weeniebeenie.fit.account.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 리프레시 토큰 한 장.
 *
 * 원본 문자열은 저장하지 않고 sha256 만 둡니다. 재발급할 때마다 새 토큰으로
 * 갈아 끼우고(rotation) 옛 것은 used_at 을 찍어 둡니다. 이미 쓴 토큰이 다시
 * 들어오면 탈취로 보고 같은 family 를 통째로 끊습니다.
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "user_id", nullable = false, length = 16)
    private String userId;

    /** 한 번의 로그인에서 파생된 토큰 묶음. 탈취가 보이면 이 단위로 끊습니다. */
    @Column(name = "family_id", nullable = false, length = 16)
    private String familyId;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "replaced_by", length = 16)
    private String replacedBy;

    @Column(name = "user_agent", length = 200)
    private String userAgent;

    @Column(length = 64)
    private String ip;

    @Builder
    public RefreshToken(String tokenHash, String userId, String familyId,
                        Instant expiresAt, String userAgent, String ip) {
        this.id = Ids.next();
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.familyId = familyId == null ? this.id : familyId;
        this.issuedAt = Instant.now();
        this.expiresAt = expiresAt;
        this.userAgent = userAgent;
        this.ip = ip;
    }

    public boolean isLive(Instant at) {
        return revokedAt == null && usedAt == null && expiresAt.isAfter(at);
    }
}
