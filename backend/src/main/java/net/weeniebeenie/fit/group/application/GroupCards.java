package net.weeniebeenie.fit.group.application;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * 모임 목록 카드에 얹을 것 — 누가 있나, 최근에 무슨 일이 있었나, 최근 사진.
 *
 * <h3>모임마다 묻지 않습니다</h3>
 *
 * <p>목록 한 번에 모임 수만큼 질의가 붙으면, 모임 열 개인 사람은 목록을 열 때마다
 * 서른 번을 왕복합니다. 내가 든 모임 전부를 한 번에 긁어 와서 모임별로
 * 나눕니다 — 사람 한 번, 글 한 번, 사진 한 번, 이름 한 번.
 *
 * <h3>내가 든 모임 것만</h3>
 *
 * <p>모임 번호를 부르는 쪽(GroupController.mine)이 <b>내가 든 모임</b>으로만
 * 넘깁니다. 여기서 받는 번호 밖의 글·사람은 한 줄도 안 읽습니다 — 안 든
 * 모임의 활동이 섞이면 안 됩니다.
 *
 * <h3>어느 표를 읽는지 손으로 적습니다</h3>
 *
 * <p>모임 · 피드 · 계정 세 묶음을 잇습니다. 그 이음을 각 묶음의 저장소에 넣으면
 * 묶음끼리 서로를 알게 되니, 소식(NewsFeed)처럼 이쪽에서 JPQL 로 읽습니다.
 */
@Component
@RequiredArgsConstructor
public class GroupCards {

    /** 카드에 그리는 얼굴 수. 겹쳐 그리는 자리가 넷까지입니다. */
    private static final int FACES = 4;

    /** 카드 아래 사진 수. */
    private static final int PHOTOS = 3;

    private final EntityManager em;
    private final UserRepository users;

    /** 카드 하나에 얹는 것. */
    public record Card(List<Face> faces, Activity activity, List<String> photoIds, boolean fresh) {
    }

    public record Face(String name, String mark) {
    }

    /**
     * @param kind {@code feed.post} 또는 {@code group.join}
     */
    public record Activity(String kind, String actorName, Instant at) {
    }

    @Transactional(readOnly = true)
    public Map<String, Card> of(Collection<String> groupIds, String me, Instant seenAt) {
        if (groupIds.isEmpty()) {
            return Map.of();
        }

        /* 사람. 주인이 맨 앞, 그다음 들어온 차례. */
        List<Object[]> memberRows = em.createQuery("""
                        SELECT m.id.groupId, m.id.userId, m.role, m.joinedAt
                        FROM GroupMember m
                        WHERE m.id.groupId IN :ids
                        ORDER BY m.joinedAt ASC
                        """, Object[].class)
                .setParameter("ids", groupIds)
                .getResultList();

        /* 글. 숨긴 것은 안 셉니다. 모임마다 맨 앞 몇 개만 쓰므로 넉넉히 잘라 받습니다. */
        List<Object[]> postRows = em.createQuery("""
                        SELECT p.groupId, p.id, p.authorId, p.createdAt
                        FROM Post p
                        WHERE p.groupId IN :ids AND p.hidden = false
                        ORDER BY p.createdAt DESC
                        """, Object[].class)
                .setParameter("ids", groupIds)
                .setMaxResults(groupIds.size() * 10)
                .getResultList();

        List<String> postIds = postRows.stream().map(r -> (String) r[1]).toList();
        Map<String, List<String>> photosOfPost = new HashMap<>();
        if (!postIds.isEmpty()) {
            for (Object[] r : em.createQuery("""
                            SELECT pp.postId, pp.photoId
                            FROM PostPhoto pp
                            WHERE pp.postId IN :ids
                            ORDER BY pp.sort ASC
                            """, Object[].class)
                    .setParameter("ids", postIds)
                    .getResultList()) {
                photosOfPost.computeIfAbsent((String) r[0], k -> new ArrayList<>()).add((String) r[1]);
            }
        }

        /* 이름은 한 번에. */
        Set<String> who = new HashSet<>();
        memberRows.forEach(r -> who.add((String) r[1]));
        postRows.forEach(r -> who.add((String) r[2]));
        Map<String, User> byId = new HashMap<>();
        users.findAllById(who).forEach(u -> byId.put(u.getId(), u));

        Map<String, Card> out = new HashMap<>();
        for (String gid : groupIds) {
            List<Object[]> mine = memberRows.stream().filter(r -> gid.equals(r[0])).toList();
            List<Face> faces = mine.stream()
                    .sorted(Comparator.comparing((Object[] r) -> !"OWNER".equals(String.valueOf(r[2]))))
                    .limit(FACES)
                    .map(r -> byId.get((String) r[1]))
                    .filter(Objects::nonNull)
                    .map(u -> new Face(u.getName(), u.getMark()))
                    .toList();

            List<Object[]> posts = postRows.stream().filter(r -> gid.equals(r[0])).toList();

            /* 최근 활동 — 남이 한 것 중 가장 늦은 글 또는 들어옴. 내가 한 일은 안 냅니다. */
            Activity latest = null;
            for (Object[] r : posts) {
                if (!me.equals(r[2])) {
                    User u = byId.get((String) r[2]);
                    latest = new Activity("feed.post", u == null ? "누군가" : u.getName(), (Instant) r[3]);
                    break;
                }
            }
            for (Object[] r : mine) {
                Instant at = (Instant) r[3];
                /* 만든 사람이 만든 순간도 「들어옴」이라 뺍니다 — 모임이 생긴 것은 소식이 아닙니다. */
                if (me.equals(r[1]) || "OWNER".equals(String.valueOf(r[2]))) {
                    continue;
                }
                if (latest == null || at.isAfter(latest.at())) {
                    User u = byId.get((String) r[1]);
                    latest = new Activity("group.join", u == null ? "누군가" : u.getName(), at);
                }
            }

            List<String> photos = new ArrayList<>();
            for (Object[] r : posts) {
                for (String ph : photosOfPost.getOrDefault((String) r[1], List.of())) {
                    if (photos.size() < PHOTOS) {
                        photos.add(ph);
                    }
                }
                if (photos.size() >= PHOTOS) {
                    break;
                }
            }

            boolean fresh = latest != null && (seenAt == null || latest.at().isAfter(seenAt));
            out.put(gid, new Card(faces, latest, photos, fresh));
        }
        return out;
    }
}
