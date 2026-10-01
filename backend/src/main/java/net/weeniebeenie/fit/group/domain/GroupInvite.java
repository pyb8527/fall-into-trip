package net.weeniebeenie.fit.group.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 모임에 부르는 링크.
 *
 * <p>여행 초대를 그대로 옮긴 것입니다. 지키는 것도 같습니다.
 *
 * <h3>토큰은 해시로만 둡니다</h3>
 *
 * <p>저장소를 들여다본 사람이 링크를 그대로 들고 나갈 수 없게 합니다. 토큰
 * 자체는 만들 때 한 번 내보내고 다시는 꺼낼 수 없습니다 — 잃어버리면 새로
 * 만듭니다.
 *
 * <h3>한 링크를 여럿이 씁니다</h3>
 *
 * <p>여행 초대는 한 번 쓰고 죽는 것이 기본이었습니다. 모임은 셋을 한꺼번에
 * 부르는 일이 흔해서 그러면 링크를 셋 만들어야 합니다.
 */
@Entity
@Table(name = "group_invites")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GroupInvite {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "group_id", nullable = false, length = 16)
    private String groupId;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "created_by", nullable = false, length = 16)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "max_uses", nullable = false)
    private int maxUses = 1;

    @Column(name = "used_count", nullable = false)
    private int usedCount = 0;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Builder
    public GroupInvite(String groupId, String tokenHash, String createdBy,
                       Instant expiresAt, int maxUses) {
        this.id = Ids.next();
        this.groupId = groupId;
        this.tokenHash = tokenHash;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
        this.maxUses = Math.max(1, maxUses);
    }

    /** 아직 쓸 수 있는가. 셋 중 하나라도 걸리면 못 씁니다. */
    public boolean usable(Instant now) {
        return revokedAt == null
                && (expiresAt == null || expiresAt.isAfter(now))
                && usedCount < maxUses;
    }
}
