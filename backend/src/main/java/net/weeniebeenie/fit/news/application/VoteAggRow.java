package net.weeniebeenie.fit.news.application;

import java.time.Instant;

/**
 * 후보 하나에 모인 표를 <b>한 줄로 접은</b> 것.
 *
 * <p>동행자 다섯에 후보 서른이면 표가 백쉰 개까지 갑니다. 접지 않으면 그것이
 * 목록을 통째로 먹습니다.
 *
 * @param people 표를 던진 사람 수
 * @param yes    그중 좋다고 한 사람 수. 한 사람일 때 좋다·아니라를 가리는 데
 *               씁니다
 */
public record VoteAggRow(String name, String tripId, String tripTitle,
                         long people, long yes, Instant at, String actorId) {
}
