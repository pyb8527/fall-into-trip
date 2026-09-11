package net.weeniebeenie.fit.news.application;

import java.time.Instant;

/**
 * 고쳐진 장소 한 줄.
 *
 * <p>{@code bornAt} 과 {@code at} 이 같으면 아직 아무도 안 고친 것입니다 —
 * 방금 들어온 장소입니다.
 *
 * <p><b>따로 선 파일인 이유:</b> 질의가 {@code SELECT new ...} 로 이 모양을
 * 직접 만듭니다. 안쪽에 넣으면 JPQL 이 부를 이름이 {@code Outer$Inner} 가
 * 되고, 그 모양은 되는 자리와 안 되는 자리가 갈립니다.
 */
public record PlaceRow(String name, String dayLabel, String tripId, String tripTitle,
                       String actorId, Instant bornAt, Instant at) {
}
