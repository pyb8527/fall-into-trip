package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 다녀왔다는 도장.
 *
 * <p>사람마다 따로 남습니다. 같은 여행을 가도 누구는 들르고 누구는 지나칠 수
 * 있으니, 한 사람이 찍었다고 모두에게 칠해지면 안 됩니다.
 *
 * <h3>도장에 사진과 한 줄이 붙습니다</h3>
 *
 * <p>도장을 찍는 자리가 곧 그 장소에 서 있는 순간입니다 — 사진 한 장과 한
 * 줄이 나오기에 그보다 좋은 때가 없습니다. 돌아와서 여행기를 쓰려고 하면
 * 그때 무엇을 느꼈는지부터 다시 떠올려야 합니다.
 *
 * <p>여기 쌓인 것이 나중에 여행기의 재료가 됩니다. 셋 다 비워 둘 수 있습니다 —
 * 도장만 찍고 지나가는 것이 여전히 기본입니다.
 */
@Entity
@Table(name = "visits")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Visit {

    @EmbeddedId
    private VisitId id;

    @Column(name = "visited_at", nullable = false)
    private Instant visitedAt = Instant.now();

    /** 그 자리에서 찍은 사진 한 장. 사진이 지워지면 여기만 비고 도장은 남습니다. */
    @Column(name = "photo_id", length = 16)
    private String photoId;

    /** 몇 점이었는지. 1~5, 안 매기면 비어 있습니다. */
    private Short stars;

    /** 한 줄. "국물이 진해요" 같은 것. */
    @Column(length = 200)
    private String note;

    public Visit(String userId, String placeId) {
        this.id = new VisitId(userId, placeId);
        this.visitedAt = Instant.now();
    }
}
