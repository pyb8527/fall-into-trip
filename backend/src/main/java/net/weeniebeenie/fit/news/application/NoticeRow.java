package net.weeniebeenie.fit.news.application;

import java.time.Instant;

/**
 * 남이 고친 여행 안내판.
 *
 * <p>여행마다 글 한 장이라 접을 것이 없습니다. 마지막으로 고친 사람과
 * 시각만 남습니다.
 */
public record NoticeRow(String tripId, String tripTitle, String actorId, Instant at) {
}
