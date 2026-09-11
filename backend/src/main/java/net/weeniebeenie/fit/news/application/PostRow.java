package net.weeniebeenie.fit.news.application;

import java.time.Instant;

/** 내 글에 붙은 것 하나. 추천과 댓글이 같은 모양을 씁니다. */
public record PostRow(String postId, String postTitle, String actorId, Instant at) {
}
