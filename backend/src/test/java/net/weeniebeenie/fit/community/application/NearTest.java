package net.weeniebeenie.fit.community.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 「지금 내 근처」로 세우는 일.
 *
 * <h3>무엇을 재는 묶음인가</h3>
 *
 * <p>거리를 세고 세우는 일은 SQL 이 합니다({@code PopularRepository.places}).
 * 그 정렬 자체는 데이터베이스 없이 돌려 볼 수 없으므로, 여기서는 <b>그 정렬이
 * 기대는 두 가지</b>를 봅니다.
 *
 * <ol>
 *   <li>읽을 수 없는 좌표가 쿼리로 들어가지 않는지. 들어가면 네모가 엉뚱한
 *       자리에 쳐지고, 목록은 「근처」라는 제목을 달고 아무 데나 냅니다.
 *   <li>네모가 원을 <b>감싸는지.</b> 네모가 원보다 좁으면 30km 안에 있는
 *       장소가 거리 셈에 닿기도 전에 떨어져 나갑니다 — 쿼리는 아무 오류도
 *       내지 않고, 목록에서 바로 옆 가게 하나가 조용히 사라집니다.
 * </ol>
 *
 * <p>둘째를 재려고 이 묶음은 하버사인을 <b>한 벌 더</b> 들고 있습니다. 쓰는
 * 코드에 두 벌을 두면 언젠가 어긋나지만, 재는 쪽이 재는 대상과 같은 식을 쓰면
 * 아무것도 재지 못합니다 — 여기서는 따로 적은 것이 맞습니다.
 */
class NearTest {

    /** 서울시청. */
    private static final double SEOUL_LAT = 37.5665;
    private static final double SEOUL_LNG = 126.9780;

    @Test
    @DisplayName("「위도,경도」를 읽는다")
    void reads() {
        Near at = Near.parse("37.5665,126.9780");
        assertTrue(at.given());
        assertEquals(37.5665, at.lat());
        assertEquals(126.9780, at.lng());
    }

    @Test
    @DisplayName("사이의 빈칸은 봐준다")
    void trims() {
        /* 주소에서 올 때 더러 섞입니다. 이것 때문에 「근처」를 못 쓰면
           아까운 일입니다. */
        assertTrue(Near.parse(" 37.5665 , 126.9780 ").given());
    }

    @Test
    @DisplayName("못 읽는 값은 기준이 없는 것이다")
    void unusable() {
        /* 거절하지 않습니다. 목록은 인기순으로 그대로 내려가고, 화면은
           near=false 를 보고 「근처」라는 제목을 안 답니다. */
        assertSame(Near.NOWHERE, Near.parse(null));
        assertSame(Near.NOWHERE, Near.parse(""));
        assertSame(Near.NOWHERE, Near.parse("  "));
        assertSame(Near.NOWHERE, Near.parse("37.5665"));
        assertSame(Near.NOWHERE, Near.parse("37.5665,126.9780,0"));
        assertSame(Near.NOWHERE, Near.parse("서울,어딘가"));
        assertSame(Near.NOWHERE, Near.parse("37.5665;126.9780"));
        assertSame(Near.NOWHERE, Near.parse("'); drop table trip_posts; --"));
        assertFalse(Near.NOWHERE.given());
    }

    @Test
    @DisplayName("지구 밖의 좌표는 기준이 없는 것이다")
    void offEarth() {
        assertSame(Near.NOWHERE, Near.parse("91,0"));
        assertSame(Near.NOWHERE, Near.parse("-91,0"));
        assertSame(Near.NOWHERE, Near.parse("0,181"));
        assertSame(Near.NOWHERE, Near.parse("0,-181"));
        /* 숫자로는 읽히는 것들. 그대로 넘기면 네모가 전부가 되어 모든 장소에
           삼각함수가 돕니다. */
        assertSame(Near.NOWHERE, Near.parse("NaN,NaN"));
        assertSame(Near.NOWHERE, Near.parse("Infinity,0"));
    }

    @Test
    @DisplayName("기준이 없으면 네모를 안 친다")
    void noBox() {
        /* null 네 개가 쿼리로 가면 me.lat IS NULL 이 되어 네모가 통째로
           빠집니다 — 「지금 뜨는 곳」이 전과 같은 목록을 냅니다. */
        assertEquals(null, Near.NOWHERE.south());
        assertEquals(null, Near.NOWHERE.north());
        assertEquals(null, Near.NOWHERE.west());
        assertEquals(null, Near.NOWHERE.east());
    }

