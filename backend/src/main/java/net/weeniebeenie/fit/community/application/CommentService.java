package net.weeniebeenie.fit.community.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.community.domain.*;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 올라온 일정에 달리는 댓글.
 *
 * <p>구경만 하라고 올린 글에 훈수가 달리면 반갑지 않습니다. 글쓴이가 피드백을
 * 받겠다고 열어 둔 글에만 달 수 있습니다.
 *
 * <p>특정 장소를 가리킬 수 있습니다. "둘째 날 이 집 말고 옆집이 낫다" 는 어디에
 * 대한 말인지가 붙어 있어야 뜻이 통합니다.
 *
 * <h3>피드 글의 댓글도 여기 있습니다</h3>
 *
 * <p>표 하나를 둘이 나눠 씁니다({@link CommentKind}). 신고·숨김·운영 화면이
 * 이미 이 표를 보고 있어서, 표를 또 파면 그 셋이 두 벌이 됩니다.
 *
 * <p>규칙은 갈립니다. 여행기 댓글은 <b>글쓴이가 열어 둔 글에만</b> 달리고
 * 장소를 가리킬 수 있습니다. 피드 댓글은 <b>그 글을 볼 수 있으면</b> 달리고
 * 가리킬 장소가 없습니다 — 모임에 올린 사진에 한마디 하는 자리라, 열고 닫는
 * 것을 물으면 그 물음 자체가 거추장스럽습니다.
 *
 * <p>누가 볼 수 있는지는 여기서 안 봅니다. 부르는 쪽(FeedController)이 글을
 * 집으면서 이미 보았고, 그 규칙은 피드가 가지고 있어야 할 것입니다.
 */
@Service
@RequiredArgsConstructor
public class CommentService {

    /** 한 사람이 한 글에 남길 수 있는 수. 한 글을 혼자 채우는 것을 막습니다. */
    private static final int MAX_PER_POST = 20;

    /** 이만큼 신고가 쌓이면 사람이 볼 때까지 감춥니다. */
    private static final long HIDE_AT_REPORTS = 3;

    private static final int MAX_LENGTH = 500;

    /**
     * 「내가 남긴 것」 목록에서 피드 글의 앞머리를 몇 자까지 적을지.
     *
     * <p>어느 글인지 가릴 만큼입니다. 더 길게 보내면 남의 글이 내 댓글보다
     * 길어져서, 목록에서 어느 쪽이 내가 쓴 것인지 안 보입니다.
     */
    private static final int HEAD_LENGTH = 40;

    private final PostCommentRepository comments;
    private final CommentReportRepository reports;
    private final TripPostRepository posts;
    /* 피드 글의 글쓴이를 찾을 때만 씁니다 — 제 마당의 댓글을 지우는 자리. */
    private final net.weeniebeenie.fit.feed.domain.PostRepository feedPosts;
    private final UserRepository users;
    private final AuditService audit;
    /* 여행기의 사본을 풀어 가리킨 장소 이름을 꺼낼 때만 씁니다 — mine(). */
    private final ObjectMapper mapper;

    /** 여행기 댓글. */
    @Transactional(readOnly = true)
    public List<Card> listOf(String postId, String meId) {
        return listOf(postId, CommentKind.JOURNAL, meId);
    }

    /** 피드 글 댓글. */
    @Transactional(readOnly = true)
    public List<Card> listOfFeed(String postId, String meId) {
        return listOf(postId, CommentKind.FEED, meId);
    }

    private List<Card> listOf(String postId, CommentKind kind, String meId) {
        List<Card> out = new ArrayList<>();
        for (PostComment c :
                comments.findAllByPostIdAndKindAndHiddenFalseOrderByCreatedAtAsc(postId, kind)) {
            out.add(cardOf(c, meId));
        }
        return out;
    }

