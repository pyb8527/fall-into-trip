package net.weeniebeenie.fit.news.application;

import java.time.Instant;

/** 후보에 던진 표 한 줄. {@code yes} 가 좋다·아니라를 가릅니다. */
public record VoteRow(String name, String tripId, String tripTitle,
                      String actorId, boolean yes, Instant at) {
}
