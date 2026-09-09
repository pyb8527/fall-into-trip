package net.weeniebeenie.fit.support.push;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 알림을 받겠다고 켜 둔 기기 하나.
 *
 * <p>사람이 아니라 기기입니다. 폰에서 켜고 노트북에서도 켜면 두 줄이 됩니다.
 * 브라우저마다 따로이기도 해서, 같은 노트북의 크롬과 사파리도 다른 줄입니다.
 *
 * <p>{@code endpoint} 가 그 기기입니다. 브라우저가 발급하는 주소이고 같은
 * 기기에서 다시 켜면 같은 것이 옵니다. 그래서 이것을 유일 열쇠로 두었습니다 —
 * 안 그러면 껐다 켤 때마다 쌓여 한 기기에 알림이 여러 번 옵니다.
 */
@Entity
@Table(name = "push_subscriptions")
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class PushSubscription {

    @Id
    @Builder.Default
    private String id = Ids.next();

    @Column(name = "user_id", nullable = false)
    private String userId;

    /** 브라우저가 준 "여기로 보내라" 는 주소. 중계 서버가 어디인지도 여기 들어 있습니다. */
    @Column(nullable = false, unique = true, length = 1000)
    private String endpoint;

    /** 이 기기의 공개키. 내용을 이 기기만 열 수 있게 봉하는 데 씁니다. */
    @Column(nullable = false, length = 200)
    private String p256dh;

    /** 이 기기의 비밀 한 조각. 위와 함께 봉하는 데 씁니다. */
    @Column(nullable = false, length = 60)
    private String auth;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    /**
     * 마지막으로 보내다 거절당한 때.
     *
     * <p>브라우저를 지우거나 알림을 끄면 중계 서버가 404·410 으로 답합니다.
     * 그때 이 줄을 지웁니다 — 없는 곳에 계속 보내는 것은 낭비이고, 쌓이면
     * 알림 한 번에 실패를 수십 번 겪게 됩니다.
     */
    @Column(name = "failed_at")
    private Instant failedAt;
}
