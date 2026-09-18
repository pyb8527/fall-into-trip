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
           WHERE hidden = false AND region IS NOT NULL AND region <> ''
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
     * @param kind 갈래로 거를 때의 이름("ramen"). 비우면 전부.
     * @return [묶음 열쇠, 이름, 갈래, 위도, 경도, 구글 번호, 글 수, 추천 합]
     */
    @Query(value = """
           SELECT key, max(name) AS name, max(icon) AS icon,
                  avg(lat) AS lat, avg(lng) AS lng, max(place_id) AS place_id,
                  count(*) AS posts, coalesce(sum(likes), 0) AS likes
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
               WHERE p.hidden = false
                 AND pl->>'name' IS NOT NULL
                 AND (:kind IS NULL OR pl->>'icon' = :kind)
           ) one
           GROUP BY key
           ORDER BY posts DESC, likes DESC, name ASC
           LIMIT :limit
           """, nativeQuery = true)
    List<Object[]> places(@Param("kind") String kind, @Param("limit") int limit);

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
           WHERE p.hidden = false AND nullif(pl->>'icon', '') IS NOT NULL
           GROUP BY icon
           ORDER BY n DESC
           """, nativeQuery = true)
    List<Object[]> kinds();
}
