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
 *
 * <h3>별이 여기 붙습니다</h3>
 *
 * <p>V37 에서 걷어 낸 {@code places.stars} 는 <b>내 일정의 그 장소</b>에
 * 달려 있었습니다. 같은 가게를 넣어 둔 남의 일정에서는 안 보였고, 그래서
 * 열 사람이 다녀가도 별점이 열 군데에 하나씩 흩어졌습니다. 쌓이는 곳이
 * 없으면 평균도 없습니다.
 *
 * <p>별점표를 따로 만들지 않습니다. 따로 두면 한 사람이 같은 가게에 별
 * 따로 · 한 줄 따로 남길 수 있고, 그 둘을 한 화면에 묶어 보여 주려면 매번
 * 맞춰 붙여야 합니다. 화면이 그리는 모양이 이미 「얼굴 · 이름 · 별 · 한 줄」
 * 한 덩어리입니다.
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

    /**
     * 별 1~5. 비워 둘 수 있습니다.
     *
     * <p>「별 다섯 + 한 줄, 둘 중 하나만 써도 됩니다」(G-11) 입니다 — 별만
     * 주고 싶은 사람도 있고 할 말만 있는 사람도 있습니다.
     *
     * <p>{@link Integer} 입니다. {@code int} 로 두면 안 준 것이 0 이 되고,
     * 0 은 평균에 들어가 별 하나보다 나쁜 점수가 됩니다.
     */
    @Column
    private Integer stars;

    /** 신고를 받아 운영자가 내린 글. 지우지 않고 감춥니다. */
    @Column(nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /**
     * 고친 때. <b>비어 있으면 한 번도 안 고친 것입니다.</b>
     *
     * <p>고쳐도 {@code createdAt} 은 안 건드립니다. 그 값은 「언제 다녀와서 쓴
     * 것인가」이고, 보여 줄지 말지를 가리는 이레 기한
     * ({@code TipService.FRESH})과 줄 순서가 거기에 매여 있습니다. 고칠 때마다
     * 새 글로 세면 같은 한 줄을 다시 저장하는 것만으로 장소 맨 위에 영원히
     * 세워 둘 수 있고, 그것은 {@code MAX_PER_DAY} 로 막아 둔 도배와 같은
     * 일입니다.
     *
     * <p>대신 고친 때를 읽는 쪽에 함께 내려보냅니다. 대기 시간처럼 금방
     * 달라지는 것은 <b>언제 적힌 것인지</b>가 내용만큼 중요합니다.
     */
    @Column(name = "edited_at")
    private Instant editedAt;

    @Builder
    public PlaceTip(String placeId, String userId, String text, Integer stars) {
        this.id = Ids.next();
        this.placeId = placeId;
        this.userId = userId;
        this.text = text;
        this.stars = stars;
        this.createdAt = Instant.now();
    }
}
