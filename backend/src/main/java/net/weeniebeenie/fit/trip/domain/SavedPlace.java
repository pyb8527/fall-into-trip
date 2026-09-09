package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 나중에 쓰려고 담아 둔 장소.
 *
 * <p>남의 일정을 통째로 복제하는 길은 있었지만 "이 집만 갖고 싶다" 가 안
 * 됐습니다. 담아 두었다가 내 일정 아무 날에나 꺼내 넣습니다.
 *
 * <p>담는 순간의 값을 그대로 둡니다. 원래 글이 지워지거나 그쪽에서 이름을
 * 고쳐도 내가 담아 둔 것은 그대로여야 합니다.
 */
@Entity
@Table(name = "saved_places")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SavedPlace {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "user_id", nullable = false, length = 16)
    private String userId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    /** 구글이 아는 번호. 있으면 영업시간도 볼 수 있습니다. */
    @Column(name = "place_id", length = 255)
    private String placeId;

    @Column(length = 40)
    private String cat;

    @Column(columnDefinition = "text")
    private String note;

    /** 어느 글에서 담았는지. 없으면 검색이나 지도에서 담은 것입니다. */
    @Column(name = "from_post", length = 16)
    private String fromPost;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Builder
    public SavedPlace(String userId, String name, double lat, double lng,
                      String placeId, String cat, String note, String fromPost) {
        this.id = Ids.next();
        this.userId = userId;
        this.name = name;
        this.lat = lat;
        this.lng = lng;
        this.placeId = placeId;
        this.cat = cat;
        this.note = note;
        this.fromPost = fromPost;
        this.createdAt = Instant.now();
    }
}
