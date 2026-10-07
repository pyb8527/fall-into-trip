package net.weeniebeenie.fit.feed.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, String> {

    /**
     * 한 그룹의 피드.
     *
     * <p>태그를 주면 그것이 달린 글만. 빈 글이면 전부입니다 — 「안 거름」을
     * null 로 두면 질의가 두 벌이 됩니다.
     *
     * <p>태그가 있는지는 {@code array_position(...) > 0} 으로 묻습니다.
     * {@code IS NOT NULL} 로 물으면 <b>안 걸러집니다</b> — 하이버네이트가
     * 모르는 함수의 값을 못 비어 있는 int 로 보고 {@code coalesce(..., 0)}
     * 으로 감싸서, 그 값이 영영 NULL 이 아니게 됩니다. 없으면 0, 있으면
     * 1부터이므로 {@code > 0} 은 감싸든 안 감싸든 맞습니다.
     *
     * <p>「나만」 인 글은 글쓴이에게만 옵니다. 거르는 일은
     * {@code FeedService.visible} 이 어차피 한 번 더 하는데, 여기서도 거르는
     * 까닭은 <b>쪽 수</b>입니다 — 받아 놓고 버리면 스무 개를 달라고 해서 열일곱
     * 개를 그리고, {@code more} 는 DB 가 센 것이라 "더 보기" 가 안 맞습니다.
     *
     * @param viewerId 보는 사람. 제 글은 「나만」이라도 옵니다
     */
    @Query("""
           SELECT p FROM Post p
           WHERE p.groupId = :groupId
             AND p.hidden = false
             AND (:tag = '' OR FUNCTION('array_position', p.tags, :tag) > 0)
             AND (p.audience <> net.weeniebeenie.fit.feed.domain.Audience.ONLY_ME
                  OR p.authorId = :viewerId)
           ORDER BY p.createdAt DESC
           """)
    Page<Post> ofGroup(@Param("groupId") String groupId,
                       @Param("tag") String tag,
                       @Param("viewerId") String viewerId,
                       Pageable pageable);

    /** 내가 올린 것 전부 — 그룹에 올린 것도 함께입니다. */
    @Query("""
           SELECT p FROM Post p
           WHERE p.authorId = :authorId
             AND p.hidden = false
             AND (:tag = '' OR FUNCTION('array_position', p.tags, :tag) > 0)
           ORDER BY p.createdAt DESC
           """)
    Page<Post> ofAuthor(@Param("authorId") String authorId,
                        @Param("tag") String tag,
                        Pageable pageable);

    /**
     * 한 사람이 <b>나와 함께 속한 모임</b>에 올린 것. 남의 페이지의 피드 칸이
     * 씁니다.
     *
     * <h3>모임 없이 올린 글도 섞입니다</h3>
     *
     * <p>전에는 안 걸렸습니다. 모임 번호가 비어 있는 글은 올린 사람만 보는
     * 자리였기 때문입니다. 그런데 이제 그 글도 {@link Audience} 를 가지므로,
     * 올린 사람이 「내 모임 사람만」이나 「모두」로 열어 둔 글은 보여야 합니다 —
     * 안 보여 주면 고른 값이 아무 일도 안 하는 셈이고, 고른 사람은 글이 어디
     * 가서 안 보이는지 알 길이 없습니다.
     *
     * <p>「내 모임 사람만」을 여기서 따로 안 묻습니다. <b>이 질의를 부를 때는
     * 이미 모임을 함께 쓰는 사이</b>입니다 — {@code groupIds} 가 함께 속한
     * 모임이고, 비어 있으면 부르는 두 자리
     * ({@code FeedService.ofAuthor}·{@code ProfileService}) 가 먼저 돌아섭니다.
     * 빈 집합으로 부르면 모임 글은 하나도 안 걸리는데 모임 없이 올린 글이
     * 걸리므로, 그 약속을 깨면 남의 글이 새어 나갑니다.
     *
     * <p>「나만」 인 글은 빠집니다. 남의 페이지의 「글 n」도 이 질의가 세므로
     * 숫자와 목록이 함께 맞습니다.
     */
    @Query("""
           SELECT p FROM Post p
           WHERE p.authorId = :authorId
             AND p.hidden = false
             AND p.audience <> net.weeniebeenie.fit.feed.domain.Audience.ONLY_ME
             AND (p.groupId IN :groupIds OR p.groupId IS NULL)
             AND (:tag = '' OR FUNCTION('array_position', p.tags, :tag) > 0)
           ORDER BY p.createdAt DESC
           """)
    Page<Post> ofAuthorIn(@Param("authorId") String authorId,
                          @Param("groupIds") java.util.Collection<String> groupIds,
                          @Param("tag") String tag,
                          Pageable pageable);

    /** 그 여행에 붙은 글들. 여행기에 실을 것을 고를 때도 씁니다. */
    List<Post> findAllByTripIdAndHiddenFalseOrderByCreatedAtDesc(String tripId);

    /**
     * 날마다 내가 올린 글이 몇 편인가 — 달력 칸에 적는 수.
     *
     * <h3>한 달에 질의 하나입니다</h3>
     *
     * <p>칸마다 묻는 길을 안 씁니다. 한 달은 서른 칸이라, 아무도 아직 내려
     * 보지 않은 화면에 왕복 서른 번이 먼저 갑니다. 글을 다 받아 와 코드가
     * 세는 길도 안 씁니다 — 한 달치 글을 글자와 태그까지 끌고 와서 수 하나를
     * 내려 주려고 버립니다. <b>DB 가 묶어 센 것</b>만 받습니다.
     *
     * <h3>왜 시간대를 넘겨받나</h3>
     *
     * <p>{@code created_at} 은 {@code TIMESTAMPTZ} 고 달력 칸은 <b>그 지역
     * 날짜</b>입니다. 그냥 세면 한국에서 오전 8시에 올린 글이 전날 칸에
     * 들어갑니다 — 그 순간이 UTC 로는 전날 23시입니다. 어느 시계로 가를지는
     * 부르는 쪽이 한 군데에서 정합니다({@code FeedService.calendarZone}).
     *
     * <h3>날짜를 글자로 받습니다</h3>
     *
     * <p>{@code date} 를 드라이버가 무엇으로 주는지({@code java.sql.Date} 인지
     * {@link java.time.LocalDate} 인지)는 판마다 다릅니다. 받아 놓고 갈라 보는
     * 코드를 두지 않으려고 SQL 에서 못 박습니다 — 내려 줄 모양도
     * {@code 2026-10-02} 입니다.
     *
     * <p>{@code idx_posts_mine}({@code author_id, created_at}) 을 그대로
     * 씁니다 — 거르는 조건이 그 둘입니다. 묶는 식은 걸러 남은 한 달치에만
     * 듭니다.
     *
     * <p>감춰진 글은 안 셉니다. 목록({@link #ofAuthorBetween})도 안 내므로,
     * 안 맞추면 2 가 적힌 칸을 눌러 글 하나만 나옵니다.
     *
     * @param until 이 순간 <b>앞</b>까지. 끝 날의 다음 자정이라 끝 날이 다 듭니다
     * @param zone  칸을 가르는 시계 이름. {@code Asia/Seoul} 같은 것입니다
     * @return [{@code 2026-10-02} 꼴 날짜, 글 수]
     */
    @Query(value = """
           SELECT to_char(created_at AT TIME ZONE :zone, 'YYYY-MM-DD') AS on_day,
                  count(*) AS posts
           FROM posts
           WHERE author_id = :authorId
             AND hidden = false
             AND created_at >= :from
             AND created_at < :until
           GROUP BY on_day
           ORDER BY on_day
           """, nativeQuery = true)
    List<Object[]> countMineByDay(@Param("authorId") String authorId,
                                  @Param("from") Instant from,
                                  @Param("until") Instant until,
                                  @Param("zone") String zone);

    /**
     * 그 하루에 내가 올린 글 — 달력에서 날을 눌렀을 때.
     *
     * <p>나눠 주지 않습니다. 하루치는 많아야 몇 편이고, 한 사람이 올릴 수
     * 있는 글이 500 편으로 묶여 있습니다 — 하루에 그만큼 올려도 한 쪽입니다.
     *
     * <p>올린 차례 <b>오름차순</b>입니다. 피드 목록들은 내림차순인데(새 글이
     * 위), 하루를 펼쳐 보는 자리에서 뜻이 있는 것은 아침에서 저녁으로 가는
     * 흐름입니다 — 바로 위에 그날 동선이 시간 순으로 그려져 있어서, 글이
     * 거꾸로 서면 같은 하루가 한 화면에서 두 방향으로 흐릅니다.
     *
     * <p>울타리는 안 봅니다. 글쓴이에게 제 글을 돌려주는 질의라 볼 것이
     * 없습니다 — 감춰진 글만 뺍니다. <b>남의 글을 내는 데 쓰면 안 됩니다</b>
     * ({@code FeedService.mineOn} 의 설명).
     *
     * @param until 이 순간 <b>앞</b>까지. 다음 날 자정입니다
     */
    @Query("""
           SELECT p FROM Post p
           WHERE p.authorId = :authorId
             AND p.hidden = false
             AND p.createdAt >= :from
             AND p.createdAt < :until
           ORDER BY p.createdAt ASC
           """)
    List<Post> ofAuthorBetween(@Param("authorId") String authorId,
                               @Param("from") Instant from,
                               @Param("until") Instant until);

    long countByAuthorId(String authorId);

    /** 그룹을 지울 때 댓글을 먼저 치우려고 번호만 걷습니다. */
    @Query("SELECT p.id FROM Post p WHERE p.groupId = :groupId")
    List<String> idsOfGroup(@Param("groupId") String groupId);

    /**
     * 운영자가 봐야 할 것 — 신고가 들어왔거나 그래서 감춰진 글.
     *
     * <p>감춰진 글만 내던 자리였습니다. 그런데 피드 글에는 신고가 없어서
     * 감춰질 길이 없었고, 이제 신고가 생기면서 「들어왔지만 아직 보이는 것」도
     * 운영자가 봐야 합니다 — 팁 쪽({@code PlaceTipRepository.findNeedingReview})과
     * 같은 꼴입니다.
     */
    @Query("""
           SELECT p FROM Post p
           WHERE p.hidden = true
              OR EXISTS (SELECT 1 FROM FeedReport r WHERE r.postId = p.id)
           ORDER BY p.hidden DESC, p.createdAt DESC
           """)
    Page<Post> findNeedingReview(Pageable pageable);
}
