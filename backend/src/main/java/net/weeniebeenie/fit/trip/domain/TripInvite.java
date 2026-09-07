package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 여행에 부르는 링크 한 장.
 *
 * <p>주인이 링크를 만들어 카톡 등으로 보내면 받은 사람이 눌러 참여합니다.
 * 상대 이메일을 몰라도 되고, 가입자 명단을 뒤질 통로도 생기지 않습니다.
 *
 * <p>토큰 원본은 저장하지 않고 sha256 만 둡니다. 기한과 쓸 수 있는 횟수를
 * 두어, 링크가 엉뚱한 단톡방으로 흘러가도 계속 열려 있지 않게 합니다.
 */
@Entity
@Table(name = "trip_invites")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripInvite {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    /** 이 링크로 들어온 사람이 받을 역할. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TripRole role = TripRole.EDITOR;

    @Column(name = "created_by", nullable = false, length = 16)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    /** 비어 있으면 기한이 없다는 뜻입니다. 인원 제한과 취소로만 닫힙니다. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "max_uses", nullable = false)
    private int maxUses = 1;

    @Column(name = "used_count", nullable = false)
    private int usedCount = 0;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Builder
    public TripInvite(String tripId, String tokenHash, TripRole role, String createdBy,
                      Instant expiresAt, int maxUses) {
        this.id = Ids.next();
        this.tripId = tripId;
        this.tokenHash = tokenHash;
        this.role = role == null ? TripRole.EDITOR : role;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
        this.maxUses = Math.max(1, maxUses);
    }

    public boolean isUsable(Instant at) {
        return revokedAt == null
                && (expiresAt == null || expiresAt.isAfter(at))
                && usedCount < maxUses;
    }

    public void use() {
        usedCount++;
    }

    public void revoke() {
        revokedAt = Instant.now();
    }
}
