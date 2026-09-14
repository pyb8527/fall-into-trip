package net.weeniebeenie.fit.news.application;

/**
 * 내가 남긴 한 줄들이 얼마나 쓰였는지.
 *
 * <p>위쪽 소식과 성격이 다릅니다. 소식은 읽으면 지나가지만 이것은
 * <b>사라지지 않고 쌓입니다.</b> 그래서 목록에 줄로 섞지 않고 아래에 요약
 * 한 줄로 둡니다.
 *
 * @param tips  내가 남긴 한 줄의 수. 내려간 것은 빼고 셉니다
 * @param views 그것들이 쓰인 <b>횟수</b>. 사람 수가 아닙니다 — 같은 사람이
 *              다른 날 다시 읽으면 그것도 한 번 쓰인 것입니다
 */
public record MineRow(long tips, long views) {
}
