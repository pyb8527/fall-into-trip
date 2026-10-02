package net.weeniebeenie.fit.news.application;

import java.time.Instant;

/**
 * 내 모임에서 일어난 일 한 줄.
 *
 * <p>여행에 걸리는 것({@link PlaceRow})과 글에 걸리는 것({@link PostAggRow})
 * 사이에 비어 있던 자리입니다. 모임이 생긴 뒤로 「누가 들어왔나」와 「누가
 * 피드에 올렸나」가 어디에도 안 떴습니다 — 들어가서 보지 않으면 몰랐습니다.
 *
 * @param groupId   눌러 들어갈 곳
 * @param groupName 모임 이름. 여러 모임에 든 사람에게는 이것이 있어야
 *                  어느 모임 일인지 압니다
 * @param about     피드 글이면 그 글 번호. 들어온 사람 소식에는 없습니다
 * @param actorId   한 사람일 때만. 여럿이면 이름을 안 붙입니다
 */
public record GroupRow(String groupId, String groupName, String about,
                       long people, Instant at, String actorId) {
}
