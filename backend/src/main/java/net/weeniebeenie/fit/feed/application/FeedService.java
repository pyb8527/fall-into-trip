package net.weeniebeenie.fit.feed.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.community.domain.CommentKind;
import net.weeniebeenie.fit.community.domain.PostCommentRepository;
import net.weeniebeenie.fit.feed.domain.Post;
import net.weeniebeenie.fit.feed.domain.PostPhoto;
import net.weeniebeenie.fit.feed.domain.PostPhotoRepository;
import net.weeniebeenie.fit.feed.domain.PostRepository;
import net.weeniebeenie.fit.group.application.GroupService;
import net.weeniebeenie.fit.group.domain.GroupRole;
import net.weeniebeenie.fit.photo.domain.PhotoRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.Trip;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import net.weeniebeenie.fit.trip.domain.TripRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * 사진과 글을 나누는 자리.
 *
 * <h3>장소에서 떼어 냈습니다</h3>
 *
 * <p>장소마다 기록을 남기게 했던 자리가 있었는데 아무도 안 썼습니다. 무엇을
 * 남기려면 <b>장소를 먼저 골라야</b> 해서, 숙소에서 찍은 단체 사진은 올릴
 * 데가 없었습니다 — 여행에서 가장 남기고 싶은 사진이 정작 갈 곳이 없었습니다.
 *
 * <h3>올리는 데 드는 품이 사진 고르기 하나여야 합니다</h3>
 *
 * <p>제목도 지역도 공개 범위도 안 받습니다. 그것들은 여행기(TripPost)가
 * 가집니다 — 그쪽은 남에게 내놓는 글이고 이쪽은 아는 사람들끼리 보는
 * 것입니다. <b>사진만 올려도, 글만 써도 됩니다.</b> 둘 다 비면 못 올립니다.
 *
 * <h3>좋아요는 안 둡니다</h3>
 *
 * <p>스무 명짜리 모임에서 좋아요는 셈이 아니라 <b>눈치</b>가 됩니다. 누가
 * 안 눌렀는지가 보입니다. 댓글만 둡니다.
 *
 * <h3>볼 수 있는가</h3>
 *
 * <pre>
 *   group_id 가 있으면 → 그 그룹의 멤버만
 *   group_id 가 없으면 → 글쓴이만
 * </pre>
 *
 * <p>못 보면 <b>404</b> 입니다. 403 으로 답하면 "있긴 있는데 못 본다" 가 되어,
 * id 를 바꿔 가며 어떤 글이 존재하는지 알아낼 수 있습니다.
 */
@Service
@RequiredArgsConstructor
public class FeedService {

    /**
     * 한 편에 실을 수 있는 사진.
     *
     * <p>열 장이면 하루치입니다. 더 담게 하면 한 편이 앨범이 되고, 피드를
     * 내리는 사람은 그 한 편에서 멈춥니다.
     */
    private static final int MAX_PHOTOS = 10;

    private static final int MAX_TEXT = 2000;
    private static final int MAX_TAGS = 5;
    private static final int MAX_TAG_LENGTH = 20;

    /** 한 사람이 올릴 수 있는 글. 사진 한도(1000장)와 짝이 맞습니다. */
    private static final int MAX_PER_USER = 500;

    /** 한 번에 내려 주는 글 수. */
    private static final int PAGE = 20;

    private final PostRepository posts;
    private final PostPhotoRepository postPhotos;
    private final PostCommentRepository comments;
    private final PhotoRepository photos;
    private final GroupService groups;
    private final TripRepository trips;
    private final TripAccessPolicy access;
    private final UserRepository users;
    private final AuditService audit;
    /* 남의 피드를 걸러 낼 때 「함께 속한 모임」을 셉니다. */
    private final net.weeniebeenie.fit.group.domain.GroupMemberRepository members;

    /* ---------------------------------------------------------------- 읽기 */

    /**
     * 한 그룹의 피드.
     *
     * <p>멤버가 아니면 404 — 모임이 있다는 사실도 안 알려 줍니다.
     */
    @Transactional(readOnly = true)
    public Slice ofGroup(AuthPrincipal me, String groupId, String tag, int page) {
        groups.requireMember(groupId, me.id());
        return sliceOf(posts.ofGroup(groupId, tagOrAll(tag), pageOf(page)), me);
    }

