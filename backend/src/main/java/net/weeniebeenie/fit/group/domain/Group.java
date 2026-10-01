package net.weeniebeenie.fit.group.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 여행을 같이 가는 무리.
 *
 * <h3>왜 여행 위에 한 층을 두는가</h3>
 *
 * <p>지금까지는 여행이 먼저 있고 거기에 사람을 불렀습니다. 그래서 여행이
 * 끝나면 그 사람들과의 끈도 같이 끝났습니다 — 작년에 같이 간 사람과 올해
 * 또 가려면 초대 링크를 다시 보내야 했고, 둘이 같은 무리라는 것을 앱은
 * 몰랐습니다.
 *
 * <h3>만드는 것이 가벼워야 합니다</h3>
 *
 * <p>사람을 부르는 길이 이것 하나입니다. 그래서 「이번 여행만 같이 짜는
 * 동료」에게도 그룹을 만들어야 하고, 그러려면 <b>이름 하나로 끝나야</b>
 * 합니다.
 *
 * <p>표지 사진 대신 그림(emoji)이 먼저인 까닭이 이것입니다 — 만드는 자리에서
 * 사진을 고르라고 하면 거기서 멈춥니다. 사진은 나중에 채웁니다.
 */
@Entity
@Table(name = "groups")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Group {

    @Id
    @Column(length = 16)
    private String id = Ids.next();

    @Column(nullable = false, length = 40)
    private String name;

    /** 한 줄 소개. 없어도 됩니다. */
    @Column(length = 200)
    private String about;

    /** 그림 하나. 목록에서 모임을 가르는 가장 싼 방법입니다. */
    @Column(length = 8)
    private String emoji;

    @Column(name = "cover_photo_id", length = 16)
    private String coverPhotoId;

    /** 만든 사람. 넘길 수 있습니다. */
    @Column(name = "owner_id", nullable = false, length = 16)
    private String ownerId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Group(String name, String ownerId) {
        this.name = name;
        this.ownerId = ownerId;
    }
}
