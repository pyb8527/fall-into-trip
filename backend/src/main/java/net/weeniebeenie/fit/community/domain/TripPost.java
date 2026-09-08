package net.weeniebeenie.fit.community.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * 남에게 보여 주려고 올린 일정 한 편.
 *
 * <p>내용은 <b>올릴 때 뜬 사본</b>입니다. 원본 여행을 가리키게 두면 올린 뒤
 * 작성자가 장소를 지우거나 날짜를 바꿀 때 남이 보던 글이 조용히 달라지고,
 * 여행을 지우면 글이 깨집니다. 사본을 두면 원본이 어떻게 되든 글은 그대로
 * 남고, 복제도 이 사본에서 합니다.
 *
 * <p>고치고 싶으면 내리고 다시 올립니다. 사본을 계속 원본과 맞춰 주기
 * 시작하면 결국 원본을 가리키는 것과 같아집니다.
 */
@Entity
@Table(name = "trip_posts")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripPost {

    @Id
    @Column(length = 16)
    private String id;

    /** 어디서 왔는지. 원본이 지워지면 비워집니다. 내용과는 무관합니다. */
    @Column(name = "trip_id", length = 16)
    private String tripId;

    @Column(name = "author_id", nullable = false, length = 16)
    private String authorId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 300)
    private String summary;

    /**
     * 어느 지역 여행인지. 올릴 때 글쓴이가 고릅니다.
     *
     * <p>좌표는 이미 있지만 그것이 어느 나라인지는 모릅니다. 알아내려면 장소마다
     * 역지오코딩을 돌려야 하고 그만큼 요금이 붙습니다. 고르는 것은 한 번이고
     * 글쓴이가 제일 잘 압니다.
     */
    @Column(length = 24)
    private String region;

    /**
     * 올릴 때의 일정 전체. 날짜와 장소가 그대로 들어 있습니다.
     *
     * <p>자바에서는 그냥 문자열이지만 데이터베이스에서는 jsonb 입니다. 이것을
     * 알려 주지 않으면 하이버네이트가 문자열로 밀어 넣고 PostgreSQL 이
     * 거절합니다.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String snapshot;

    @Column(name = "day_count", nullable = false)
    private int dayCount;

    @Column(name = "place_count", nullable = false)
    private int placeCount;

    /**
     * 세어 둔 값.
     *
     * <p>목록을 그릴 때마다 추천과 조회를 세면 조인이 둘 더 붙습니다. 목록은
     * 가장 자주 열리는 화면이라 그만큼 무거워집니다.
     */
    @Column(name = "like_count", nullable = false)
    private int likeCount;

    @Column(name = "view_count", nullable = false)
    private int viewCount;

    /** 신고를 받아 운영자가 내린 글. 지우지 않고 감춥니다. */
    @Column(nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Builder
    public TripPost(String tripId, String authorId, String title, String summary,
                    String region, String snapshot, int dayCount, int placeCount) {
        this.id = Ids.next();
        this.tripId = tripId;
        this.authorId = authorId;
        this.title = title;
        this.summary = summary;
        this.region = region;
        this.snapshot = snapshot;
        this.dayCount = dayCount;
        this.placeCount = placeCount;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
