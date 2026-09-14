package net.weeniebeenie.fit.account.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/**
 * 누가 어느 곳의 누구인지.
 *
 * <p>열쇠가 <b>{@code (provider, subject)}</b> 입니다. 이메일이 아닙니다 —
 * 사람은 구글에서 이메일을 바꿀 수 있지만 {@code subject} 는 안 바뀝니다.
 * 이메일을 열쇠로 쓰면 주소를 바꾼 날 제 계정을 잃거나 남의 계정이 됩니다.
 *
 * <p>{@code email} 은 들고만 있습니다. <b>이것으로 사람을 찾지 않습니다.</b>
 * 찾는 데 쓰면 열쇠가 두 개가 되고, 둘이 어긋나는 날이 옵니다.
 */
@Entity
@Table(name = "user_identities")
@IdClass(UserIdentity.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserIdentity {

    @Id
    @Column(length = 16)
    private String provider;

    @Id
    @Column(length = 255)
    private String subject;

    @Column(name = "user_id", nullable = false, length = 16)
    private String userId;

    @Column(length = 190)
    private String email;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UserIdentity(String provider, String subject, String userId, String email) {
        this.provider = provider;
        this.subject = subject;
        this.userId = userId;
        this.email = email;
        this.createdAt = Instant.now();
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String provider;
        private String subject;
    }
}
