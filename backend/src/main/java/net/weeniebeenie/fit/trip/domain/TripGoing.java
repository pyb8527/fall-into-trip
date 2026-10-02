package net.weeniebeenie.fit.trip.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 이 여행에 가는지 하는 답 하나.
 *
 * <h3>이 자리가 비어 있었습니다</h3>
 *
 * <p>{@link TripAccessPolicy#peopleOf} 가 그룹 여행이면 <b>그룹 멤버 전부</b>를
 * 돌려줍니다. 그룹을 들이기 전에는 여행마다 사람을 불렀으니 「부른 사람 =
 * 가는 사람」이었는데, 여행 멤버를 그룹 멤버로 합치면서 그 둘이 갈렸고
 * 아무도 그 자리를 채우지 않았습니다.
 *
 * <p>열두 명 모임에서 넷이 가는 여행이면 넷이 다 좋다고 해도 합의가 안 되고
 * (4/12), 지출이 열두 명에게 나뉩니다.
 *
 * <h3>줄이 없으면 「아직 몰라요」입니다</h3>
 *
 * <p>여행을 만들 때 멤버 수만큼 줄을 깔지 않습니다. 답한 사람만 줄이 생기고,
 * 안 답한 사람은 {@link GoingAnswer#MAYBE} 로 봅니다 — 셈에 남는 쪽입니다.
 */
@Entity
@Table(name = "trip_going")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TripGoing {

    @EmbeddedId
    private TripGoingId id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private GoingAnswer answer = GoingAnswer.MAYBE;

    /**
     * 「셋째 날만 못 가요」 같은 것.
     *
     * <p><b>모두에게 보입니다.</b> 주최자만 보는 자리를 두지 않기로 했으므로
     * (정원·질문지를 안 받은 것과 같은 까닭), 적는 사람도 그걸 알고 적어야
     * 합니다.
     */
    @Column(length = 200)
    private String note;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public TripGoing(String tripId, String userId, GoingAnswer answer, String note) {
        this.id = new TripGoingId(tripId, userId);
        this.answer = answer == null ? GoingAnswer.MAYBE : answer;
        this.note = note;
        this.updatedAt = Instant.now();
    }
}
