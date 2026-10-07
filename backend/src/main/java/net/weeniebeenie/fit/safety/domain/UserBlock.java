package net.weeniebeenie.fit.safety.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/**
 * 한 사람이 다른 한 사람을 막은 것.
 *
 * <p>막힌 사람에게는 알리지 않습니다. 이 줄은 막은 사람의 목록과 풀기에만
 * 쓰이고, 나머지 자리에서는 「서로 안 보이게」 거르는 데만 쓰입니다.
 */
@Entity
@Table(name = "user_blocks")
@IdClass(UserBlock.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserBlock {

    @Id
    @Column(name = "blocker_id", length = 16)
    private String blockerId;

    @Id
    @Column(name = "blocked_id", length = 16)
    private String blockedId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UserBlock(String blockerId, String blockedId) {
        this.blockerId = blockerId;
        this.blockedId = blockedId;
        this.createdAt = Instant.now();
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String blockerId;
        private String blockedId;
    }
}
