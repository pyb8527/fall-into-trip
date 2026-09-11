package net.weeniebeenie.fit.news.application;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

/**
 * 소식 재료를 긁어 오는 다섯 개의 질의.
 *
 * <h3>왜 여기에 있나</h3>
 *
 * <p>다섯 중 넷이 표 둘을 잇습니다 — 장소는 날짜를 거쳐 여행에 닿고, 표는
 * 후보를 거쳐, 추천과 댓글은 글을 거쳐 닿습니다. 그 이음을 {@code trip} 쪽
 * 저장소에 넣으면 여행 묶음이 게시판 사정을 알게 되고, 반대도 마찬가지입니다.
 *
 * <p>그래서 이음은 전부 이쪽으로 옵니다. {@code news} 가 양쪽을 읽고, 양쪽은
 * {@code news} 를 모릅니다. 한 방향입니다.
 *
 * <h3>왜 모양을 손으로 적는가</h3>
 *
 * <p>칸만 골라 놓고 하이버네이트에게 레코드로 알아서 담아 달라고 하면 대개
 * 됩니다. 그런데 {@link net.weeniebeenie.fit.trip.domain.CandidateVote} 는
 * 열쇠가 두 칸짜리라({@code @IdClass}) 그 자리에서 헛짚고, 여섯 칸을 고른
 * 질의가 글자 하나를 돌려주었다고 합니다.
 *
 * <p>그래서 {@code SELECT new} 로 못박습니다. 칸 수와 차례가 어긋나면 뜰
 * 때 바로 걸립니다 — 돌다가 500 이 나는 것보다 낫습니다.
 *
 * <h3>왜 하나하나 다른 질의인가</h3>
 *
 * <p>다섯을 한 번에 긁고 싶지만 JPQL 에 {@code union} 이 없고, 네이티브로
 * 내려가면 다섯 표의 칸 이름을 이 파일이 알게 됩니다. 그 값보다 다섯 번
 * 왕복하는 값이 쌉니다 — 어차피 한 사람이 앱을 열 때 한 번입니다.
 */
@Repository
@RequiredArgsConstructor
public class NewsFeed {

    private static final String ROW = "net.weeniebeenie.fit.news.application.";

    private final EntityManager em;

    /**
     * 내가 동행자인 여행에서 남이 고친 장소.
     *
     * <p>여행 번호로 <b>먼저</b> 좁힙니다. 뒤에서 한 줄씩 거르면 볼 수 없는
     * 것을 일단 읽어 온 뒤에 버리는 것이 되고, 거르는 조건 하나만 빠져도
     * 남의 여행이 그대로 나갑니다.
     */
    public List<PlaceRow> places(List<String> tripIds, String me, Instant since, int limit) {
        if (tripIds.isEmpty()) {
            return List.of();
        }
        return em.createQuery("""
                       SELECT new %sPlaceRow(
                              p.name, d.label, t.id, t.title, p.updatedBy, p.createdAt, p.updatedAt)
                       FROM Place p, Day d, Trip t
                       WHERE p.dayId = d.id AND d.tripId = t.id
                         AND t.id IN :tripIds
                         AND p.updatedAt > :since
                         AND p.updatedBy IS NOT NULL AND p.updatedBy <> :me
                       ORDER BY p.updatedAt DESC
                       """.formatted(ROW), PlaceRow.class)
                .setParameter("tripIds", tripIds)
                .setParameter("me", me)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
    }

    /** 남이 올린 후보. */
    public List<CandidateRow> candidates(List<String> tripIds, String me, Instant since, int limit) {
        if (tripIds.isEmpty()) {
            return List.of();
        }
        return em.createQuery("""
                       SELECT new %sCandidateRow(c.name, t.id, t.title, c.addedBy, c.createdAt)
                       FROM TripCandidate c, Trip t
                       WHERE c.tripId = t.id
                         AND t.id IN :tripIds
                         AND c.createdAt > :since
                         AND c.addedBy IS NOT NULL AND c.addedBy <> :me
                       ORDER BY c.createdAt DESC
                       """.formatted(ROW), CandidateRow.class)
                .setParameter("tripIds", tripIds)
                .setParameter("me", me)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
    }

    /**
     * 남이 던진 표.
     *
     * <p>후보를 거쳐 여행에 닿습니다. 표 자체에는 어느 여행인지가 없습니다 —
     * 그래서 후보가 내려가면 그 표도 여기서 저절로 빠집니다.
     */
    public List<VoteRow> votes(List<String> tripIds, String me, Instant since, int limit) {
        if (tripIds.isEmpty()) {
            return List.of();
        }
        return em.createQuery("""
                       SELECT new %sVoteRow(c.name, t.id, t.title, v.userId, v.yes, v.createdAt)
                       FROM CandidateVote v, TripCandidate c, Trip t
                       WHERE v.candidateId = c.id AND c.tripId = t.id
                         AND t.id IN :tripIds
                         AND v.createdAt > :since
                         AND v.userId <> :me
                       ORDER BY v.createdAt DESC
                       """.formatted(ROW), VoteRow.class)
                .setParameter("tripIds", tripIds)
                .setParameter("me", me)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
    }

    /**
     * 내 글에 붙은 추천.
     *
     * <p>내려간 글은 뺍니다. 운영자가 감춘 글의 소식이 글쓴이에게만 남아
     * 있으면, 눌러 들어가서 없는 글을 봅니다.
     */
    public List<PostRow> likes(String me, Instant since, int limit) {
        return em.createQuery("""
                       SELECT new %sPostRow(p.id, p.title, l.userId, l.createdAt)
                       FROM PostLike l, TripPost p
                       WHERE l.postId = p.id
                         AND p.authorId = :me AND p.hidden = false
                         AND l.createdAt > :since
                         AND l.userId <> :me
                       ORDER BY l.createdAt DESC
                       """.formatted(ROW), PostRow.class)
                .setParameter("me", me)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
    }

    /** 내 글에 달린 댓글. 감춰진 댓글과 내려간 글은 뺍니다. */
    public List<PostRow> comments(String me, Instant since, int limit) {
        return em.createQuery("""
                       SELECT new %sPostRow(p.id, p.title, c.userId, c.createdAt)
                       FROM PostComment c, TripPost p
                       WHERE c.postId = p.id
                         AND p.authorId = :me AND p.hidden = false
                         AND c.hidden = false
                         AND c.createdAt > :since
                         AND c.userId <> :me
                       ORDER BY c.createdAt DESC
                       """.formatted(ROW), PostRow.class)
                .setParameter("me", me)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
    }
}