    @Test
    @DisplayName("네모는 30km 안쪽을 어느 방향으로도 안 잘라낸다")
    void boxHoldsTheCircle() {
        /* 위도마다 따로 봅니다. 경도 1도의 길이가 위로 갈수록 짧아져서,
           한 위도에서 맞은 네모가 다른 위도에서는 좁습니다. */
        for (double lat : new double[] {0, 37.5665, -33.87, 60.17, 64.14, -41.29}) {
            Near at = new Near(lat, 10.0);
            for (int bearing = 0; bearing < 360; bearing += 5) {
                double[] edge = move(lat, 10.0, Near.RADIUS_M, bearing);
                assertTrue(inBox(at, edge),
                        "위도 " + lat + " 에서 " + bearing + "도 쪽 30km 가 네모 밖입니다");
            }
        }
    }

    @Test
    @DisplayName("한참 먼 곳은 네모가 먼저 떨어낸다")
    void boxDropsTheFar() {
        Near seoul = new Near(SEOUL_LAT, SEOUL_LNG);
        /* 부산(325km)과 도쿄. 네모에서 떨어지면 거리 셈이 아예 안 돕니다 —
           그것이 네모를 치는 까닭입니다. */
        assertFalse(inBox(seoul, new double[] {35.1796, 129.0756}));
        assertFalse(inBox(seoul, new double[] {35.6812, 139.7671}));
        /* 모서리 쪽 38km 는 원 밖인데 네모 안입니다. 네모는 원을 감싸는
           쪽으로만 틀리므로 이것이 정상이고, 30km 라고 자르는 일은 원이
           합니다 — 네모만으로 끊으면 북동쪽 38km 가 「근처」가 됩니다. */
        assertTrue(inBox(seoul, move(SEOUL_LAT, SEOUL_LNG, 38_000, 45)));
    }

    @Test
    @DisplayName("극과 날짜변경선 근처에서는 네모를 포기한다")
    void givesUpAtTheEdges() {
        /* 경도가 뜻을 잃는 자리입니다. 좁은 네모를 치면 눈앞의 곳이 빠지므로
           전부로 둡니다 — 느려지기만 하고 틀리지는 않습니다. */
        Near pole = new Near(89.9, 0.0);
        assertEquals(-90.0, pole.south());
        assertEquals(90.0, pole.north());
        assertEquals(-180.0, pole.west());
        assertEquals(180.0, pole.east());

        /* 피지. 동쪽 끝이 180 을 넘어가면 좌우를 안 자릅니다. */
        Near fiji = new Near(-18.14, 179.95);
        assertEquals(-180.0, fiji.west());
        assertEquals(180.0, fiji.east());
        /* 위아래는 그대로 좁힙니다 — 날짜변경선은 경도만의 일입니다. */
        assertTrue(fiji.south() > -19.0);
        assertTrue(fiji.north() < -17.0);
    }

    /** 네모 안인지. 쿼리의 {@code BETWEEN} 두 줄과 같은 판단입니다. */
    private static boolean inBox(Near at, double[] point) {
        return point[0] >= at.south() && point[0] <= at.north()
                && point[1] >= at.west() && point[1] <= at.east();
    }

    /**
     * 이 자리에서 그 방향으로 그만큼 간 자리.
     *
     * <p>쓰는 코드에는 없는 식입니다. 네모가 원을 감싸는지 보려면 「정확히
     * 30km 떨어진 점」을 방향마다 만들어야 하고, 그것을 만드는 일은 거리를
     * 재는 일과 다릅니다.
     */
    private static double[] move(double lat, double lng, double meters, double bearing) {
        double r = 6_371_000;
        double d = meters / r;
        double b = Math.toRadians(bearing);
        double from = Math.toRadians(lat);
        double to = Math.asin(Math.sin(from) * Math.cos(d)
                + Math.cos(from) * Math.sin(d) * Math.cos(b));
        double dLng = Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(from),
                Math.cos(d) - Math.sin(from) * Math.sin(to));
        return new double[] {Math.toDegrees(to), lng + Math.toDegrees(dLng)};
    }
}
