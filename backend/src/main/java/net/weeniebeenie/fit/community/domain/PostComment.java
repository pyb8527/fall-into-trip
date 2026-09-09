package net.weeniebeenie.fit.community.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 올라온 일정에 달린 댓글.
 *
 * <p>dayIndex·placeIndex 가 있으면 그 장소에 달린 것입니다. 없으면 일정 전체에
 * 대한 말입니다. "둘째 날 이 집 말고 옆집이 낫다" 는 어디에 대한 말인지가
 * 붙어 있어야 뜻이 통합니다.
 *
 * <p>가리키는 것은 <b>사본의 자리</b>입니다. 글은 올릴 때 뜬 사본이라 나중에
 * 바뀌지 않으므로 자리가 어긋나지 않습니다.
 */
@Entity
@Table(name = "post_comments")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PostComment {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "post_id", nullable = false, length = 16)
    private String postId;

    @Column(name = "user_id", nullable = false, length = 16)
    private String userId;

    @Column(nullable = false, length = 500)
    private String text;

    /** 어느 날 몇 번째 장소에 대한 말인지. 없으면 일정 전체입니다. */
    @Column(name = "day_index")
    private Integer dayIndex;

    @Column(name = "place_index")
    private Integer placeIndex;

    /** 신고를 받아 운영자가 내린 것. 지우지 않고 감춥니다. */
    @Column(nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Builder
    public PostComment(String postId, String userId, String text,
                       Integer dayIndex, Integer placeIndex) {
        this.id = Ids.next();
        this.postId = postId;
        this.userId = userId;
        this.text = text;
        this.dayIndex = dayIndex;
        this.placeIndex = placeIndex;
        this.createdAt = Instant.now();
    }
}
