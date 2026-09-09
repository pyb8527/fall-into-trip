package net.weeniebeenie.fit.tip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 다녀온 사람이 남기는 한 줄.
 *
 * <p>"지금 대기 40분", "2번 출구로 나와야 함" 처럼 구글에는 없고 방금 다녀온
 * 사람만 아는 것들입니다.
 *
 * <p>여행이 아니라 <b>구글 장소 번호</b>에 답니다. 여행에 달면 같은 가게를
 * 넣어 둔 남의 일정에서는 안 보이는데, 그러면 팁이 쌓일 데가 없습니다.
 */
@Entity
@Table(name = "place_tips")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlaceTip {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "place_id", nullable = false, length = 255)
    private String placeId;

    @Column(name = "user_id", nullable = false, length = 16)
    private String userId;

    @Column(nullable = false, length = 200)
    private String text;

    /** 신고를 받아 운영자가 내린 글. 지우지 않고 감춥니다. */
    @Column(nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Builder
    public PlaceTip(String placeId, String userId, String text) {
        this.id = Ids.next();
        this.placeId = placeId;
        this.userId = userId;
        this.text = text;
        this.createdAt = Instant.now();
    }
}
