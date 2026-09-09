package net.weeniebeenie.fit.community.application;

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
import java.util.List;

/**
 * 올라온 일정에 달리는 댓글.
 *
 * <p>구경만 하라고 올린 글에 훈수가 달리면 반갑지 않습니다. 글쓴이가 피드백을
 * 받겠다고 열어 둔 글에만 달 수 있습니다.
 *
 * <p>특정 장소를 가리킬 수 있습니다. "둘째 날 이 집 말고 옆집이 낫다" 는 어디에
 * 대한 말인지가 붙어 있어야 뜻이 통합니다.
 */
@Service
@RequiredArgsConstructor
public class CommentService {

    /** 한 사람이 한 글에 남길 수 있는 수. 한 글을 혼자 채우는 것을 막습니다. */
    private static final int MAX_PER_POST = 20;

    /** 이만큼 신고가 쌓이면 사람이 볼 때까지 감춥니다. */
    private static final long HIDE_AT_REPORTS = 3;

    private static final int MAX_LENGTH = 500;

    private final PostCommentRepository comments;
    private final CommentReportRepository reports;
    private final TripPostRepository posts;
    private final UserRepository users;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<Card> listOf(String postId, String meId) {
        List<Card> out = new ArrayList<>();
        for (PostComment c : comments.findAllByPostIdAndHiddenFalseOrderByCreatedAtAsc(postId)) {
            out.add(cardOf(c, meId));
        }
        return out;
    }

    @Transactional
    public PostComment add(AuthPrincipal me, String postId, String text,
                           Integer dayIndex, Integer placeIndex) {
        TripPost post = posts.findById(postId)
                .filter(p -> !p.isHidden())
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없습니다."));
        if (!post.isFeedback()) {
            throw ApiException.badRequest("이 글은 의견을 받지 않습니다.");
        }

        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("남길 말을 적어 주세요.");
        }
        if (clean.length() > MAX_LENGTH) {
            throw ApiException.badRequest("댓글은 " + MAX_LENGTH + "자까지입니다.");
        }
        if (comments.countByUserIdAndPostId(me.id(), postId) >= MAX_PER_POST) {
            throw ApiException.badRequest("한 글에는 " + MAX_PER_POST + "개까지 남길 수 있습니다.");
        }

        PostComment comment = comments.save(PostComment.builder()
                .postId(postId)
                .userId(me.id())
                .text(clean)
                /* 어느 장소인지 둘 다 있어야 뜻이 있습니다. 하나만 오면 버립니다. */
                .dayIndex(placeIndex == null ? null : dayIndex)
                .placeIndex(dayIndex == null ? null : placeIndex)
                .build());
        audit.log(me.id(), "comment.add", comment.getId());
        return comment;
    }

    /** 글쓴이도 자기 글에 달린 것을 지울 수 있습니다. 자기 마당이기 때문입니다. */
    @Transactional
    public void remove(AuthPrincipal me, String commentId) {
        PostComment comment = comments.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없습니다."));
        boolean mine = comment.getUserId().equals(me.id());
        boolean host = posts.findById(comment.getPostId())
                .map(p -> p.getAuthorId().equals(me.id()))
                .orElse(false);
        if (!mine && !host && me.role() != Role.ADMIN) {
            throw ApiException.forbidden("내가 남긴 것만 지울 수 있습니다.");
        }
        comments.delete(comment);
        audit.log(me.id(), mine ? "comment.remove" : "comment.remove.host", commentId);
    }

    @Transactional
    public void report(AuthPrincipal me, String commentId, String reason) {
        PostComment comment = comments.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없습니다."));
        if (comment.getUserId().equals(me.id())) {
            throw ApiException.badRequest("내가 남긴 것은 신고할 수 없습니다.");
        }
        if (reports.existsByCommentIdAndUserId(commentId, me.id())) {
            throw ApiException.badRequest("이미 신고했습니다.");
        }
        reports.save(new CommentReport(commentId, me.id(),
                reason == null || reason.isBlank() ? null : reason.trim()));

        if (reports.countByCommentId(commentId) >= HIDE_AT_REPORTS) {
            comment.setHidden(true);
        }
        audit.log(me.id(), "comment.report", commentId);
    }

    public long countOf(String postId) {
        return comments.countByPostIdAndHiddenFalse(postId);
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
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없습니다."));
        comment.setHidden(hidden);
        audit.log(me.id(), hidden ? "comment.hide" : "comment.unhide", commentId);
    }

    public Card cardOf(PostComment c, String meId) {
        return new Card(c.getId(), c.getText(), nameOf(c.getUserId()),
                c.getUserId().equals(meId), c.getDayIndex(), c.getPlaceIndex(), c.getCreatedAt());
    }

    public String nameOf(String userId) {
        return users.findById(userId).map(User::getName).orElse("알 수 없음");
    }

    /**
     * @param mine       내가 남긴 것인지
     * @param dayIndex   가리키는 장소. 없으면 일정 전체에 대한 말입니다.
     */
    public record Card(String id, String text, String authorName, boolean mine,
                       Integer dayIndex, Integer placeIndex, Instant createdAt) {
    }
}
