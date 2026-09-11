package net.weeniebeenie.fit.news.application;

import java.time.Instant;

/**
 * 내 글 하나에 붙은 것들을 <b>한 줄로 접은</b> 것.
 *
 * <p>추천 하나를 소식 한 줄로 올리면, 글 하나가 좀 받은 날 목록이 그것만으로
 * 찹니다. 서른 줄이 전부 "추천했습니다" 가 되고 동행자가 고친 일정은 그
 * 아래로 밀려납니다. 소식함은 <b>내가 없는 동안 무엇이 바뀌었나</b>를 보는
 * 자리이지 인기를 세는 자리가 아닙니다.
 *
 * @param people   몇 사람인지. 세는 것은 데이터베이스가 합니다 — 몇 줄만
 *                 읽어 와서 세면 "외 29명" 처럼 아는 것보다 적게 말하게 됩니다
 * @param actorId  <b>한 사람일 때만</b> 그 사람입니다. 여럿이면 이름을 안
 *                 붙입니다 — 누구누구인지는 들어가서 볼 일입니다
 */
public record PostAggRow(String postId, String postTitle, long people,
                         Instant at, String actorId) {
}