    @Transactional
    public PostComment add(AuthPrincipal me, String postId, String text,
                           Integer dayIndex, Integer placeIndex) {
        TripPost post = posts.findById(postId)
                .filter(p -> !p.isHidden())
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없어요."));
        if (!post.isFeedback()) {
            throw ApiException.badRequest("이 글은 의견을 받지 않아요.");
        }

        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("남길 말을 적어 주세요.");
        }
        if (clean.length() > MAX_LENGTH) {
            throw ApiException.badRequest("댓글은 " + MAX_LENGTH + "자까지예요.");
        }
        if (comments.countByUserIdAndPostId(me.id(), postId) >= MAX_PER_POST) {
            throw ApiException.badRequest("한 글에는 " + MAX_PER_POST + "개까지 남길 수 있어요.");
        }

        PostComment comment = comments.save(PostComment.builder()
                .postId(postId)
                .kind(CommentKind.JOURNAL)
                .userId(me.id())
                .text(clean)
                /* 어느 장소인지 둘 다 있어야 뜻이 있습니다. 하나만 오면 버립니다. */
                .dayIndex(placeIndex == null ? null : dayIndex)
                .placeIndex(dayIndex == null ? null : placeIndex)
                .build());
        audit.log(me.id(), "comment.add", comment.getId());
        return comment;
    }

    /**
     * 피드 글에 한마디.
     *
     * <p>열고 닫는 것을 안 묻습니다. 모임에 올린 사진에 한마디 하는 자리라,
     * 그 물음 자체가 거추장스럽습니다. 볼 수 있으면 답니다 — 그것을 본
     * 자리는 부르는 쪽입니다.
     *
     * <p>가리킬 장소도 없습니다. 글 한 편이 통째로 하나의 이야기입니다.
     */
    @Transactional
    public PostComment addToFeed(AuthPrincipal me, String postId, String text) {
        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("남길 말을 적어 주세요.");
        }
        if (clean.length() > MAX_LENGTH) {
            throw ApiException.badRequest("댓글은 " + MAX_LENGTH + "자까지예요.");
        }
        if (comments.countByUserIdAndPostId(me.id(), postId) >= MAX_PER_POST) {
            throw ApiException.badRequest("한 글에는 " + MAX_PER_POST + "개까지 남길 수 있어요.");
        }

        PostComment comment = comments.save(PostComment.builder()
                .postId(postId)
                .kind(CommentKind.FEED)
                .userId(me.id())
                .text(clean)
                .build());
        audit.log(me.id(), "feed.comment.add", comment.getId());
        return comment;
    }

    /**
     * 남긴 말을 고칩니다.
     *
     * <h3>지우기와 달리 글쓴이는 못 고칩니다</h3>
     *
     * <p>{@link #remove} 는 제 마당에 달린 것을 글쓴이도 치울 수 있습니다.
     * 고치기는 <b>남긴 사람만</b>입니다 — 남의 말을 고치는 것은 치우는 것과
     * 다른 일이고, 하지 말아야 할 일입니다. 운영자도 뺍니다. 문제되는 댓글에
     * 운영자가 할 수 있는 일은 감추는 것({@link #setHidden})이고, 말을 바꿔
     * 두면 신고한 사람이 본 글과 확인하는 사람이 보는 글이 달라집니다.
     *
     * <p>가리키는 장소({@code dayIndex}·{@code placeIndex})는 안 바꿉니다.
     * 「여기 말고 옆집」을 다른 집으로 옮기면 뜻이 통째로 달라지므로 그것은
     * 고치는 일이 아니라 <b>새로 남기는 일</b>입니다.
     *
     * <p>한 글에 몇 개까지({@code MAX_PER_POST})는 안 봅니다. 고치는 것은
     * 수를 늘리지 않습니다 — 거기서 막으면 스무 개를 채운 사람이 제 오타를
     * 영영 못 고칩니다.
     */
    @Transactional
    public PostComment edit(AuthPrincipal me, String commentId, String text) {
        PostComment comment = comments.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없어요."));
        if (!comment.getUserId().equals(me.id())) {
            throw ApiException.forbidden("내가 남긴 것만 고칠 수 있어요.");
        }

        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("남길 말을 적어 주세요.");
        }
        if (clean.length() > MAX_LENGTH) {
            throw ApiException.badRequest("댓글은 " + MAX_LENGTH + "자까지예요.");
        }

        comment.setText(clean);
        comment.setEditedAt(Instant.now());
        audit.log(me.id(), "comment.edit", commentId);
        return comment;
    }

    /**
     * 내가 남긴 댓글 — 여행기와 피드 글에 달린 것이 한 목록에.
     *
     * <h3>줄마다 어디에 남긴 것인지가 붙어야 합니다</h3>
     *
     * <p>댓글만 늘어놓으면 못 씁니다. 「여기 말고 옆집이 나아요」 가 어느 글의
     * 어느 집에 대한 말인지 없으면, 제가 쓴 것을 읽고도 무엇에 대한 말인지
     * 모릅니다. 그래서 글 이름과(있으면) 가리킨 장소를 함께 냅니다.
     *
     * <p>갈래를 안 가립니다({@link CommentKind} 둘 다). 남긴 사람에게는 둘이
     * 같은 일입니다 — 찾을 때 어느 표에 든 것인지는 알 바가 아닙니다.
     * <b>장소에 남긴 것은 여기 없습니다</b>: 장소에 대한 말은 댓글이 아니라
     * 한 줄 리뷰({@code tip.PlaceTip})이고, 그쪽은 {@code /api/me/reviews} 가
     * 이미 냅니다. 한 목록에 섞으면 고치는 길도 지우는 길도 둘이 됩니다.
     *
     * <h3>글이 없어진 것도 냅니다</h3>
     *
     * <p>{@code post_id} 에 외래키가 없어서 글이 지워질 때 댓글을 치우는
     * 일이 코드 쪽에 있습니다({@link CommentKind}). 빠뜨린 자리가 있으면
     * 가리킬 글이 없는 댓글이 남는데, 그것을 목록에서 빼 버리면 <b>지울 길도
     * 같이 사라집니다</b> — 제 것인데 아무 화면에도 안 뜨는 글이 됩니다.
     * {@code gone} 으로 표시해 내려보내고, 화면이 「없어진 글」로 적고 고치기
     * 대신 지우기만 엽니다.
     *
     * <h3>글은 쪽마다 한 번씩만 묻습니다</h3>
     *
     * <p>줄마다 글을 찾으면 쪽 하나에 스무 번입니다. 번호를 모아 두 표에 한
     * 번씩 묻습니다 — 같은 글에 여러 개 달아 둔 경우가 흔해서 대개 그보다도
     * 적게 걸립니다.
     */
    @Transactional(readOnly = true)
    public Page<Mine> mine(AuthPrincipal me, Pageable pageable) {
        Page<PostComment> page =
                comments.findAllByUserIdAndHiddenFalseOrderByCreatedAtDesc(me.id(), pageable);

        List<String> journalIds = page.getContent().stream()
                .filter(c -> c.getKind() == CommentKind.JOURNAL)
                .map(PostComment::getPostId).distinct().toList();
        List<String> feedIds = page.getContent().stream()
                .filter(c -> c.getKind() == CommentKind.FEED)
                .map(PostComment::getPostId).distinct().toList();

        Map<String, TripPost> journals = new HashMap<>();
        if (!journalIds.isEmpty()) {
            posts.findAllById(journalIds).forEach(p -> journals.put(p.getId(), p));
        }
        Map<String, net.weeniebeenie.fit.feed.domain.Post> stories = new HashMap<>();
        if (!feedIds.isEmpty()) {
            feedPosts.findAllById(feedIds).forEach(p -> stories.put(p.getId(), p));
        }

        /* 사본은 글 하나에 한 번만 풉니다. 같은 글에 장소 댓글이 셋 달려
           있으면 세 번 푸는 일이 되는데, 사본은 통째로 든 jsonb 입니다. */
        Map<String, JsonNode> snapshots = new HashMap<>();

        return page.map(c -> {
            if (c.getKind() == CommentKind.FEED) {
                var story = stories.get(c.getPostId());
                return new Mine(c.getId(), c.getKind(), c.getPostId(), c.getText(),
                        c.getCreatedAt(), c.getEditedAt(),
                        story == null ? null : headOf(story.getText()), null, story == null);
            }
            TripPost post = journals.get(c.getPostId());
            if (post == null) {
                return new Mine(c.getId(), c.getKind(), c.getPostId(), c.getText(),
                        c.getCreatedAt(), c.getEditedAt(), null, null, true);
            }
            return new Mine(c.getId(), c.getKind(), c.getPostId(), c.getText(),
                    c.getCreatedAt(), c.getEditedAt(), post.getTitle(),
                    placeOf(snapshots, post, c.getDayIndex(), c.getPlaceIndex()), false);
        });
    }

    /**
     * 피드 글의 앞머리 — 그 글이 어느 글인지 가릴 만큼만.
     *
     * <p>피드 글에는 제목이 없습니다({@code feed.Post} 는 {@code text} 하나).
     * 그래서 첫 줄의 앞머리를 제목 자리에 씁니다 — 두 줄 세 줄을 다 보내면
     * 내 댓글보다 남의 글이 길어져서 어느 쪽이 내가 쓴 것인지 안 보입니다.
     *
     * <p>사진만 올린 글은 글자가 없습니다. 그때는 비워 보내고 화면이
     * 「피드 글」이라고 적습니다.
     */
    private String headOf(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String head = text.strip().lines().findFirst().orElse("").strip();
        return head.length() <= HEAD_LENGTH ? head : head.substring(0, HEAD_LENGTH) + "…";
    }

    /**
     * 가리킨 장소의 이름 — 「2일차 · 이치란」.
     *
     * <p>사본에서 꺼냅니다. 번호는 <b>사본의 자리</b>를 가리키고, 사본은 올릴
     * 때 뜬 것이라 나중에 바뀌지 않습니다({@code PostComment}).
     *
     * <p>사본을 못 풀어도 목록은 그대로 냅니다. {@code PostService.snapshotOf}
     * 는 같은 자리에서 500 을 던지는데, 그쪽은 <b>그 글 하나를 여는 일</b>이라
     * 못 풀면 보여 줄 것이 없습니다. 여기서는 스무 줄 가운데 한 줄의 꼬리표라,
     * 글 하나가 깨졌다고 내가 남긴 것 전부가 안 보이면 안 됩니다.
     */
    private String placeOf(Map<String, JsonNode> snapshots, TripPost post,
                           Integer dayIndex, Integer placeIndex) {
        if (dayIndex == null || placeIndex == null) {
            return null;
        }
        JsonNode snapshot = snapshots.computeIfAbsent(post.getId(), id -> {
            try {
                return mapper.readTree(post.getSnapshot());
            } catch (Exception e) {
                return mapper.createObjectNode();
            }
        });
        JsonNode day = snapshot.path("days").path(dayIndex);
        JsonNode place = day.path("places").path(placeIndex);
        if (place.path("name").isMissingNode() || place.path("name").asText("").isBlank()) {
            return null;
        }
        String when = day.path("shortName").asText("");
        if (when.isBlank()) {
            when = day.path("label").asText(dayIndex + 1 + "일차");
        }
        return when + " · " + place.path("name").asText();
    }

    /** 글쓴이도 자기 글에 달린 것을 지울 수 있습니다. 자기 마당이기 때문입니다. */
    @Transactional
    public void remove(AuthPrincipal me, String commentId) {
        PostComment comment = comments.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없어요."));
        boolean mine = comment.getUserId().equals(me.id());
        /* 어느 표의 글인지 보고 그 글쓴이를 찾습니다. 한 칸이 두 표를
           가리키므로(CommentKind) 종류를 안 보면 엉뚱한 표를 뒤집니다. */
        boolean host = comment.getKind() == CommentKind.FEED
                ? feedPosts.findById(comment.getPostId())
                        .map(p -> p.getAuthorId().equals(me.id())).orElse(false)
                : posts.findById(comment.getPostId())
                        .map(p -> p.getAuthorId().equals(me.id())).orElse(false);
        if (!mine && !host && me.role() != Role.ADMIN) {
            throw ApiException.forbidden("내가 남긴 것만 지울 수 있어요.");
        }
        comments.delete(comment);
        audit.log(me.id(), mine ? "comment.remove" : "comment.remove.host", commentId);
    }

    @Transactional
    public void report(AuthPrincipal me, String commentId, String reason) {
        PostComment comment = comments.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없어요."));
        if (comment.getUserId().equals(me.id())) {
            throw ApiException.badRequest("내가 남긴 것은 신고할 수 없어요.");
        }
        if (reports.existsByCommentIdAndUserId(commentId, me.id())) {
            throw ApiException.badRequest("이미 신고했어요.");
        }
        reports.save(new CommentReport(commentId, me.id(),
                reason == null || reason.isBlank() ? null : reason.trim()));

        if (reports.countByCommentId(commentId) >= HIDE_AT_REPORTS) {
            comment.setHidden(true);
        }
        audit.log(me.id(), "comment.report", commentId);
    }

    public long countOf(String postId) {
        return comments.countByPostIdAndKindAndHiddenFalse(postId, CommentKind.JOURNAL);
    }

    /* ------------------------------------------------------------- 운영 */

    @Transactional(readOnly = true)
    public Page<PostComment> needingReview(Pageable pageable) {
        return comments.findNeedingReview(pageable);
    }

    public long reportCountOf(String commentId) {
        return reports.countByCommentId(commentId);
    }

    @Transactional
    public void setHidden(AuthPrincipal me, String commentId, boolean hidden) {
        PostComment comment = comments.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없어요."));
        comment.setHidden(hidden);
        audit.log(me.id(), hidden ? "comment.hide" : "comment.unhide", commentId);
    }

    public Card cardOf(PostComment c, String meId) {
        return new Card(c.getId(), c.getText(), nameOf(c.getUserId()),
                c.getUserId().equals(meId), c.getDayIndex(), c.getPlaceIndex(), c.getCreatedAt(),
                c.getUserId(), c.getEditedAt());
    }

    public String nameOf(String userId) {
        return users.findById(userId).map(User::getName).orElse("알 수 없음");
    }

    /**
     * @param mine       내가 남긴 것인지
     * @param dayIndex   가리키는 장소. 없으면 일정 전체에 대한 말입니다.
     */
    /**
     * @param authorId 이름을 누르면 그 사람 페이지로 갈 때 씁니다
     * @param editedAt 고친 때. <b>비어 있으면 안 고친 것입니다.</b> 읽는 쪽에
     *                 「고침」을 띄우는 데 씁니다 — 위아래가 서로 받는 글이라,
     *                 자취 없이 바뀌면 아래 대답이 위 물음에 안 맞게 됩니다
     */
    public record Card(String id, String text, String authorName, boolean mine,
                       Integer dayIndex, Integer placeIndex, Instant createdAt, String authorId,
                       Instant editedAt) {
    }

    /**
     * 「내가 남긴 것」 목록의 한 줄.
     *
     * <p>{@link Card} 와 가르는 까닭은 보는 방향이 거꾸로라서입니다. 카드는
     * <b>글에서 아래로</b> 읽는 자리라 누가 남긴 것인지(이름·내 것인지)가
     * 필요하고 어느 글인지는 화면이 이미 압니다. 이쪽은 <b>사람에서</b> 읽는
     * 자리라 그 둘이 뒤집힙니다 — 남긴 사람은 늘 나이고, 모르는 것이 어느
     * 글인지입니다.
     *
     * @param kind      여행기에 달린 것인지 피드 글인지. 누를 때 갈 자리가
     *                  갈립니다 — {@code /community/[id]} 와 {@code /feed/[id]}
     * @param postTitle 여행기는 제목, 피드 글은 앞머리. 사진만 올린 피드 글은
     *                  적을 글자가 없어 비어 있습니다
     * @param where     가리킨 장소 — 「2일차 · 이치란」. 일정 전체에 대한
     *                  말이면 비어 있습니다
     * @param gone      가리킬 글이 없어진 것인지. 화면이 「없어진 글」로 적고
     *                  고치기 대신 지우기만 엽니다
     */
    public record Mine(String id, CommentKind kind, String postId, String text,
                       Instant createdAt, Instant editedAt,
                       String postTitle, String where, boolean gone) {
    }
}
