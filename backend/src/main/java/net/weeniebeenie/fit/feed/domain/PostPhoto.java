package net.weeniebeenie.fit.feed.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/**
 * 피드 글에 실린 사진 한 장.
 *
 * <p>{@code place_photos} 와 같은 꼴입니다. 글 줄에 배열 칸으로 담을 수도
 * 있었지만, 사진이 지워지면 없는 번호가 배열에 남고 그 자리는 화면에서 깨진
 * 네모가 됩니다 — 없어진 줄도 모르고 지나갑니다. 줄로 두면 사진이 지워질 때
 * 이것도 함께 갑니다.
 */
@Entity
@Table(name = "post_photos")
@IdClass(PostPhoto.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PostPhoto {

    @Id
    @Column(name = "post_id", length = 16)
    private String postId;

    @Id
    @Column(name = "photo_id", length = 16)
    private String photoId;

    /** 올린 차례. 고른 차례대로 서야 넘겨 볼 때 이야기가 이어집니다. */
    @Column(nullable = false)
    private int sort;

    public PostPhoto(String postId, String photoId, int sort) {
        this.postId = postId;
        this.photoId = photoId;
        this.sort = sort;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String postId;
        private String photoId;
    }
}
