package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "places")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Place {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "day_id", nullable = false, length = 16)
    private String dayId;

    @Column(nullable = false)
    private int sort;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 120)
    private String ja;

    @Column(length = 120)
    private String en;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    @Column(length = 40)
    private String cat;

    /** "HH:MM". 비워 두면 순서만으로 배치됩니다. */
    @Column(length = 10)
    private String time;

    @Column(length = 40)
    private String cost;

    @Column(columnDefinition = "text")
    private String note;

    @Column(length = 500)
    private String url;

    /** 도보 반경(m). 지도에 원으로 그립니다. */
    private Integer radius;

    @Column(nullable = false)
    private boolean fit = true;

    /** {mode,min,via,cost} — 다음 장소까지의 이동 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String move;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by", length = 16)
    private String updatedBy;

    /**
     * 낙관적 잠금.
     *
     * 여럿이 같은 여행을 함께 고칩니다. 내가 화면을 열어 둔 사이에 다른 사람이
     * 먼저 저장하면 값이 어긋나고, 그때는 조용히 덮어쓰는 대신 되돌립니다.
     */
    @Version
    @Column(nullable = false)
    private long version;

    @Builder
    public Place(String dayId, int sort, String name, String ja, String en,
                 double lat, double lng, String cat, String time, String cost,
                 String note, String url, Integer radius, Boolean fit, String move,
                 String updatedBy) {
        this.id = Ids.next();
        this.dayId = dayId;
        this.sort = sort;
        this.name = name;
        this.ja = ja;
        this.en = en;
        this.lat = lat;
        this.lng = lng;
        this.cat = cat;
        this.time = time;
        this.cost = cost;
        this.note = note;
        this.url = url;
        this.radius = radius;
        this.fit = fit == null || fit;
        this.move = move;
        this.updatedAt = Instant.now();
        this.updatedBy = updatedBy;
    }

    public void touch(String userId) {
        this.updatedAt = Instant.now();
        this.updatedBy = userId;
    }
}
