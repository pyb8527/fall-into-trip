package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;
import net.weeniebeenie.fit.shared.domain.Ids;

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

    /**
     * 그날 타는 편.
     *
     * <p>"OZ112 09:20 인천 T1 → 간사이" 처럼 사람이 적고 사람이 읽는 한
     * 줄입니다. 처음에는 JSON 으로 두었는데 쓰려고 보니 이유가 있었습니다 —
     * 무슨 모양으로 쪼갤지가 항공·기차·버스·페리마다 다릅니다. 지도에 찍지도
     * 계산에 쓰지도 않는 값이라 쪼개 둘 이유가 없습니다.
     */
    @Column(length = 200)
    private String flight;

    /*
      그날 밤 어디서 자는지.

      장소로 넣지 않았습니다. 숙소는 "들르는 곳" 이 아닙니다 — 동선에 끼면
      "3번 호텔" 이 되고, 스탬프를 찍는 자리가 되고, 다녀온 곳 수에
      들어갑니다. 그날에 딸린 다른 종류의 값입니다.

      좌표까지 받습니다. 이름만으로는 "숙소 근처" 를 찾을 수 없고, 하루
      동선을 펼 때 어디서 시작하는지도 알 수 없습니다.
     */
    @Column(name = "stay_name", length = 120)
    private String stayName;

    @Column(name = "stay_lat")
    private Double stayLat;

    @Column(name = "stay_lng")
    private Double stayLng;

    @Column(name = "stay_place_id")
    private String stayPlaceId;

    @Column(name = "stay_note", length = 200)
    private String stayNote;

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