    /**
     * 남의 피드 — <b>나와 함께 속한 모임</b>에 올린 글만.
     *
     * <p>그 사람이 다른 모임에 올린 글은 그 모임 사람의 것이라 안 냅니다.
     * 그룹 없이 올린 글도 안 냅니다 — 올린 사람만 보는 자리입니다. 함께
     * 속한 모임이 없으면(프로필이 404 인 사이) 빈 목록입니다.
     */
    @Transactional(readOnly = true)
    public Slice ofAuthor(AuthPrincipal me, String authorId, String tag, int page) {
        if (authorId.equals(me.id())) {
            return mine(me, tag, page);
        }
        java.util.Set<String> mineGroups = new java.util.HashSet<>();
        members.findAllByIdUserId(me.id()).forEach(m -> mineGroups.add(m.getId().getGroupId()));
        java.util.List<String> shared = members.findAllByIdUserId(authorId).stream()
                .map(m -> m.getId().getGroupId())
                .filter(mineGroups::contains)
                .toList();
        if (shared.isEmpty()) {
            return new Slice(java.util.List.of(), false);
        }
        return sliceOf(posts.ofAuthorIn(authorId, shared, tagOrAll(tag), pageOf(page)), me);
    }

    /** 내가 올린 것 전부. 그룹에 올린 것도 함께 옵니다. */
    @Transactional(readOnly = true)
    public Slice mine(AuthPrincipal me, String tag, int page) {
        return sliceOf(posts.ofAuthor(me.id(), tagOrAll(tag), pageOf(page)), me);
    }

