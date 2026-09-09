package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/**
 * 어떤 여행을 어느 폴더에 넣었는지.
 *
 * <p>열쇠가 (사람, 여행)이라 한 사람이 한 여행을 두 폴더에 넣을 수 없습니다.
 * 여러 곳에 걸쳐 두면 목록에서 같은 여행이 두 번 보입니다.
 */
@Entity
@Table(name = "trip_folder_items")
@IdClass(TripFolderItem.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripFolderItem {

    @Id
    @Column(name = "user_id", length = 16)
    private String userId;

    @Id
    @Column(name = "trip_id", length = 16)
    private String tripId;

    @Column(name = "folder_id", nullable = false, length = 16)
    private String folderId;

    public TripFolderItem(String userId, String tripId, String folderId) {
        this.userId = userId;
        this.tripId = tripId;
        this.folderId = folderId;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private String userId;
        private String tripId;
    }
}
