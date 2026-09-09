package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 여행을 묶어 두는 폴더.
 *
 * <p>폴더는 여행이 아니라 <b>보는 사람</b>의 것입니다. 여행에 붙이면 주인이
 * 만든 폴더가 동행자 목록에도 나타나는데, 같이 간 사람마다 정리하는 방식이
 * 다릅니다. 누가 만든 여행이든 각자 자기 폴더에 넣습니다.
 */
@Entity
@Table(name = "trip_folders")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripFolder {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "user_id", nullable = false, length = 16)
    private String userId;

    @Column(nullable = false, length = 40)
    private String name;

    @Column(nullable = false)
    private int sort;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Builder
    public TripFolder(String userId, String name, int sort) {
        this.id = Ids.next();
        this.userId = userId;
        this.name = name;
        this.sort = sort;
        this.createdAt = Instant.now();
    }
}
