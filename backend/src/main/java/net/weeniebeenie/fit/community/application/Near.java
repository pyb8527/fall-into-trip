package net.weeniebeenie.fit.community.application;

/**
 * 지금 서 있는 자리 — 「지금 내 근처」의 기준점.
 *
 * <h3>왜 서버가 세우는가</h3>
 *
 * <p>「지금 뜨는 곳」은 이미 서버가 세어서 내려 주고 있었습니다. 그것을 내
 * 좌표로 다시 세우는 일을 화면에서 하면, <b>열 개만 받아 놓고 그 열 개를
 * 가까운 순으로 세우는</b> 꼴이 됩니다 — 내 옆 가게가 그 열에 없으면 아무리
 * 세워도 안 나옵니다. 거르고 세우는 일은 전부를 쥐고 있는 쪽이 해야 합니다.
 *
 * <h3>못 읽는 값은 기준이 없는 것으로 봅니다</h3>
 *
 * <p>{@code kind}·{@code region} 과 같은 규칙입니다 — 화면에서 넘어온 값을
 * 그대로 쿼리에 넣지 않습니다. 「37.5,126.9」가 아닌 것이 오면 거절하지 않고
 * {@link #NOWHERE} 로 둡니다. 그러면 목록은 인기순 그대로 내려가고, 화면은
 * 「근처」라고 말하지 않습니다 — 틀린 순서를 「근처」라고 적는 것보다 낫습니다.
 *
 * <h3>네모를 먼저 치고 원으로 다시 거릅니다</h3>
 *
 * <p>거리 자체는 SQL 이 셉니다(하버사인). 다만 그 셈을 <b>모든 장소에</b>
 * 돌리면, 지구 반대편 라멘집까지 삼각함수를 한 번씩 거칩니다. 그래서 위아래·
 * 좌우 범위를 적은 네모로 먼저 걸러 둡니다 — 네모는 곱셈 두 번이면 되고,
 * 쿼리는 그 안에 남은 것에만 거리를 셉니다.
 *
 * <p>네모는 원을 <b>감싸는</b> 쪽으로만 틀립니다. 모서리는 반지름보다 1.4배
 * 멀어서 네모만으로는 「30km 안」이 아니고, 그 대가로 <b>안에 있는 것을 잘라
 * 내지는 않습니다.</b> 잘라 내는 쪽으로 틀리면 바로 옆 가게가 목록에서
 * 사라지고, 그것은 쓰는 사람이 알아챌 수 없는 거짓입니다. 그러니 네모는
 * 넉넉하게 치고, 「30km 안」은 원이 정합니다.
 */
public record Near(Double lat, Double lng) {

    /**
     * 「근처」라고 부를 수 있는 거리. 미터.
     *
     * <h3>왜 끊는가</h3>
     *
     * <p>안 끊어도 쿼리는 돕니다 — 가까운 순으로 세우면 되니까요. 그런데 올라온
     * 글이 대개 남의 나라 여행이라, 서울에서 열면 첫 줄이 <b>400km 떨어진
     * 곳</b>일 수 있습니다. 「지금 내 근처」라는 제목 아래 그것이 서면 제목이
     * 거짓말을 합니다.
     *
     * <p>30km 입니다. 도시와 그 바깥 한 겹 — 지금 마음먹으면 오늘 갈 수 있는
     * 거리입니다. 5km 로 좁히면 걸어갈 데만 남아 도시를 벗어난 사람에게는
     * 늘 비어 있고, 100km 로 늘리면 서울에서 춘천이 「근처」가 됩니다.
     *
     * <p>안에 아무것도 없으면 <b>빈 채로 내려갑니다.</b> 그때 화면은 「근처에는
     * 아직 올라온 곳이 없어요」라고 적습니다 — 지역을 적을 수 없으면 「그 밖」
     * 이라고 적는 것과 같은 규칙입니다.
     */
    public static final int RADIUS_M = 30_000;

    /** 기준이 없을 때. 가까운 순으로 안 세우고 인기순 그대로 냅니다. */
    public static final Near NOWHERE = new Near(null, null);

    /**
     * 위도 1도가 몇 미터인지.
     *
     * <p>SQL 의 하버사인이 쓰는 공(반지름 6,371km)과 <b>같은 공</b>으로 셉니다.
     * 다른 숫자를 쓰면 네모와 원이 서로 조금씩 어긋나는데, 그 어긋남은 늘
     * 경계에 있는 한 곳에서만 드러나 재현이 안 됩니다.
     */
    private static final double METERS_PER_DEGREE = Math.PI * 6_371_000 / 180;

