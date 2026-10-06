package net.weeniebeenie.fit.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 올라온 글을 모아 세어 봅니다 — 어디가 많이 가고, 어디를 많이 넣는지.
 *
 * <h3>왜 쿼리를 손으로 쓰는가</h3>
 *
 * <p>글에 담긴 일정은 {@code snapshot} 한 칸에 jsonb 로 들어 있습니다. 장소는
 * 그 안의 {@code days[].places[]} 라, 장소를 세려면 배열을 펼쳐야 합니다.
 * JPQL 로는 할 수 없는 일이라 여기만 네이티브로 둡니다.
 *
 * <h3>감춘 글은 안 셉니다</h3>
 *
 * <p>신고로 감춰진 글이 순위에 남아 있으면, 감춘 것이 감춰지지 않은 셈입니다.
 */
public interface PopularRepository extends JpaRepository<TripPost, String> {

    /**
     * 많이 다녀온 지역.
     *
     * @return [지역, 글 수, 추천 합, 조회 합]
     */
    @Query(value = """
           SELECT region,
                  count(*)              AS posts,
                  coalesce(sum(like_count), 0) AS likes,
                  coalesce(sum(view_count), 0) AS views
           FROM trip_posts
           WHERE hidden = false AND visibility = 'LISTED'
             AND region IS NOT NULL AND region <> ''
           GROUP BY region
           ORDER BY posts DESC, likes DESC, region ASC
           LIMIT :limit
           """, nativeQuery = true)
    List<Object[]> regions(@Param("limit") int limit);

