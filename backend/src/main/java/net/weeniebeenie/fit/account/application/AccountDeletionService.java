package net.weeniebeenie.fit.account.application;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserIdentityRepository;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.KakaoLogin;
import net.weeniebeenie.fit.photo.application.PhotoStore;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 회원 탈퇴 — 계정과 그 사람의 데이터를 지웁니다.
 *
 * <h3>한 자리에서 한 번에</h3>
 *
 * <p>사람이 스스로 지우는 것({@link #withdraw})과 운영자가 지우는 것
 * ({@code AdminUserService.delete})이 <b>같은 길</b>을 탑니다. 운영자 삭제는
 * 여행 주인이거나 지출 기록이 있으면 막혔는데, 그 까닭이 「무엇을 어디로
 * 옮기는가」를 아무도 정하지 않았기 때문이었습니다. 그것을 여기서 정하고, 두
 * 길이 같이 씁니다 — 갈라 두면 한쪽만 고쳐지는 날이 옵니다.
 *
 * <h3>차례</h3>
 *
 * <p>모두 한 트랜잭션입니다. 중간에 하나라도 실패하면 아무것도 안 지워집니다.
 *
 * <ol>
 *   <li><b>내가 주인인 여행</b> — 같이 보는 사람이 있으면 넘기고, 혼자면
 *       지웁니다. 친구들이 같이 짠 일정이 내 탈퇴로 사라지면 안 됩니다</li>
 *   <li><b>내가 주인인 모임</b> — 같은 규칙입니다</li>
 *   <li><b>「탈퇴한 사람」으로 바꾸기</b> — 지출의 낸 사람 · 적은 사람 ·
 *       나눌 사람, 장소의 고친 사람, 챙길 것을 만든 사람. 지우면 남은 사람의
 *       정산이 바뀝니다({@link User#WITHDRAWN_ID})</li>
 *   <li><b>세션 끊기</b> — 다른 기기의 로그인도 바로 끝납니다</li>
 *   <li><b>지울 사진 파일 모으기</b> — 줄은 CASCADE 로 사라지지만 디스크의
 *       파일은 안 따라옵니다</li>
 *   <li><b>계정 줄 지우기</b> — 글 · 댓글 · 사진 · 보석함 · 위치 · 소셜 연결은
 *       외래키의 CASCADE 가 함께 데려갑니다</li>
 *   <li><b>커밋된 뒤에</b> 파일 지우기 · 카카오 연결 끊기 · 감사 기록</li>
 * </ol>
 *
 * <h3>파일은 커밋된 뒤에 지웁니다</h3>
 *
 * <p>트랜잭션 안에서 지우면, 그 뒤에 무언가 실패해 DB 가 되돌아갔을 때 줄은
 * 살아 있는데 그림이 없는 사진이 남습니다. 거꾸로 커밋 뒤에 지우다 실패하면
 * 파일 몇 개가 디스크에 남을 뿐이고, 그것은 나중에 치울 수 있습니다.
 *
 * <h3>감사 기록에는 번호만 남깁니다</h3>
 *
 * <p>이메일 · 이름을 남기지 않습니다. 「지체 없이, 복구할 수 없게」
 * (개인정보보호법 21조) 지운다고 해 놓고 기록에 주소를 남기면 지운 것이
 * 아닙니다. 번호만으로도 부정 이용을 따라가는 데는 충분합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    /** 비밀번호가 없는 사람이 「방금 로그인했다」로 인정받는 시간. */
    private static final Duration RECENT = Duration.ofMinutes(10);

    private final EntityManager em;
    private final UserRepository users;
    private final UserIdentityRepository identities;
    private final RefreshTokenService sessions;
    private final LoginAttemptService attempts;
    private final PasswordEncoder encoder;
    private final KakaoLogin kakao;
    private final PhotoStore store;
    private final AuditService audit;

    /* ------------------------------------------------------------ 미리 보기 */

    /**
     * 탈퇴하면 무엇이 어떻게 되는지 — 지우기 전에 보여 줍니다.
     *
     * <p>「내가 주인인 여행 3개가 누구에게 넘어가는지」를 모르고 누르게 하면
     * 안 됩니다. 넘겨받을 사람을 고르는 규칙은 실제로 지울 때와 <b>같은
     * 질의</b>를 씁니다 — 미리 보기와 실제가 어긋나면 미리 보기가 거짓말이
     * 됩니다.
     *
     * @param confirm  무엇으로 다시 확인하는지. {@code password} 비밀번호 ·
     *                 {@code kakao} 카카오로 다시 확인 · {@code recent}
     *                 10분 안에 다시 로그인
     * @param ready    지금 그 확인이 되어 있는지. {@code password} 는 늘
     *                 false 입니다 — 누를 때 적어 보냅니다
     */
    public record Preview(String confirm, boolean ready, List<Owned> trips, List<Owned> groups) {
    }

    /**
     * 내가 주인인 것 하나와 그 행방.
     *
     * @param heirId   넘겨받을 사람. 비어 있으면 지워집니다
     * @param heirName 그 사람 이름
     */
    public record Owned(String id, String name, String heirId, String heirName) {
    }

    @Transactional(readOnly = true)
    public Preview preview(String userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요해요."));

        String confirm = confirmOf(user);
        boolean ready = switch (confirm) {
            case "kakao" -> kakao.withdrawGrant(userId).isPresent();
            case "recent" -> recentlySignedIn(user);
            default -> false;
        };

        List<Owned> trips = new ArrayList<>();
        for (Object[] row : rows("SELECT id, title FROM trips WHERE owner_id = :me ORDER BY created_at",
                Map.of("me", userId))) {
            Object[] heir = tripHeir((String) row[0], userId);
            trips.add(new Owned((String) row[0], (String) row[1],
                    heir == null ? null : (String) heir[0], heir == null ? null : (String) heir[1]));
        }
        List<Owned> groups = new ArrayList<>();
        for (Object[] row : rows("SELECT id, name FROM groups WHERE owner_id = :me ORDER BY created_at",
                Map.of("me", userId))) {
            Object[] heir = groupHeir((String) row[0], userId);
            groups.add(new Owned((String) row[0], (String) row[1],
                    heir == null ? null : (String) heir[0], heir == null ? null : (String) heir[1]));
        }
        return new Preview(confirm, ready, trips, groups);
    }

    /* ------------------------------------------------------------ 탈퇴 */

    /**
     * 스스로 탈퇴합니다.
     *
     * <h3>다시 확인합니다</h3>
     *
     * <p>로그인해 둔 폰을 남이 잠깐 들고 있을 때 계정이 통째로 사라지면 안
     * 됩니다. 되돌릴 수 없는 일이라 지금 손에 든 사람이 주인인지를 한 번 더
     * 봅니다.
     *
     * <ul>
     *   <li><b>카카오를 이어 둔 사람</b> — 카카오로 다시 확인해야 합니다. 그때
     *       받은 토큰으로 카카오 연결도 끊습니다({@link KakaoLogin#authorizeUrlToWithdraw})</li>
     *   <li><b>비밀번호가 있는 사람</b> — 지금 비밀번호를 적습니다</li>
     *   <li><b>구글로만 들어오는 사람</b> — 10분 안에 다시 로그인했어야 합니다.
     *       구글은 서버가 쥔 토큰이 없어 끊을 것도, 다시 물을 것도 없습니다</li>
     * </ul>
     *
     * <p>틀린 비밀번호는 로그인과 같은 한도로 셉니다. 남의 세션을 쥔 사람이
     * 여기서 비밀번호를 찍어 보는 통로가 되면 안 됩니다.
     */
    @Transactional
    public void withdraw(String userId, String password) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요해요."));

        String kakaoToken = null;
        switch (confirmOf(user)) {
            case "kakao" -> kakaoToken = kakao.withdrawGrant(userId)
                    .orElseThrow(() -> ApiException.forbidden(
                            "카카오로 다시 확인한 뒤에 탈퇴할 수 있어요. 확인한 지 10분이 지났으면 다시 해 주세요."));
            case "password" -> {
                String key = "withdraw|" + userId;
                attempts.checkAllowed(key);
                if (!encoder.matches(password == null ? "" : password, user.getPasswordHash())) {
                    attempts.recordFailure(key);
                    throw ApiException.badRequest("비밀번호가 올바르지 않아요.");
                }
                attempts.reset(key);
            }
            default -> {
                if (!recentlySignedIn(user)) {
                    throw ApiException.forbidden("안전을 위해 다시 로그인한 뒤 10분 안에 탈퇴해 주세요.");
                }
            }
        }

        erase(userId, userId, "user.withdraw", kakaoToken);
    }

    /**
     * 운영자가 지웁니다. 「자기 자신은 안 됨 · 마지막 운영자는 안 됨」은
     * 부르는 쪽({@code AdminUserService})이 먼저 봅니다.
     *
     * <p>카카오 연결은 못 끊습니다 — 그 사람의 토큰이 없고, Admin 키는 두지
     * 않습니다. 계정과 소셜 연결 줄은 지워지므로, 그 사람이 다시 카카오로
     * 들어오면 새 계정으로 시작합니다.
     */
    @Transactional
    public void eraseByAdmin(String actorId, String userId) {
        erase(userId, actorId, "admin.user.delete", null);
    }

    private void erase(String userId, String actorId, String action, String kakaoToken) {
        if (User.WITHDRAWN_ID.equals(userId)) {
            throw ApiException.badRequest("이 계정은 지울 수 없어요. 탈퇴한 사람들의 자리예요.");
        }
        /* 앞에서 읽어 둔 것을 먼저 내보냅니다. 아래는 SQL 로 직접 지우므로
           그 뒤에 엔티티가 따로 쓰이면 안 됩니다. */
        em.flush();

        Map<String, Object> me = Map.of("me", userId);
        Map<String, Integer> done = new LinkedHashMap<>();

        /* 1. 내가 주인인 여행. */
        int handedTrips = 0, droppedTrips = 0;
        for (Object[] row : rows("SELECT id FROM trips WHERE owner_id = :me", me)) {
            String tripId = (String) row[0];
            Object[] heir = tripHeir(tripId, userId);
            if (heir != null) {
                /* version 을 올립니다. 옛 화면이 들고 있던 여행을 그대로 저장하면
                   주인이 되돌아가지 않게 — 낙관적 잠금이 그 저장을 물립니다. */
                update("UPDATE trips SET owner_id = :heir, version = version + 1 WHERE id = :trip",
                        Map.of("heir", heir[0], "trip", tripId));
                handedTrips++;
            } else {
                update("DELETE FROM trips WHERE id = :trip", Map.of("trip", tripId));
                droppedTrips++;
            }
        }
        done.put("tripsHanded", handedTrips);
        done.put("tripsDeleted", droppedTrips);

        /* 2. 내가 주인인 모임. */
        int handedGroups = 0, droppedGroups = 0;
        for (Object[] row : rows("SELECT id FROM groups WHERE owner_id = :me", me)) {
            String groupId = (String) row[0];
            Object[] heir = groupHeir(groupId, userId);
            if (heir != null) {
                /* GroupService.handOver 와 같은 세 줄입니다 — 멤버 표의 자리와
                   groups.owner_id 가 늘 같은 사람을 가리켜야 합니다. 내 줄은
                   아래에서 계정과 함께 사라지지만, 그 전까지도 주인이 둘이면
                   안 됩니다. */
                update("UPDATE group_members SET role = 'MEMBER' WHERE group_id = :g AND user_id = :me",
                        Map.of("g", groupId, "me", userId));
                update("UPDATE group_members SET role = 'OWNER' WHERE group_id = :g AND user_id = :heir",
                        Map.of("g", groupId, "heir", heir[0]));
                update("UPDATE groups SET owner_id = :heir WHERE id = :g",
                        Map.of("g", groupId, "heir", heir[0]));
                handedGroups++;
            } else {
                /* GroupService.delete 와 같습니다. 여행은 그룹에서 떼기만 하고
                   (ON DELETE SET NULL), 글에 달린 댓글은 먼저 치웁니다 — 댓글은
                   글에 외래키가 없어 안 따라갑니다. */
                update("""
                        DELETE FROM post_comments
                        WHERE kind = 'FEED'
                          AND post_id IN (SELECT id FROM posts WHERE group_id = :g)
                        """, Map.of("g", groupId));
                update("DELETE FROM groups WHERE id = :g", Map.of("g", groupId));
                droppedGroups++;
            }
        }
        done.put("groupsHanded", handedGroups);
        done.put("groupsDeleted", droppedGroups);

        /* 3. 「탈퇴한 사람」으로 바꾸기. */
        Map<String, Object> swap = Map.of("me", userId, "gone", User.WITHDRAWN_ID);
        int paid = update("""
                UPDATE expenses SET payer_id = :gone, version = version + 1
                WHERE payer_id = :me
                """, swap);
        update("UPDATE expenses SET created_by = :gone WHERE created_by = :me", swap);
        /*
          나눌 사람 목록(JSONB 배열) 안의 번호.

          <p>차례를 지키며 바꿉니다. 이미 「탈퇴한 사람」이 들어 있는
          목록이면(먼저 탈퇴한 동행자) 둘이 하나로 합쳐집니다 — 같은 번호가
          두 번 들어가면 정산이 그 자리에 몫을 두 번 매깁니다.
        */
        int shared = update("""
                UPDATE expenses e
                SET share = (
                        SELECT jsonb_agg(x.v ORDER BY x.first)
                        FROM (
                            SELECT CASE WHEN t.el = :me THEN :gone ELSE t.el END AS v,
                                   min(t.ord) AS first
                            FROM jsonb_array_elements_text(e.share) WITH ORDINALITY AS t(el, ord)
                            GROUP BY 1
                        ) x),
                    version = version + 1
                WHERE jsonb_typeof(e.share) = 'array'
                  AND e.share @> jsonb_build_array(CAST(:me AS text))
                """, swap);
        update("UPDATE places SET updated_by = :gone WHERE updated_by = :me", swap);
        update("UPDATE trip_items SET created_by = :gone WHERE created_by = :me", swap);
        done.put("expensesPaid", paid);
        done.put("expensesShared", shared);

        /*
          내 글에 남이 단 댓글.

          <p>글은 author_id 의 CASCADE 로 사라지지만 댓글은 글에 외래키가 없어
          (CommentKind) 안 따라갑니다. 열어 볼 글이 없는 댓글이 운영 화면에
          영영 남지 않게 먼저 치웁니다. 내가 단 댓글은 user_id 의 CASCADE 가
          데려갑니다.
        */
        update("""
                DELETE FROM post_comments
                WHERE (kind = 'FEED' AND post_id IN (SELECT id FROM posts WHERE author_id = :me))
                   OR (kind = 'JOURNAL' AND post_id IN (SELECT id FROM trip_posts WHERE author_id = :me))
                """, me);

        /* 4. 세션. 줄은 아래에서 CASCADE 로 사라지지만, 그 전에 끊어 둡니다 —
              이 트랜잭션이 도는 사이에 다른 기기가 토큰을 갈아 끼우지 못하게. */
        sessions.revokeAllOf(userId);

        /* 5. 지울 사진 파일. 줄이 사라지기 전에 번호를 걷어 둡니다. */
        List<String> photoIds = new ArrayList<>();
        for (Object[] row : rows("SELECT id FROM photos WHERE owner_id = :me", me)) {
            photoIds.add((String) row[0]);
        }
        done.put("photos", photoIds.size());

        /* 6. 계정. 나머지는 CASCADE 가 데려갑니다. */
        update("DELETE FROM users WHERE id = :me", me);
        /* 앞에서 읽어 둔 엔티티(나 · 내 소셜 연결)가 지운 줄을 가리키지 않게. */
        em.clear();

        /* 7. 커밋된 뒤에. */
        String token = kakaoToken;
        afterCommit(() -> {
            photoIds.forEach(store::drop);
            if (token != null) {
                done.put("kakaoUnlinked", kakao.unlink(token) ? 1 : 0);
                kakao.dropWithdrawGrant(userId);
            }
            audit.log(actorId, action, userId, done);
        });
    }

    /* ------------------------------------------------------------ 넘겨받을 사람 */

    /**
     * 여행을 넘겨받을 사람.
     *
     * <p>여행을 같이 보는 사람은 그 여행이 든 모임의 멤버입니다
     * ({@code TripAccessPolicy}). 혼자 여행이면 아무도 없습니다.
     *
     * <p>모임의 주인이 먼저입니다 — 모임 일을 맡은 사람이 그 안의 여행도 맡는
     * 편이 자연스럽습니다. 그다음은 먼저 들어온 사람, 같으면 먼저 가입한
     * 사람입니다. 잠긴 계정은 맨 뒤로 보냅니다 — 손댈 수 없는 사람에게
     * 넘기면 아무도 손댈 수 없는 여행이 됩니다.
     *
     * <p>내가 그 모임의 주인이었다면 주인 자리는 나라서 빠지고, 먼저 들어온
     * 사람이 받습니다 — 아래 {@link #groupHeir} 와 같은 사람이 됩니다.
     *
     * @return {@code [id, name]}. 없으면 null
     */
    private Object[] tripHeir(String tripId, String userId) {
        List<Object[]> got = rows("""
                SELECT m.user_id, u.name
                FROM trips t
                JOIN group_members m ON m.group_id = t.group_id
                JOIN users u ON u.id = m.user_id
                WHERE t.id = :trip AND m.user_id <> :me
                ORDER BY CASE WHEN u.disabled THEN 1 ELSE 0 END,
                         CASE WHEN m.role = 'OWNER' THEN 0 ELSE 1 END,
                         m.joined_at, u.created_at
                LIMIT 1
                """, Map.of("trip", tripId, "me", userId));
        return got.isEmpty() ? null : got.get(0);
    }

    /** 모임을 넘겨받을 사람. 먼저 들어온 사람, 같으면 먼저 가입한 사람입니다. */
    private Object[] groupHeir(String groupId, String userId) {
        List<Object[]> got = rows("""
                SELECT m.user_id, u.name
                FROM group_members m
                JOIN users u ON u.id = m.user_id
                WHERE m.group_id = :g AND m.user_id <> :me
                ORDER BY CASE WHEN u.disabled THEN 1 ELSE 0 END, m.joined_at, u.created_at
                LIMIT 1
                """, Map.of("g", groupId, "me", userId));
        return got.isEmpty() ? null : got.get(0);
    }

    /* ------------------------------------------------------------ 도우미 */

    /**
     * 무엇으로 다시 확인하는지.
     *
     * <p>카카오를 이어 둔 사람은 카카오가 먼저입니다. 연결을 끊을 토큰을 받는
     * 길이 그것뿐이라, 비밀번호가 있어도 카카오로 확인합니다. 서버가 카카오를
     * 꺼 두었으면 다녀올 수가 없으므로 다음 것으로 넘어갑니다.
     */
    private String confirmOf(User user) {
        if (kakao.enabled()
                && identities.findByUserIdAndProvider(user.getId(), KakaoLogin.KAKAO).isPresent()) {
            return "kakao";
        }
        return user.hasPassword() ? "password" : "recent";
    }

    private static boolean recentlySignedIn(User user) {
        Instant at = user.getLastLoginAt();
        return at != null && at.isAfter(Instant.now().minus(RECENT));
    }

    /**
     * 커밋된 뒤에 합니다.
     *
     * <p>트랜잭션 밖에서 불렸으면(그럴 일은 없지만) 바로 합니다 — 기다릴
     * 커밋이 없습니다.
     */
    private static void afterCommit(Runnable work) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            work.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    work.run();
                } catch (RuntimeException e) {
                    /* 계정은 이미 지워졌습니다. 여기서 터져도 되돌릴 것이 없고,
                       응답만 실패로 바뀌어 사람을 헷갈리게 합니다. */
                    log.warn("탈퇴 뒷정리를 다 하지 못했어요: {}", e.toString());
                }
            }
        });
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> rows(String sql, Map<String, Object> params) {
        var query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        List<Object[]> out = new ArrayList<>();
        for (Object row : (List<Object>) query.getResultList()) {
            /* 한 칸만 고르면 배열이 아니라 값 하나가 옵니다. 모양을 맞춥니다. */
            out.add(row instanceof Object[] cells ? cells : new Object[]{row});
        }
        return out;
    }

    private int update(String sql, Map<String, Object> params) {
        var query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query.executeUpdate();
    }
}
