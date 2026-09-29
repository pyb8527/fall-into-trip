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

    /**
     * 구글이 아는 이 장소의 번호.
     *
     * <p>영업시간·전화번호 같은 내용은 우리가 쌓아 두면 안 됩니다(구글 약관).
     * 번호만은 영구 저장이 허용되므로, 내용 대신 이것만 들고 있다가 필요할 때
     * 이 번호로 물어봅니다. 직접 좌표를 넣은 장소에는 없습니다.
     */
    @Column(name = "place_id", length = 255)
    private String placeId;

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

    /**
     * 지도에 찍힐 그림.
     *
     * <p>이모지가 아니라 짧은 이름("ramen", "onsen")만 둡니다. 어떤 그림을
     * 그릴지는 화면이 정합니다 — 이모지는 기기마다 다르게 생기고, 언젠가
     * 바꾸고 싶어졌을 때 쌓인 값을 전부 고쳐야 합니다.
     */
    @Column(length = 24)
    private String icon;

    /** "HH:MM". 비워 두면 순서만으로 배치됩니다. */
    @Column(length = 10)
    private String time;

    /**
     * 사람이 자유롭게 적는 비용.
     *
     * <p>"무료", "1인 2천엔", "￥1,200~1,800" 같은 것이 들어 있습니다. 숫자로
     * 읽으려 들지 않습니다 — 틀리면 멀쩡한 계획에 틀린 돈이 붙습니다.
     */
    @Column(length = 40)
    private String cost;

    /**
     * 셈할 수 있는 비용. 그 통화의 <b>가장 작은 단위</b>입니다.
     *
     * <p>12.50달러는 1250, 9000엔은 9000. {@code expenses.amount} 와 같은
     * 규칙이라야 잡아 둔 것과 실제로 쓴 것을 나란히 놓을 수 있습니다.
     *
     * <p>위의 {@link #cost} 와 따로 둡니다. 하나로 합치려면 이미 적혀 있는
     * 글자를 숫자로 읽어야 하는데, 그것을 안 하기로 했습니다.
     */
    @Column(name = "cost_amount")
    private Integer costAmount;

    /** 위 금액의 통화. 금액이 없으면 이것도 없습니다. */
    @Column(name = "cost_currency", length = 3)
    private String costCurrency;

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

    /**
     * 이 장소가 처음 들어온 때.
     *
     * <p>{@code updatedAt} 과 같으면 아직 아무도 안 고친 것입니다. 소식함이
     * "넣었습니다" 와 "고쳤습니다" 를 가르는 데 씁니다 — 푸시가 그 순간에
     * 쓰는 말과 맞추기 위해서입니다.
     */
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by", length = 16)
    private String updatedBy;

    /**
     * 다녀온 때.
     *
     * <h3>도장은 여행의 것입니다</h3>
     *
     * <p>사람마다 따로 찍고 있었습니다. "같은 여행을 가도 누구는 들르고 누구는
     * 지나칠 수 있다" 는 생각이었는데, 실제로는 같은 일정을 같이 다닙니다.
     * 그래서 셋이 간 여행에서 진행률이 셋 다 달랐고, 「0/57 다녀옴」 이 누구의
     * 숫자인지 알 수 없었습니다.
     *
     * <p>그 자리에서 남기는 사진·별점·한 줄도 여행의 것입니다. 한동안 사람마다
     * 따로 두었는데("국물이 진했다" 는 내 감상이니까), 그러면 한 장소에 세
     * 덩어리가 나란히 서고 남이 올린 것은 손댈 수가 없습니다 — 같이 다녀온
     * 자리의 기록인데 흐린 사진 하나를 바꾸는 데도 올린 사람이 앱을 열어야
     * 했습니다.
     */
    @Column(name = "visited_at")
    private Instant visitedAt;

    /** 처음 찍은 사람. 누가 그 자리에 있었는지 남겨 둡니다. */
    @Column(name = "visited_by", length = 16)
    private String visitedBy;

    /** 몇 점이었는지. 1~5, 안 매기면 비어 있습니다. */
    private Short stars;

    /**
     * 다녀와서 남긴 말. "국물이 진해요" 같은 것.
     *
     * <p>위의 note 와 다릅니다 — 그쪽은 <b>가기 전에</b> 적어 두는 메모이고
     * 이쪽은 <b>다녀와서</b> 남기는 말입니다. 둘을 한 칸에 담으면 계획과 겪은
     * 일이 섞이고, 여행기에 "예약 확인할 것" 이 실립니다.
     */
    @Column(length = 200)
    private String review;

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
                 Integer costAmount, String costCurrency,
                 String note, String url, Integer radius, Boolean fit, String move,
                 String placeId, String icon, String updatedBy) {
        this.id = Ids.next();
        this.dayId = dayId;
        this.sort = sort;
        this.name = name;
        this.ja = ja;
        this.en = en;
        this.lat = lat;
        this.lng = lng;
        this.cat = cat;
        this.icon = PlaceKind.clean(icon);
        this.time = time;
        this.cost = cost;
        this.costAmount = costAmount;
        this.costCurrency = costCurrency;
        this.note = note;
        this.url = url;
        this.radius = radius;
        this.fit = fit == null || fit;
        this.move = move;
        this.placeId = placeId;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        this.updatedBy = updatedBy;
    }

    public void touch(String userId) {
        this.updatedAt = Instant.now();
        this.updatedBy = userId;
    }
}
