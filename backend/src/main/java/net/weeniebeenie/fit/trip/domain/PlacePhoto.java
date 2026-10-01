package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/**
 * 한 장소에 챙겨 둔 사진 한 장.
 *
 * <h3>다니면서 볼 것입니다</h3>
 *
 * <p>메뉴판, 예매 화면, 가는 길 지도. <b>가기 전에 넣어 두고 가게 앞에서
 * 꺼내 보는 것</b>이라, 남에게 보이려고 올리는 사진과 다릅니다. 여행기에도
 * 안 실립니다.
 *
 * <p>한동안 「그 자리에서 남긴 것」도 여기 있었습니다(kind 로 갈랐습니다).
 * 그런데 그걸 남기려면 <b>장소를 먼저 골라야</b> 해서, 숙소에서 찍은 단체
 * 사진은 올릴 데가 없었습니다. 그쪽은 피드로 옮겼고 여기는 한 가지만
 * 남았습니다.
 *
 * <h3>여행의 것입니다</h3>
 *
 * <p>사람마다 따로 달지 않습니다. 메뉴판을 누가 찍어 왔든 같이 보는 것이고,
 * 흐린 것을 다시 찍어 바꾸는 데 올린 사람이 앱을 열어야 할 이유가 없습니다.
 *
 * <h3>왜 줄로 두는가</h3>
 *
 * <p>장소 줄에 배열 칸으로 담을 수도 있었습니다. 그런데 사진이 지워지면 없는
 * 번호가 배열에 남고, 그 자리는 화면에서 깨진 네모가 됩니다 — 없어진 줄도
 * 모르고 지나갑니다. 줄로 두면 사진이 지워질 때 이것도 함께 갑니다.
 */
@Entity
@Table(name = "place_photos")
@IdClass(PlacePhoto.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlacePhoto {

    @Id
    @Column(name = "place_id", length = 16)
    private String placeId;

    @Id
    @Column(name = "photo_id", length = 16)
    private String photoId;

    /** 올린 차례. 고른 차례대로 서야 꺼내 볼 때 찾기 쉽습니다. */
    @Column(nullable = false)
    private int sort;

    /**
     * 누가 올렸는지.
     *
     * <p>손대는 것을 막는 데는 안 씁니다 — 멤버면 누구나 고칩니다. 사진
     * <b>파일</b>을 지우는 것만 올린 사람 몫입니다(PhotoService).
     */
    @Column(name = "added_by", length = 16)
    private String addedBy;

    public PlacePhoto(String placeId, String photoId, int sort, String addedBy) {
        this.placeId = placeId;
        this.photoId = photoId;
        this.sort = sort;
        this.addedBy = addedBy;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String placeId;
        private String photoId;
    }
}
