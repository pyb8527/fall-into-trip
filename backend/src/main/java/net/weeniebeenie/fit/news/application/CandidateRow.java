package net.weeniebeenie.fit.news.application;

import java.time.Instant;

/** 새로 올라온 후보 한 줄. */
public record CandidateRow(String name, String tripId, String tripTitle,
                           String actorId, Instant at) {
}
