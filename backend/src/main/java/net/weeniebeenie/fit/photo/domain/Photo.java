package net.weeniebeenie.fit.photo.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

import java.time.Instant;

/**
 * 올라온 사진 한 장.
 *
 * <h3>그림은 여기 없습니다</h3>
 *
 * <p>줄에 담는 것은 "누구 것이고 얼마나 크고 언제 올라왔나" 뿐입니다. 그림
 * 자체는 서버 옆 폴더에 둡니다 — 몇 메가짜리를 줄마다 넣으면 백업이 그만큼
 * 무거워지고, 백업이 무거워지면 안 하게 됩니다.
 *
 * <h3>나중에 옮길 수 있게</h3>
 *
 * <p>지금은 서버 옆 폴더입니다. 쓰는 사람이 늘어 자리가 모자라면 별도 서버나
 * 오브젝트 스토리지로 뺍니다. 그때 이 줄은 그대로 두고 읽고 쓰는 곳
 * ({@code PhotoStore}) 하나만 바꿉니다 — 그래서 여기에 경로를 담지 않습니다.
 * 파일 이름은 id 에서 나옵니다.
 */
@Entity
@Table(name = "photos")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Photo {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "owner_id", nullable = false, length = 16)
    private String ownerId;

    /** 다시 인코딩한 뒤의 크기. 사람마다 얼마나 쓰고 있는지 세는 데 씁니다. */
    @Column(nullable = false)
    private int bytes;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Builder
    public Photo(String ownerId, int bytes, int width, int height) {
        this.id = Ids.next();
        this.ownerId = ownerId;
        this.bytes = bytes;
        this.width = width;
        this.height = height;
        this.createdAt = Instant.now();
    }
}