    /**
     * 네모를 조금 더 넓히는 몫.
     *
     * <p>딱 맞게 치면 경계에 선 장소가 소수점 끝자리 때문에 빠집니다. 1%
     * 넉넉하게 치면 그 일이 없고, 대가는 네모 안에서 원 밖으로 떨어지는 장소
     * 몇 곳에 거리 셈이 한 번 더 도는 것뿐입니다.
     */
    private static final double MARGIN = 1.01;

    /**
     * 「위도,경도」를 읽습니다.
     *
     * <p>못 읽으면 {@link #NOWHERE} 입니다 — null 을 돌려주지 않습니다. 부르는
     * 쪽이 null 을 가리는 일을 잊으면 기준 없이 세우는 것이 아니라 터지는 것이
     * 되고, 그 차이가 화면에서는 「근처가 비었다」와 「화면이 안 뜬다」입니다.
     */
    public static Near parse(String near) {
        if (near == null || near.isBlank()) {
            return NOWHERE;
        }
        int comma = near.indexOf(',');
        /* 쉼표가 없거나 둘 이상이면 우리가 보낸 값이 아닙니다. */
        if (comma < 0 || near.indexOf(',', comma + 1) >= 0) {
            return NOWHERE;
        }
        double lat;
        double lng;
        try {
            lat = Double.parseDouble(near.substring(0, comma).trim());
            lng = Double.parseDouble(near.substring(comma + 1).trim());
        } catch (NumberFormatException e) {
            return NOWHERE;
        }
        /* NaN·Infinity 는 숫자로는 읽히지만 자리는 아닙니다. 그대로 넘기면
           네모가 전부가 되어 모든 장소에 거리 셈이 돕니다. */
        if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
            return NOWHERE;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return NOWHERE;
        }
        return new Near(lat, lng);
    }

    /** 기준이 있는지. 없으면 화면은 「근처」라는 말을 안 씁니다. */
    public boolean given() {
        return lat != null && lng != null;
    }

    /** 네모의 남쪽 끝. 기준이 없으면 null — 쿼리가 네모를 안 칩니다. */
    public Double south() {
        return !given() ? null : overPole() ? -90.0 : lat - latSpan();
    }

    /** 네모의 북쪽 끝. */
    public Double north() {
        return !given() ? null : overPole() ? 90.0 : lat + latSpan();
    }

    /** 네모의 서쪽 끝. */
    public Double west() {
        return !given() ? null : overEdge() ? -180.0 : lng - lngSpan();
    }

    /** 네모의 동쪽 끝. */
    public Double east() {
        return !given() ? null : overEdge() ? 180.0 : lng + lngSpan();
    }

    /** 위도로 몇 도만큼 벌리는지. */
    private double latSpan() {
        return RADIUS_M * MARGIN / METERS_PER_DEGREE;
    }

    /**
     * 경도로 몇 도만큼 벌리는지.
     *
     * <p>경도 1도의 길이는 위로 갈수록 짧아집니다. 적도에서 30km 는 0.27도
     * 지만 북위 60도에서는 0.54도입니다 — 위도와 같은 값으로 벌리면 북쪽에서
     * 네모가 원보다 좁아져 <b>안에 있는 곳을 잘라냅니다.</b>
     */
    private double lngSpan() {
        return latSpan() / Math.cos(Math.toRadians(lat));
    }

    /**
     * 네모가 극을 넘는지.
     *
     * <p>극 근처에서는 경도가 뜻을 잃습니다 — 북극점에서 1km 떨어진 두 곳의
     * 경도 차이가 180도일 수 있습니다. 그런 자리에서는 네모로 줄이는 일을
     * <b>포기합니다.</b> 거리는 원이 어차피 정확하게 가리므로, 네모가 전부가
     * 되면 느려질 뿐 틀리지는 않습니다.
     */
    private boolean overPole() {
        return lat - latSpan() < -90 || lat + latSpan() > 90;
    }

    /**
     * 네모가 날짜변경선을 넘는지.
     *
     * <p>피지(동경 179.9)에서 열면 동쪽 끝이 180.2 가 되는데, 그런 경도는
     * 없습니다. 「179.9 ~ 180.2」로 치면 선 바로 서쪽(-179.9)에 있는 곳이
     * 빠집니다 — 눈앞의 가게가 목록에 없는 셈입니다. 그래서 여기서도 네모를
     * 포기하고 원에 맡깁니다.
     */
    private boolean overEdge() {
        return overPole() || Math.abs(lng) + lngSpan() > 180;
    }
}