    /**
     * 여러 사람이 일정에 넣은 장소.
     *
     * <p>같은 곳인지는 <b>구글 번호</b>로 가릅니다. 번호가 없는 곳(좌표를 직접
     * 찍은 것)은 이름으로 묶습니다 — 이름이 같아도 다른 가게일 수 있지만,
     * 그것 말고는 같은 곳인지 알 방법이 없습니다.
     *
     * <p>한 글에서 같은 곳을 두 번 넣었어도 한 번으로 셉니다. 사흘 내내 같은
     * 카페에 갔다고 그 카페가 세 배 인기 있는 것은 아닙니다.
     *
     * <h3>들르는 곳만 셉니다</h3>
     *
     * <p>운영 서버의 1~3위가 「삼환하이펙스B동」 · 「인계동 행정복지센터」 ·
     * 「판교역」이었습니다 — 퇴근길을 올린 글 하나에서 나온 것입니다. 일정에는
     * 들르는 곳 말고도 <b>지나가는 곳</b>(역·공항)과 <b>자는 곳</b>(숙소)이
     * 잔뜩 들어가고(도쿄 3박 4일 63곳 중 서른 남짓이 역), 갈래를 안 고른
     * 곳은 대개 주소를 찍어 둔 건물입니다. 셋 다 남에게 권할 곳이 아닙니다.
     *
     * <p>그래서 갈래를 고르지 않고 부를 때는 그 셋을 뺍니다. 갈래를 골라
     * 부르면({@code kind=move}) 고른 대로 줍니다 — 그 사람이 찾는 것이
     * 역입니다.
     *
     * <h3>내 자리를 주면 가까운 순입니다</h3>
     *
     * <p>「지금 내 근처」입니다. 거리를 여기서 셉니다 — 열 줄을 받아 화면에서
     * 다시 세우면 <b>그 열 줄 안에 없는 옆 가게</b>는 아무리 세워도 안 나옵니다.
     *
     * <p>두 단으로 거릅니다. 먼저 {@code Near} 가 준 네모로 쳐서 지구 반대편
     * 장소에 삼각함수가 안 돌게 하고, 남은 것에만 하버사인을 돌려 원으로 다시
     * 거릅니다. 네모는 원을 감싸는 쪽으로만 틀리므로({@code Near.MARGIN})
     * 안에 있는 것이 네모 때문에 빠지는 일은 없습니다.
     *
     * <p>거리는 <b>묶은 뒤의 좌표</b>(avg)로 셉니다. 내려 주는 좌표와 같은
     * 값이어야 하기 때문입니다 — 다른 값으로 재면 지도의 핀과 「여기서 1.2km」
     * 가 서로 다른 곳을 가리킵니다.
     *
     * <p>네모가 좌표 없는 장소를 떨어냅니다. 그래서 자리를 준 호출에서는
     * {@code away} 가 늘 값이 있고, {@code away IS NULL} 은 <b>자리를 안
     * 줬다</b>는 뜻만 가집니다 — 아래 {@code WHERE} 가 그것에 기댑니다.
     *
     * <h3>{@code cast} 를 왜 쓰는가</h3>
     *
     * <p>자리를 안 주면 숫자 자리에 null 이 들어갑니다. 그런데 null 에는
     * <b>타입이 없어서</b> 포스트그레스가 {@code :lat IS NULL} 의 {@code :lat}
     * 이 무엇인지 알 수 없다고 합니다. 글자 조건({@code :kind})은 드라이버가
     * varchar 로 보내 주지만 숫자는 그렇지 않습니다. 그래서 쓰는 자리마다
     * 타입을 적어 둡니다.
     *
     * <p>이름을 한 번만 적으려고 {@code WITH me AS (...)} 로 묶어 보았는데,
     * 그러면 그것을 안쪽과 바깥쪽 두 단에 각각 끌어다 붙이고 {@code GROUP BY}
     * 도 넓혀야 합니다 — 고칠 자리는 그대로 하나인데 틀릴 자리만 늘어서
     * 되돌렸습니다.
     *
     * @param kind   갈래로 거를 때의 이름("ramen"). 비우면 전부.
     * @param lat    지금 내 자리. null 이면 인기순 그대로입니다
     * @param south  네모의 네 끝({@code Near}). 자리가 없으면 다 null 입니다
     * @param radius 「근처」라고 부를 거리(미터). {@code Near.RADIUS_M}
     * @return [묶음 열쇠, 이름, 갈래, 위도, 경도, 구글 번호, 글 수, 추천 합,
     *         거리(미터, 자리를 안 줬으면 null)]
     */
    @Query(value = """
           SELECT agg.key, agg.name, agg.icon, agg.lat, agg.lng, agg.place_id,
                  agg.posts, agg.likes, agg.away
           FROM (
               SELECT key, max(name) AS name, max(icon) AS icon,
                      avg(lat) AS lat, avg(lng) AS lng, max(place_id) AS place_id,
                      count(*) AS posts, coalesce(sum(likes), 0) AS likes,
                      CASE WHEN cast(:lat as double precision) IS NULL THEN NULL ELSE
                           6371000 * 2 * asin(sqrt(
                               power(sin(radians(avg(lat) - cast(:lat as double precision)) / 2), 2)
                             + cos(radians(cast(:lat as double precision))) * cos(radians(avg(lat)))
                               * power(sin(radians(avg(lng) - cast(:lng as double precision)) / 2), 2)))
                      END AS away
               FROM (
                   SELECT DISTINCT ON (p.id, coalesce(nullif(pl->>'placeId', ''), pl->>'name'))
                          p.id AS post_id,
                          coalesce(nullif(pl->>'placeId', ''), pl->>'name') AS key,
                          pl->>'name'    AS name,
                          pl->>'icon'    AS icon,
                          (pl->>'lat')::double precision AS lat,
                          (pl->>'lng')::double precision AS lng,
                          nullif(pl->>'placeId', '')     AS place_id,
                          p.like_count   AS likes
                   FROM trip_posts p,
                        jsonb_array_elements(p.snapshot -> 'days') AS d,
                        jsonb_array_elements(d -> 'places') AS pl
                   WHERE p.hidden = false AND p.visibility = 'LISTED'
                     AND pl->>'name' IS NOT NULL
                     AND (:kind IS NULL OR pl->>'icon' = :kind)
                     AND (:kind IS NOT NULL
                          OR (nullif(pl->>'icon', '') IS NOT NULL
                              AND pl->>'icon' NOT IN ('move', 'stay')))
                     AND (:region IS NULL OR p.region = :region)
                     AND (cast(:south as double precision) IS NULL
                          OR ((pl->>'lat')::double precision
                                  BETWEEN cast(:south as double precision)
                                      AND cast(:north as double precision)
                              AND (pl->>'lng')::double precision
                                  BETWEEN cast(:west as double precision)
                                      AND cast(:east as double precision)))
               ) one
               GROUP BY key
           ) agg
           WHERE agg.away IS NULL OR agg.away <= :radius
           ORDER BY agg.away ASC NULLS LAST,
                    agg.posts DESC, agg.likes DESC, agg.name ASC
           LIMIT :limit
           """, nativeQuery = true)
    List<Object[]> places(@Param("kind") String kind,
                          @Param("region") String region,
                          @Param("lat") Double lat,
                          @Param("lng") Double lng,
                          @Param("south") Double south,
                          @Param("north") Double north,
                          @Param("west") Double west,
                          @Param("east") Double east,
                          @Param("radius") int radius,
                          @Param("limit") int limit);

    /**
     * 올라온 글에 실제로 쓰인 갈래만.
     *
     * <p>열여섯 개를 다 늘어놓으면 대부분 눌러도 아무것도 안 걸립니다.
     * 보석함이 같은 이유로 같은 일을 합니다.
     *
     * @return [갈래 이름, 장소 수]
     */
    @Query(value = """
           SELECT pl->>'icon' AS icon, count(*) AS n
           FROM trip_posts p,
                jsonb_array_elements(p.snapshot -> 'days') AS d,
                jsonb_array_elements(d -> 'places') AS pl
           WHERE p.hidden = false AND p.visibility = 'LISTED'
             AND nullif(pl->>'icon', '') IS NOT NULL
           GROUP BY icon
           ORDER BY n DESC
           """, nativeQuery = true)
    List<Object[]> kinds();
}
