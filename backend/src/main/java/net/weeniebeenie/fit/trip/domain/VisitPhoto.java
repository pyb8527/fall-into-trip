package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/**
 * 한 장소에 붙인 사진 한 장.
 *
 * <h3>왜 줄로 두는가</h3>
 *
 * <p>도장 줄에 배열 칸으로 담을 수도 있었습니다. 그런데 사진이 지워지면 없는
 * 번호가 배열에 남고, 그 자리는 화면에서 깨진 네모가 됩니다 — 없어진 줄도
 * 모르고 지나갑니다.
 *
 * <p>줄로 두면 사진이 지워질 때 이것도 함께 갑니다(ON DELETE CASCADE).
 */
@Entity
@Table(name = "visit_photos")
@IdClass(VisitPhoto.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VisitPhoto {

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Id
    @Column(name = "place_id", length = 16)
    private String placeId;

    @Id
    @Column(name = "photo_id", length = 16)
    private String photoId;

    /** 올린 차례. 고른 차례대로 서야 그날의 흐름이 보입니다. */
    @Column(nullable = false)
    private int sort;

    public VisitPhoto(String userId, String placeId, String photoId, int sort) {
        this.userId = userId;
        this.placeId = placeId;
        this.photoId = photoId;
        this.sort = sort;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String userId;
        private String placeId;
        private String photoId;
    }
}
