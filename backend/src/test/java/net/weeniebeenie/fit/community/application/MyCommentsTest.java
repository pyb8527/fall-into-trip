package net.weeniebeenie.fit.community.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.community.domain.CommentKind;
import net.weeniebeenie.fit.community.domain.CommentReportRepository;
import net.weeniebeenie.fit.community.domain.PostComment;
import net.weeniebeenie.fit.community.domain.PostCommentRepository;
import net.weeniebeenie.fit.community.domain.TripPost;
import net.weeniebeenie.fit.community.domain.TripPostRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 「내가 남긴 것」 — 고치는 자격과 줄마다 붙는 꼬리표.
 *
 * <h3>고칠 수 있는 사람이 지울 수 있는 사람보다 좁습니다</h3>
 *
 * <p>{@code remove} 는 셋이 할 수 있습니다 — 남긴 사람, 제 마당에 달린 것을
 * 치우는 글쓴이, 그리고 운영자. {@code edit} 은 <b>남긴 사람 하나</b>입니다.
 * 남의 말을 고치는 것은 치우는 것과 다른 일이고, 하지 말아야 할 일입니다.
 *
 * <p>눈으로는 안 갈립니다. 두 메서드가 나란히 서 있고 둘 다 「내가 남긴
 * 것만」으로 시작하는 문장을 던지므로, 지우기 쪽 조건을 그대로 베껴 오는
 * 것이 가장 자연스러운 손놀림입니다. 그러면 글쓴이가 남의 댓글을 제 뜻으로
 * 바꿔 쓸 수 있게 됩니다 — 아무 화면에도 자취가 안 남습니다.
 *
 * <h3>줄마다 어디에 남긴 것인지가 붙어야 합니다</h3>
 *
 * <p>댓글만 늘어놓으면 못 씁니다. 「여기 말고 옆집이 나아요」가 어느 글의
 * 어느 집에 대한 말인지 없으면, 제가 쓴 것을 읽고도 무엇에 대한 말인지
 * 모릅니다. 그 꼬리표가 갈리는 자리를 함께 짚습니다 — 장소를 가리킨 여행기
 * 댓글, 제목이 없는 피드 글, 그리고 없어진 글.
 */
@ExtendWith(MockitoExtension.class)
class MyCommentsTest {

    private static final String ME = "u-me";
    private static final String THEM = "u-them";

    private static final String TEXT = "여기 말고 옆집이 나아요";

    /** 올릴 때 뜬 사본. 가리키는 번호는 이 안의 자리입니다. */
    private static final String SNAPSHOT = """
            {"title":"오사카 사흘",
             "days":[{"label":"Day 1","shortName":"첫날","places":[{"name":"도톤보리"}]},
                     {"label":"Day 2","shortName":"둘쨋날","places":[{"name":"구로몬"},
                                                                    {"name":"이치란"}]}]}
            """;

    @Mock private PostCommentRepository comments;
    @Mock private CommentReportRepository reports;
    @Mock private TripPostRepository posts;
    @Mock private net.weeniebeenie.fit.feed.domain.PostRepository feedPosts;
    @Mock private UserRepository users;
    @Mock private AuditService audit;

    /* 가짜로 두지 않습니다. 사본을 푸는 일 자체가 여기서 짚는 것입니다. */
    @Spy private ObjectMapper mapper = new ObjectMapper();

    @InjectMocks private CommentService service;

    private AuthPrincipal who(String id, Role role) {
        return new AuthPrincipal(id, id + "@example.com", id, role);
    }

    private PostComment commentBy(String userId, CommentKind kind, String postId,
                                  Integer dayIndex, Integer placeIndex) {
        return PostComment.builder()
                .postId(postId)
                .kind(kind)
                .userId(userId)
                .text(TEXT)
                .dayIndex(dayIndex)
                .placeIndex(placeIndex)
                .build();
    }

    private TripPost journal(String snapshot) {
        return TripPost.builder()
                .authorId(THEM).title("오사카 사흘").snapshot(snapshot).build();
    }

    /** 그 한 줄만 든 쪽을 내려 주고, 그 줄의 {@code Mine} 을 돌려줍니다. */
    private CommentService.Mine rowOf(PostComment comment) {
        when(comments.findAllByUserIdAndHiddenFalseOrderByCreatedAtDesc(
                any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(comment)));
        return service.mine(who(ME, Role.MEMBER), PageRequest.of(0, 20)).getContent().get(0);
    }

    /* --------------------------------------------------------- 고칠 자격 */

