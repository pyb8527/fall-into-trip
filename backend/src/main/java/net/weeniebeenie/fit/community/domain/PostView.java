package net.weeniebeenie.fit.community.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDate;

/**
 * 누가 어느 날 이 글을 봤는지.
 *
 * <p>볼 때마다 한 줄씩 쌓으면 이 표만 금세 제일 커집니다. 사람과 날짜로 묶어
 * 하루에 한 번만 셉니다. 새로고침을 눌러도 늘지 않습니다.
 *
 * <p>로그인한 사람만 셉니다. 아닌 사람까지 세려면 IP 를 남겨야 하는데, 그건
 * 조회수 하나 때문에 들고 있을 값이 아닙니다.
 */
@Entity
@Table(name = "trip_post_views")
@IdClass(PostView.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PostView {

    @Id
    @Column(name = "post_id", length = 16)
    private String postId;

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Id
    @Column(name = "on_date")
    private LocalDate onDate;

    public PostView(String postId, String userId, LocalDate onDate) {
        this.postId = postId;
        this.userId = userId;
        this.onDate = onDate;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String postId;
        private String userId;
        private LocalDate onDate;
    }
}
