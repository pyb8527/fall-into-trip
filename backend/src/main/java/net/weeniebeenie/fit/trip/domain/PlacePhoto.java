package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/**
 * 한 장소에 붙인 사진 한 장.
 *
 * <h3>여행의 것입니다</h3>
 *
 * <p>사람마다 따로 달아 두었었습니다. 그래서 셋이 간 여행에서 한 장소에 세
 * 덩어리가 나란히 섰고, 남이 올린 것은 손댈 수가 없었습니다 — 흐린 사진 하나를
 * 바꾸는 데도 올린 사람이 앱을 열어야 했습니다.
 *
 * <p>같이 다녀온 자리의 기록이니 한 장소에 하나로 둡니다. 멤버면 누구나
 * 더하고 고치고 뺍니다.
 *
 * <h3>왜 줄로 두는가</h3>
 *
 * <p>장소 줄에 배열 칸으로 담을 수도 있었습니다. 그런데 사진이 지워지면 없는
 * 번호가 배열에 남고, 그 자리는 화면에서 깨진 네모가 됩니다 — 없어진 줄도
 * 모르고 지나갑니다.
 *
 * <p>줄로 두면 사진이 지워질 때 이것도 함께 갑니다(ON DELETE CASCADE).
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PhotoKind kind;

    /** 올린 차례. 고른 차례대로 서야 그날의 흐름이 보입니다. */
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

    public PlacePhoto(String placeId, String photoId, PhotoKind kind, int sort, String addedBy) {
        this.placeId = placeId;
        this.photoId = photoId;
        this.kind = kind;
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
