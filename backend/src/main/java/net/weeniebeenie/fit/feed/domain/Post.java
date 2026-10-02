package net.weeniebeenie.fit.feed.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * 피드 글 한 편 — 사진 몇 장과 글 한 줄.
 *
 * <h3>장소에서 떼어 냈습니다</h3>
 *
 * <p>장소마다 기록을 남기게 했던 자리가 있었는데 아무도 안 썼습니다. 이유는
 * 분명했습니다 — 무엇을 남기려면 <b>장소를 먼저 골라야</b> 해서, 숙소에서 찍은
 * 단체 사진은 올릴 데가 없었습니다. 여행에서 가장 남기고 싶은 사진이 정작 갈
 * 곳이 없는 셈이었습니다.
 *
 * <h3>여행기와 다릅니다</h3>
 *
 * <p>{@code TripPost}(여행기)는 제목·지역·사본을 가집니다. 남에게 내놓는 글이라
 * 그렇습니다. 이쪽은 하나도 안 가집니다 — 아는 사람들끼리 보는 것이고, 그래서
 * 올리는 데 드는 품이 사진 고르기 하나여야 합니다.
 *
 * <p>{@link Audience} 하나는 가집니다. 안 가졌을 때는 <b>올린 자리가 곧 공개
 * 범위</b>였는데(모임에 올리면 그 모임, 내 피드면 나만), 그러면 범위를 바꾸는
 * 길이 글을 지우고 다시 쓰는 것뿐이었습니다. 안 고르면 그 옛 규칙이 그대로
 * 기본값이라 올리는 품은 늘지 않습니다.
 *
 * <h3>그룹이 이 글의 주인이 아닙니다</h3>
 *
 * <p>{@code groupId} 가 비어 있으면 내 피드입니다. 그래서 표 이름도
 * {@code group_posts} 가 아니라 {@code posts} 입니다.
 */
@Entity
@Table(name = "posts")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Post {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "author_id", nullable = false, length = 16)
    private String authorId;

    /** 비어 있으면 내 피드입니다. */
    @Column(name = "group_id", length = 16)
    private String groupId;

    /**
     * 어느 여행 이야기인지. 안 골라도 됩니다.
     *
     * <p>여행을 지워도 글은 남습니다(ON DELETE SET NULL). 글은 그 여행이
     * 아니라 <b>그때 있었던 일</b>에 대한 것입니다.
     */
    @Column(name = "trip_id", length = 16)
    private String tripId;

    /** 사진만 올려도 됩니다. 그때는 비어 있습니다. */
    @Column(length = 2000)
    private String text;

    /**
     * 자유 태그.
     *
     * <p>고르는 목록을 두지 않습니다. 무엇으로 묶일지는 미리 알 수 없고,
     * 목록을 만들어 두면 거기 없는 이야기는 아무 데도 안 걸립니다.
     */
    @Column(columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] tags = new String[0];

    /**
     * 누가 볼 수 있는지.
     *
     * <p>{@link Audience} 에 갈래마다 왜 그렇게 두었는지 적어 두었습니다.
     * 지키는 곳은 {@code FeedService.visible} 한 곳입니다 — 울타리가 두
     * 군데면 언젠가 한쪽만 고칩니다.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Audience audience = Audience.ONLY_ME;

    /** 신고를 받아 운영자가 내린 것. 지우지 않고 감춥니다. */
    @Column(nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Builder
    public Post(String authorId, String groupId, String tripId, String text, String[] tags,
                Audience audience) {
        this.id = Ids.next();
        this.authorId = authorId;
        this.groupId = groupId;
        this.tripId = tripId;
        this.text = text;
        this.tags = tags == null ? new String[0] : tags;
        /* 안 고르면 올린 자리가 정합니다 — 공개 범위가 없던 때의 동작
           그대로입니다. 규칙을 여기 한 군데만 둡니다({@link #audienceFor}). */
        this.audience = audience == null ? audienceFor(groupId) : audience;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    /**
     * 안 골랐을 때의 공개 범위.
     *
     * <h3>왜 올린 자리가 정하나</h3>
     *
     * <p>공개 범위가 없던 때 이 글이 실제로 보였던 범위입니다 — 모임에 올린
     * 글은 그 모임 사람이 봤고, 내 피드에 쓴 글은 나만 봤습니다. 안 보낸 쪽을
     * 그때 동작으로 두면 옛 글도 새 글도 보이는 범위가 안 달라집니다(V52 의
     * 되메움도 같은 규칙입니다).
     *
     * <p>갈래 하나를 못 박고 싶었다면 {@link Audience#ONLY_ME} 여야 합니다 —
     * 모르고 넓게 열리는 쪽이 모르고 좁게 닫히는 쪽보다 되돌리기 어렵습니다.
     * 그런데 그러면 모임에 올린 글이 아무에게도 안 보이게 되어, 안 고른 사람이
     * 「모임에 올렸는데 아무 말이 없다」를 겪습니다. 모임에 올리는 행위 자체가
     * 이미 그 모임을 고른 것이라 그 뜻을 따릅니다.
     *
     * @param groupId 모임에 올리면 그 모임. 비어 있으면 내 피드입니다
     */
    public static Audience audienceFor(String groupId) {
        return groupId == null ? Audience.ONLY_ME : Audience.MATES;
    }

    /** 고친 때를 지금으로. 고치는 자리마다 적는 것을 잊지 않으려고 둡니다. */
    public void touch() {
        this.updatedAt = Instant.now();
    }
}
