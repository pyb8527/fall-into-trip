package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;

@Entity
@Table(name = "days")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Day {

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 16)
    private String tripId;

    @Column(nullable = false)
    private int sort;

    @Column(nullable = false, length = 40)
    private String label;

    @Column(name = "short", length = 80)
    private String shortName;

    /** 화면에 그대로 쓰는 문자열 "10.08 (목)" */
    @Column(length = 40)
    private String date;

    private LocalDate iso;

    @Column(length = 200)
    private String theme;

    @Column(length = 24)
    private String color;

    @Column(length = 40)
    private String budget;

    /** {from,to,depart,arrive} 같은 자유 구조라 JSON 으로 둡니다. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String flight;

    @Version
    @Column(nullable = false)
    private long version;

    @Builder
    public Day(String tripId, int sort, String label, String shortName, String date,
               LocalDate iso, String theme, String color, String budget, String flight) {
        this.id = Ids.next();
        this.tripId = tripId;
        this.sort = sort;
        this.label = label;
        this.shortName = shortName;
        this.date = date;
        this.iso = iso;
        this.theme = theme;
        this.color = color;
        this.budget = budget;
        this.flight = flight;
    }
}
