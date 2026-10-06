package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

@Entity
@Table(name = "trips")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Trip {

    @Id
    @Column(length = 16)
    private String id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "owner_id", nullable = false, length = 16)
    private String ownerId;

    /**
     * 목록에서 이 여행을 가리키는 색.
     *
     * <p>안 정했으면 비어 있습니다. 기본값을 억지로 주지 않습니다 — 그러면
     * 정한 것과 안 정한 것을 구별할 수 없고, 정하는 일 자체가 뜻을 잃습니다.
     *
     * <p>고를 수 있는 것은 {@link DayLabels#COLORS} 여덟 가지뿐입니다.
     * 아무 색이나 받으면 흰 글씨가 안 읽히는 색과 코랄에 붙는 색이 들어옵니다.
     */
    @Column(length = 7)
    private String theme;

    /** 이름 앞에 붙는 표식 하나. 안 정했으면 비어 있습니다. */
    @Column(length = 16)
    private String emoji;

    /**
     * 어느 모임의 여행인지. 비어 있으면 혼자 여행입니다.
     *
     * <p>모임이 지워져도 여행은 남습니다(ON DELETE SET NULL). 방을 정리하려다
     * 지난 여행이 통째로 사라지면 안 됩니다 — 그때는 만든 사람의 혼자 여행이
     * 됩니다.
     */
    @Column(name = "group_id", length = 16)
    private String groupId;

    /**
     * 여행 안내판 — 여행 전체에 걸린 것을 적어 두는 글 한 장.
     *
     * <p>숙소 도어락, 모이는 곳, 비상 연락처. 날짜에도 장소에도 안 묶이는
     * 것들입니다. 멤버 누구나 고치고, 답글과 읽음 표시는 없습니다.
     */
    @Column(columnDefinition = "text")
    private String notice;

    /** 마지막으로 고친 사람. 소식함이 「○○ 님이 고쳤어요」를 쓰는 데 씁니다. */
    @Column(name = "notice_by", length = 16)
    private String noticeBy;

    @Column(name = "notice_at")
    private Instant noticeAt;

    /** 예산(원). 안 정했으면 비어 있습니다(V56). */
    private Long budget;

    /**
     * 로그인 없이 보는 일정 링크의 열쇠 — SHA-256 만 둡니다.
     *
     * <p>비어 있으면 링크가 없습니다. 언제 죽는지는 적지 않고 날짜에서 셉니다
     * ({@code ViewLinkService}).
     */
    @Column(name = "view_token_hash", length = 64)
    private String viewTokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Version
    @Column(nullable = false)
    private long version;

    @Builder
    public Trip(String title, String ownerId, String groupId) {
        this.id = Ids.next();
        this.title = title;
        this.ownerId = ownerId;
        this.groupId = groupId;
        this.createdAt = Instant.now();
    }
}