    @Test
    @DisplayName("남이 남긴 댓글은 못 고친다")
    void othersAreNotEditable() {
        PostComment theirs = commentBy(THEM, CommentKind.JOURNAL, "p-1", null, null);
        when(comments.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.MEMBER), theirs.getId(), "내 뜻으로 바꿈"));

        assertEquals(HttpStatus.FORBIDDEN, thrown.getStatus());
        assertEquals("내가 남긴 것만 고칠 수 있어요.", thrown.getMessage());
        /* 글자가 그대로여야 합니다. 거절하면서 먼저 써 두면 거절한 뜻이
           없습니다. */
        assertEquals(TEXT, theirs.getText());
        assertNull(theirs.getEditedAt());
        verify(audit, never()).log(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("제 마당의 글쓴이도 남의 댓글은 못 고친다 — 지우기와 갈립니다")
    void hostCanRemoveButNotEdit() {
        PostComment theirs = commentBy(THEM, CommentKind.JOURNAL, "p-mine", null, null);
        when(comments.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        /* 내 마당입니다 — remove 라면 통하는 자리입니다. */
        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.MEMBER), theirs.getId(), "내 뜻으로 바꿈"));

        assertEquals(HttpStatus.FORBIDDEN, thrown.getStatus());
        /* 글쓴이인지 물으러 글을 찾아가지도 않습니다 — 물어볼 것이 없는
           조건이라, 묻는 코드가 생기면 그것이 곧 지우기 쪽에서 베껴 온
           자취입니다. */
        verify(posts, never()).findById(anyString());
        verify(feedPosts, never()).findById(anyString());
    }

    @Test
    @DisplayName("운영자도 못 고친다 — 할 수 있는 일은 감추는 것")
    void adminCannotEdit() {
        PostComment theirs = commentBy(THEM, CommentKind.FEED, "f-1", null, null);
        when(comments.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.ADMIN), theirs.getId(), "다듬어 둠"));

        assertEquals(HttpStatus.FORBIDDEN, thrown.getStatus());
        assertEquals(TEXT, theirs.getText());
    }

    @Test
    @DisplayName("내 댓글은 고쳐지고 고친 때가 찍힌다")
    void mineIsEditable() {
        PostComment mine = commentBy(ME, CommentKind.JOURNAL, "p-1", null, null);
        when(comments.findById(mine.getId())).thenReturn(Optional.of(mine));

        PostComment edited = service.edit(who(ME, Role.MEMBER), mine.getId(), "  옆집이 나아요  ");

        assertEquals("옆집이 나아요", edited.getText());
        assertNotNull(edited.getEditedAt());
        /* 처음 쓴 때는 안 건드립니다. 순서가 고친 순서로 뒤바뀌면 「내가
           언제 뭐라고 했는지」가 안 맞습니다. */
        assertFalse(edited.getCreatedAt().isAfter(edited.getEditedAt()));
        verify(audit).log(ME, "comment.edit", mine.getId());
    }

    @Test
    @DisplayName("빈 글로는 고칠 수 없다 — 지우는 길이 따로 있습니다")
    void blankIsRejected() {
        PostComment mine = commentBy(ME, CommentKind.JOURNAL, "p-1", null, null);
        when(comments.findById(mine.getId())).thenReturn(Optional.of(mine));

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.MEMBER), mine.getId(), "   "));

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
        assertEquals(TEXT, mine.getText());
    }

    @Test
    @DisplayName("없는 댓글에는 404 — 403 이면 있다는 말이 됩니다")
    void missingIsNotFound() {
        when(comments.findById("c-ghost")).thenReturn(Optional.empty());

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.MEMBER), "c-ghost", "뭐라도"));

        assertEquals(HttpStatus.NOT_FOUND, thrown.getStatus());
    }

    /* ------------------------------------------------------- 어디에 남겼나 */

    @Test
    @DisplayName("여행기 댓글에는 글 제목과 가리킨 장소가 붙는다")
    void journalRowCarriesPlace() {
        TripPost post = journal(SNAPSHOT);
        when(posts.findAllById(List.of(post.getId()))).thenReturn(List.of(post));

        CommentService.Mine row =
                rowOf(commentBy(ME, CommentKind.JOURNAL, post.getId(), 1, 1));

        assertEquals("오사카 사흘", row.postTitle());
        assertEquals("둘쨋날 · 이치란", row.where());
        assertEquals(CommentKind.JOURNAL, row.kind());
        assertFalse(row.gone());
    }

    @Test
    @DisplayName("일정 전체에 대한 말에는 장소가 안 붙는다")
    void wholeTripRowHasNoPlace() {
        TripPost post = journal(SNAPSHOT);
        when(posts.findAllById(List.of(post.getId()))).thenReturn(List.of(post));

        CommentService.Mine row =
                rowOf(commentBy(ME, CommentKind.JOURNAL, post.getId(), null, null));

        assertNull(row.where());
        assertEquals("오사카 사흘", row.postTitle());
    }

    @Test
    @DisplayName("피드 글에는 제목이 없어 글 앞머리가 제목 자리에 선다")
    void feedRowUsesTextHead() {
        net.weeniebeenie.fit.feed.domain.Post story =
                net.weeniebeenie.fit.feed.domain.Post.builder()
                        .authorId(THEM)
                        .text("이치란 다녀왔어요\n줄이 길었지만 먹을 만했습니다")
                        .build();
        when(feedPosts.findAllById(List.of(story.getId()))).thenReturn(List.of(story));

        CommentService.Mine row =
                rowOf(commentBy(ME, CommentKind.FEED, story.getId(), null, null));

        /* 첫 줄만입니다. 두 줄 세 줄을 다 보내면 남의 글이 내 댓글보다
           길어져서 어느 쪽이 내가 쓴 것인지 안 보입니다. */
        assertEquals("이치란 다녀왔어요", row.postTitle());
        assertEquals(CommentKind.FEED, row.kind());
        assertFalse(row.gone());
    }

    @Test
    @DisplayName("사진만 올린 피드 글에는 적을 앞머리가 없다")
    void photoOnlyFeedRowHasNoHead() {
        net.weeniebeenie.fit.feed.domain.Post story =
                net.weeniebeenie.fit.feed.domain.Post.builder().authorId(THEM).build();
        when(feedPosts.findAllById(List.of(story.getId()))).thenReturn(List.of(story));

        CommentService.Mine row =
                rowOf(commentBy(ME, CommentKind.FEED, story.getId(), null, null));

        /* 비어 있는 것과 없어진 것은 다릅니다. 화면이 「피드 글」이라고
           적고, 그 글로 갈 수는 있습니다. */
        assertNull(row.postTitle());
        assertFalse(row.gone());
    }

    @Test
    @DisplayName("글이 없어진 댓글도 목록에 남는다 — 빼면 지울 길이 사라집니다")
    void orphanStaysAndIsMarked() {
        when(feedPosts.findAllById(List.of("f-ghost"))).thenReturn(List.of());

        CommentService.Mine row =
                rowOf(commentBy(ME, CommentKind.FEED, "f-ghost", null, null));

        assertTrue(row.gone());
        assertNull(row.postTitle());
        /* 내가 쓴 글자는 그대로 보여 줍니다. 가리킬 글이 없어도 「내가 뭐라고
           했는지」는 남아 있고, 그것을 보고 지웁니다. */
        assertEquals(TEXT, row.text());
    }

    @Test
    @DisplayName("사본이 깨진 글 하나가 목록 전부를 막지 않는다")
    void brokenSnapshotOnlyLosesItsTag() {
        TripPost post = journal("{ 이건 json 이 아닙니다");
        when(posts.findAllById(List.of(post.getId()))).thenReturn(List.of(post));

        CommentService.Mine row =
                rowOf(commentBy(ME, CommentKind.JOURNAL, post.getId(), 0, 0));

        /* 꼬리표만 빕니다. 글 하나가 깨졌다고 내가 남긴 것 전부가 안 보이면
           안 됩니다 — PostService.snapshotOf 가 500 을 던지는 것은 그 글
           하나를 여는 자리라서입니다. */
        assertNull(row.where());
        assertEquals("오사카 사흘", row.postTitle());
    }

    @Test
    @DisplayName("한 쪽에 같은 글이 여럿 있어도 글은 표마다 한 번만 찾는다")
    void postsAreFetchedOncePerPage() {
        when(comments.findAllByUserIdAndHiddenFalseOrderByCreatedAtDesc(
                any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(
                        commentBy(ME, CommentKind.JOURNAL, "p-1", 1, 1),
                        commentBy(ME, CommentKind.JOURNAL, "p-1", 1, 0),
                        commentBy(ME, CommentKind.FEED, "f-1", null, null))));
        when(posts.findAllById(List.of("p-1"))).thenReturn(List.of());
        when(feedPosts.findAllById(List.of("f-1"))).thenReturn(List.of());

        service.mine(who(ME, Role.MEMBER), PageRequest.of(0, 20));

        /* 줄마다 찾으면 쪽 하나에 스무 번입니다. 번호를 모아 표마다 한
           번씩입니다 — 늘어난 질의는 화면에 아무 표도 안 내고, 느려진
           뒤에야 압니다. */
        verify(posts).findAllById(List.of("p-1"));
        verify(feedPosts).findAllById(List.of("f-1"));
        verify(posts, never()).findById(anyString());
    }
}