    /**
     * 그 여행에 붙은 글들.
     *
     * <p>여행을 볼 수 있으면 봅니다. 다만 글은 저마다 제 울타리를 가지므로
     * 볼 수 없는 것은 걸러 냅니다 — 같은 여행을 두고 내 피드에 쓴 글이 모임
     * 사람에게 보이면 안 됩니다.
     */
    @Transactional(readOnly = true)
    public List<Card> ofTrip(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());
        List<Post> found = posts.findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(tripId).stream()
                .filter(p -> canRead(p, me.id()))
                .toList();
        return cardsOf(found, me);
    }

    @Transactional(readOnly = true)
    public Card read(AuthPrincipal me, String postId) {
        Post post = mine(postId, me.id());
        return cardsOf(List.of(post), me).get(0);
    }

    /* -------------------------------------------------------------- 올리기 */

    @Transactional
    public Post write(AuthPrincipal me, String groupId, String tripId,
                      String text, List<String> tags, List<String> photoIds) {
        String inGroup = blankToNull(groupId);
        if (inGroup != null) {
            groups.requireMember(inGroup, me.id());
        }

        String clean = blankToNull(text);
        if (clean != null && clean.length() > MAX_TEXT) {
            throw ApiException.badRequest("글이 너무 길어요. " + MAX_TEXT + "자 아래로 적어 주세요.");
        }
        List<String> pics = minePhotos(me, photoIds);
        if (clean == null && pics.isEmpty()) {
            throw ApiException.badRequest("사진을 고르거나 한 줄 적어 주세요.");
        }
        if (posts.countByAuthorId(me.id()) >= MAX_PER_USER) {
            throw ApiException.badRequest("올릴 수 있는 글 수를 넘었어요. 안 쓰는 것을 지우고 올려 주세요.");
        }

        Post post = posts.save(Post.builder()
                .authorId(me.id())
                .groupId(inGroup)
                .tripId(tripOf(me, tripId, inGroup))
                .text(clean)
                .tags(cleanTags(tags))
                .build());
        attach(post.getId(), pics);

        audit.log(me.id(), "feed.write", post.getId(),
                Map.of("group", String.valueOf(inGroup), "photos", pics.size()));
        return post;
    }

    /**
     * 고칩니다.
     *
     * <p><b>글쓴이만</b> 합니다. 모임 글이라도 그렇습니다 — 남이 쓴 글의
     * 말을 바꿀 수 있으면 그것은 내 글이 아닙니다. 지우는 것은 모임 주인도
     * 할 수 있습니다(치우는 일이라 다릅니다).
     *
     * <p><b>보낸 것만 바뀝니다.</b> {@code null} 인 칸은 손대지 않습니다.
     * 비우는 것은 빈 글입니다 — 가계부·보석함과 같은 약속입니다.
     */
    @Transactional
    public Post edit(AuthPrincipal me, String postId, String text,
                     List<String> tags, List<String> photoIds, String tripId) {
        Post post = mine(postId, me.id());
        if (!post.getAuthorId().equals(me.id())) {
            throw ApiException.forbidden("내가 쓴 글만 고칠 수 있어요.");
        }

        if (text != null) {
            String clean = blankToNull(text);
            if (clean != null && clean.length() > MAX_TEXT) {
                throw ApiException.badRequest("글이 너무 길어요. " + MAX_TEXT + "자 아래로 적어 주세요.");
            }
            post.setText(clean);
        }
        if (tags != null) {
            post.setTags(cleanTags(tags));
        }
        if (tripId != null) {
            post.setTripId(tripOf(me, tripId, post.getGroupId()));
        }
        if (photoIds != null) {
            List<String> pics = minePhotos(me, photoIds);
            /* 갈아 끼우기 전에 봅니다 — 사진을 다 빼는데 글도 비어 있으면
               아무것도 안 남은 글이 됩니다. */
            if (post.getText() == null && pics.isEmpty()) {
                throw ApiException.badRequest("사진을 고르거나 한 줄 적어 주세요.");
            }
            postPhotos.deleteAllByPostId(postId);
            postPhotos.flush();
            attach(postId, pics);
        }

        post.touch();
        audit.log(me.id(), "feed.edit", postId);
        return post;
    }

    /**
     * 지웁니다.
     *
     * <p>글쓴이와 <b>모임 주인</b>이 할 수 있습니다. 주인에게 치울 길이
     * 없으면 모임에 남이 올린 것을 못 내립니다.
     *
     * <p>댓글을 <b>코드가</b> 지웁니다. {@code post_comments.post_id} 에는
     * 외래키가 없어서 DB 가 안 해 줍니다({@link CommentKind}). 사진 파일은
     * 안 지웁니다 — 올린 사람의 것이고, 글에서 떼기만 합니다.
     */
    @Transactional
    public void remove(AuthPrincipal me, String postId) {
        Post post = mine(postId, me.id());
        boolean author = post.getAuthorId().equals(me.id());
        boolean host = post.getGroupId() != null
                && groups.requireMember(post.getGroupId(), me.id()).getRole() == GroupRole.OWNER;
        if (!author && !host && me.role() != Role.ADMIN) {
            throw ApiException.forbidden("내가 쓴 글만 지울 수 있어요.");
        }

        comments.deleteAllByPostId(postId);
        postPhotos.deleteAllByPostId(postId);
        posts.delete(post);
        audit.log(me.id(), author ? "feed.remove" : "feed.remove.host", postId);
    }

    /* ---------------------------------------------------------------- 울타리 */

    /** 볼 수 있는 글인지 보고, 맞으면 돌려줍니다. 아니면 404. */
    public Post mine(String postId, String userId) {
        Post post = posts.findById(postId)
                .orElseThrow(() -> ApiException.notFound("글을 찾을 수 없어요."));
        if (!canRead(post, userId)) {
            throw ApiException.notFound("글을 찾을 수 없어요.");
        }
        return post;
    }

    private boolean canRead(Post post, String userId) {
        if (userId == null || post.isHidden()) {
            return false;
        }
        if (post.getGroupId() == null) {
            return post.getAuthorId().equals(userId);
        }
        return groups.isMember(post.getGroupId(), userId);
    }

    /* ---------------------------------------------------------------- 속살 */

    /**
     * 글들을 화면이 쓰는 꼴로.
     *
     * <p>사진·댓글 수·글쓴이 이름·여행 이름을 <b>한 번에</b> 받아 짝지읍니다.
     * 글마다 묻게 두면 스무 편짜리 목록 한 번에 여든 번 왕복합니다.
     */
    private List<Card> cardsOf(List<Post> found, AuthPrincipal me) {
        if (found.isEmpty()) {
            return List.of();
        }
        List<String> ids = found.stream().map(Post::getId).toList();

        Map<String, List<String>> pics = new HashMap<>();
        for (PostPhoto pp : postPhotos.findAllByPostIdInOrderBySortAsc(ids)) {
            pics.computeIfAbsent(pp.getPostId(), k -> new ArrayList<>()).add(pp.getPhotoId());
        }

        Map<String, Long> talk = new HashMap<>();
        for (Object[] row : comments.countsOf(ids, CommentKind.FEED)) {
            talk.put((String) row[0], (Long) row[1]);
        }

        Map<String, User> who = new LinkedHashMap<>();
        found.stream().map(Post::getAuthorId).distinct()
                .forEach(id -> users.findById(id).ifPresent(u -> who.put(id, u)));

        Map<String, String> where = new HashMap<>();
        found.stream().map(Post::getTripId).filter(Objects::nonNull).distinct()
                .forEach(id -> trips.findById(id).ifPresent(t -> where.put(id, t.getTitle())));

        List<Card> out = new ArrayList<>();
        for (Post p : found) {
            User u = who.get(p.getAuthorId());
            out.add(new Card(
                    p.getId(),
                    p.getAuthorId(),
                    u == null ? "알 수 없음" : u.getName(),
                    u == null ? null : u.getMark(),
                    p.getGroupId(),
                    p.getTripId(),
                    p.getTripId() == null ? null : where.get(p.getTripId()),
                    p.getText(),
                    List.of(p.getTags()),
                    pics.getOrDefault(p.getId(), List.of()),
                    talk.getOrDefault(p.getId(), 0L).intValue(),
                    p.getAuthorId().equals(me.id()),
                    p.getCreatedAt(),
                    p.getUpdatedAt()));
        }
        return out;
    }

    private Slice sliceOf(Page<Post> page, AuthPrincipal me) {
        return new Slice(cardsOf(page.getContent(), me), page.hasNext());
    }

    private static Pageable pageOf(int page) {
        return PageRequest.of(Math.max(0, page), PAGE);
    }

    /** 빈 글은 「안 거름」입니다. 질의를 두 벌로 만들지 않으려고 둡니다. */
    private static String tagOrAll(String tag) {
        String clean = tagOf(tag);
        return clean == null ? "" : clean;
    }

    /**
     * 고른 사진이 내 것인지.
     *
     * <p>안 보면 남의 사진 번호를 글에 박아 넣을 수 있습니다. 번호는 난수라
     * 찍어서 맞히기 어렵지만, 어렵다는 것이 막았다는 뜻은 아닙니다.
     */
    private List<String> minePhotos(AuthPrincipal me, List<String> photoIds) {
        if (photoIds == null || photoIds.isEmpty()) {
            return List.of();
        }
        List<String> clean = photoIds.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
        if (clean.size() > MAX_PHOTOS) {
            throw ApiException.badRequest("사진은 " + MAX_PHOTOS + "장까지 올릴 수 있어요.");
        }
        for (String id : clean) {
            photos.findById(id)
                    .filter(p -> p.getOwnerId().equals(me.id()))
                    .orElseThrow(() -> ApiException.badRequest("그런 사진이 없어요."));
        }
        return clean;
    }

    private void attach(String postId, List<String> photoIds) {
        for (int i = 0; i < photoIds.size(); i++) {
            postPhotos.save(new PostPhoto(postId, photoIds.get(i), i));
        }
    }

    /**
     * 고른 여행이 쓸 수 있는 것인지.
     *
     * <p>볼 수 있는 여행이어야 하고, <b>모임 글이면 그 모임의 여행</b>이어야
     * 합니다. 안 그러면 모임 사람들에게 그들이 못 보는 여행 이름이 글마다
     * 붙어 뜹니다.
     */
    private String tripOf(AuthPrincipal me, String tripId, String groupId) {
        String clean = blankToNull(tripId);
        if (clean == null) {
            return null;
        }
        Trip trip = access.mine(clean, me.id());
        if (groupId != null && !groupId.equals(trip.getGroupId())) {
            throw ApiException.badRequest("이 모임의 여행이 아니에요.");
        }
        return trip.getId();
    }

    private static String[] cleanTags(List<String> raw) {
        if (raw == null) {
            return new String[0];
        }
        return raw.stream()
                .map(FeedService::tagOf)
                .filter(Objects::nonNull)
                .distinct()
                .limit(MAX_TAGS)
                .toArray(String[]::new);
    }

    /**
     * 태그 하나를 다듬습니다. 못 쓸 것이면 null.
     *
     * <p>사람이 "#라멘", "라멘 ", "라멘" 을 제각기 적습니다. 그대로 두면 같은
     * 말이 세 갈래로 흩어져 어느 것으로도 다 안 걸립니다. 여행기 쪽과 같은
     * 규칙입니다.
     */
    private static String tagOf(String raw) {
        if (raw == null) {
            return null;
        }
        String clean = raw.strip().replaceFirst("^#+", "").strip().toLowerCase(Locale.ROOT);
        return clean.isEmpty() || clean.length() > MAX_TAG_LENGTH ? null : clean;
    }

    private static String blankToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String clean = raw.trim();
        return clean.isEmpty() ? null : clean;
    }

    /**
     * 피드 글 한 편, 화면이 쓰는 꼴로.
     *
     * @param groupId   모임 글이면 그 모임. 내 피드면 비어 있습니다
     * @param tripTitle 어느 여행 이야기인지. 지워진 여행이면 비어 있습니다
     * @param mine      내가 쓴 것인지. 고치기·지우기 단추가 여기에 걸립니다
     */
    public record Card(String id, String authorId, String authorName, String authorMark,
                       String groupId, String tripId, String tripTitle,
                       String text, List<String> tags, List<String> photoIds,
                       int commentCount, boolean mine,
                       Instant createdAt, Instant updatedAt) {
    }

    /** @param more 더 있는지. 「더 보기」를 낼지가 여기에 걸립니다 */
    public record Slice(List<Card> posts, boolean more) {
    }
}
