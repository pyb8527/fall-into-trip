package net.weeniebeenie.fit.tip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDate;

/**
 * 누가 어느 날 이 한 줄을 봤는지.
 *
 * <p>볼 때마다 한 줄씩 쌓으면 이 표만 금세 제일 커집니다. 사람과 날짜로 묶어
 * 하루에 한 번만 셉니다. 새로고침을 눌러도 늘지 않습니다.
 *
 * <p>로그인한 사람만 셉니다. 팁 읽기는 로그인 없이 열려 있지만, 손님에게는
 * 사람 번호가 없어 "하루 한 번" 을 셀 수가 없습니다. 아이피로 세면 자취를
 * 쌓는 일이 되고, 그건 조회수 하나 때문에 들고 있을 값이 아닙니다.
 *
 * <p>그래서 이 수는 <b>"이만큼은 확실히 쓰였다"</b> 이지 전체 조회수가
 * 아닙니다. 화면에서도 그렇게 말합니다 — 부풀린 수 한 줄이 나머지 전부를
 * 못 믿게 만듭니다.
 *
 * <p>{@link net.weeniebeenie.fit.community.domain.PostView} 와 같은
 * 모양입니다. 같은 일을 다른 모양으로 두면 한쪽만 고치는 날이 옵니다.
 */
@Entity
@Table(name = "place_tip_views")
@IdClass(PlaceTipView.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlaceTipView {

    @Id
    @Column(name = "tip_id", length = 16)
    private String tipId;

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Id
    @Column(name = "on_date")
    private LocalDate onDate;

    public PlaceTipView(String tipId, String userId, LocalDate onDate) {
        this.tipId = tipId;
        this.userId = userId;
        this.onDate = onDate;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String tipId;
        private String userId;
        private LocalDate onDate;
    }
}
