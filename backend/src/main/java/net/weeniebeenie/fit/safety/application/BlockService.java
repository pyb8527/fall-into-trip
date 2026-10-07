package net.weeniebeenie.fit.safety.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.safety.domain.UserBlock;
import net.weeniebeenie.fit.safety.domain.UserBlockRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 사람 막기.
 *
 * <h3>막으면 무엇이 달라지나</h3>
 *
 * <ul>
 *   <li><b>서로의 글이 안 보입니다</b> — 여행기 · 댓글 · 한 줄 팁 · 피드.
 *       한쪽만 거르면 막힌 사람이 막은 사람의 글에 계속 댓글을 달 수 있고,
 *       그 댓글은 막은 사람의 글 아래에 서서 남들이 봅니다. 그래서 양쪽을
 *       다 거릅니다({@link #hiddenFor})</li>
 *   <li><b>프로필이 비어 보입니다</b> — 이름은 두고 소개 · 사진 · 우리 사이를
 *       비웁니다. 막은 사람은 거기서 「차단 풀기」를 누를 수 있어야 해서
 *       404 로 닫지 않습니다</li>
 *   <li><b>막은 사람이 만든 초대 링크로 못 들어옵니다</b> — 링크가 새어
 *       나가 막힌 사람 손에 들어가도 막은 사람의 모임에 못 섭니다</li>
 * </ul>
 *
 * <h3>안 바뀌는 것</h3>
 *
 * <p>이미 함께 쓰는 여행과 모임은 그대로입니다. 여행은 여럿이 함께 쓰는
 * 것이라, 한 사람이 다른 한 사람을 막았다고 일정 · 가계부가 둘로 갈라지면
 * 나머지 사람들의 여행이 깨집니다. 화면이 막기 전에 이 말을 합니다.
 *
 * <h3>조용히 막습니다</h3>
 *
 * <p>막힌 사람에게 알리지 않습니다. 알리면 막은 사람이 다른 길로 시달립니다.
 * 막힌 사람 쪽에서 보이는 것은 「그 사람의 글이 안 보인다」뿐이고, 그것은
 * 그 사람이 글을 안 쓴 것과 구별되지 않습니다.
 */
@Service
@RequiredArgsConstructor
public class BlockService {

    private final UserBlockRepository blocks;
    private final UserRepository users;
    private final AuditService audit;

    @Transactional
    public void block(AuthPrincipal me, String userId) {
        if (me.id().equals(userId)) {
            throw ApiException.badRequest("나는 차단할 수 없어요.");
        }
        if (!users.existsById(userId)) {
            throw ApiException.notFound("찾을 수 없어요.");
        }
        /* 두 번 눌러도 한 줄입니다. 「이미 차단했어요」로 막으면 화면이 늦게
           받아 온 상태로 단추를 한 번 더 그렸을 때 사람이 오류를 봅니다. */
        if (blocks.existsByBlockerIdAndBlockedId(me.id(), userId)) {
            return;
        }
        blocks.save(new UserBlock(me.id(), userId));
        audit.log(me.id(), "user.block", userId);
    }

    @Transactional
    public void unblock(AuthPrincipal me, String userId) {
        blocks.findById(new UserBlock.Key(me.id(), userId)).ifPresent(b -> {
            blocks.delete(b);
            audit.log(me.id(), "user.unblock", userId);
        });
    }

    /** 내가 막은 사람들. 설정의 차단 목록이 씁니다. */
    @Transactional(readOnly = true)
    public List<Blocked> listOf(AuthPrincipal me) {
        List<UserBlock> mine = blocks.findAllByBlockerIdOrderByCreatedAtDesc(me.id());
        Map<String, User> who = new HashMap<>();
        users.findAllById(mine.stream().map(UserBlock::getBlockedId).toList())
                .forEach(u -> who.put(u.getId(), u));
        return mine.stream().map(b -> {
            User u = who.get(b.getBlockedId());
            return new Blocked(b.getBlockedId(),
                    u == null ? "알 수 없음" : u.getName(),
                    u == null ? null : u.getMark(),
                    u == null ? null : u.getPhotoId(),
                    b.getCreatedAt());
        }).toList();
    }

    /**
     * 이 사람에게 안 보여야 할 사람들 — 내가 막은 사람과 나를 막은 사람.
     *
     * <p>목록 한 번에 한 번 부릅니다. 사람이 막은 수는 많아야 몇이라 질의
     * 둘로 끝납니다. 손님(로그인 안 함)은 빈 집합입니다 — 막을 사람이 없습니다.
     */
    @Transactional(readOnly = true)
    public Set<String> hiddenFor(String viewerId) {
        if (viewerId == null) {
            return Set.of();
        }
        Set<String> out = new HashSet<>();
        blocks.findAllByBlockerIdOrderByCreatedAtDesc(viewerId).forEach(b -> out.add(b.getBlockedId()));
        blocks.findAllByBlockedId(viewerId).forEach(b -> out.add(b.getBlockerId()));
        return out;
    }

    /** 둘 사이에 어느 쪽으로든 막음이 있는가. 글 하나를 열 때 씁니다. */
    @Transactional(readOnly = true)
    public boolean between(String a, String b) {
        if (a == null || b == null || a.equals(b)) {
            return false;
        }
        return blocks.existsByBlockerIdAndBlockedId(a, b) || blocks.existsByBlockerIdAndBlockedId(b, a);
    }

    /** {@code blocker} 가 {@code blocked} 를 막았는가 — 한쪽만 봅니다. */
    @Transactional(readOnly = true)
    public boolean hasBlocked(String blocker, String blocked) {
        if (blocker == null || blocked == null) {
            return false;
        }
        return blocks.existsByBlockerIdAndBlockedId(blocker, blocked);
    }

    /**
     * 차단 목록 한 줄.
     *
     * @param blockedAt 막은 때. 「언제 막았더라」가 풀지 말지를 정하는 데 듭니다
     */
    public record Blocked(String id, String name, String mark, String photoId, Instant blockedAt) {
    }
}
