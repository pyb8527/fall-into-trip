package net.weeniebeenie.fit.trip.domain;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 지도에 찍히는 그림의 갈래.
 *
 * <p>같은 모양 핀이 스무 개 꽂혀 있으면 지도는 그냥 점의 무리입니다. 라멘집인지
 * 온천인지가 핀만 보고 읽히면, 다 짜 놓은 지도를 한 장으로 찍었을 때 그것이 곧
 * 여행의 요약이 됩니다.
 *
 * <p>여기에는 <b>이름만</b> 둡니다. 실제로 어떤 이모지를 그릴지는 화면이
 * 정합니다. 이모지는 기기마다 다르게 생기고 언젠가 바꾸고 싶어지는데, 저장된
 * 값이 이모지면 그때 쌓인 것을 전부 고쳐야 합니다.
 *
 * <p>갈래를 열여섯으로 묶어 두었습니다. 더 잘게 나누면 고를 때 목록을 훑어야
 * 하고, 어느 것에 넣어야 할지 매번 망설이게 됩니다.
 */
public final class PlaceKind {

    private PlaceKind() {
    }

    /**
     * 쓸 수 있는 이름.
     *
     * <p>순서가 곧 고르는 화면에 늘어놓는 순서입니다. 자주 쓰는 것(밥·카페)이
     * 앞에 옵니다.
     */
    public static final List<String> ALL = List.of(
            "food",     // 밥
            "cafe",     // 카페
            "ramen",    // 면
            "sushi",    // 초밥·회
            "meat",     // 고기
            "dessert",  // 디저트
            "bar",      // 술
            "shop",     // 쇼핑
            "sight",    // 명소
            "nature",   // 자연
            "onsen",    // 온천·목욕
            "stay",     // 숙소
            "move",     // 역·공항
            "park",     // 놀이공원
            "art",      // 미술관·박물관
            "show");    // 공연·경기

    private static final Set<String> KNOWN = Set.copyOf(ALL);

    /** 화면에서 넘어온 값을 그대로 믿지 않습니다. 모르는 이름이면 비웁니다. */
    public static String clean(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim().toLowerCase(Locale.ROOT);
        return KNOWN.contains(value) ? value : null;
    }

    /**
     * 구글이 알려 준 갈래로 짐작합니다.
     *
     * <p>장소를 넣을 때마다 사람에게 그림을 고르라고 하면 그것이 일이 됩니다.
     * 검색 결과에 이미 갈래가 딸려 오므로, 그것으로 먼저 찍어 두고 마음에 안
     * 들 때만 바꾸게 합니다. 이 짐작에는 구글을 한 번도 더 부르지 않습니다.
     *
     * <p>구글은 갈래를 여러 개 줍니다("restaurant", "food", "point_of_interest").
     * 넓은 것이 뒤에 오도록 아래 순서로 훑어, 가장 좁은 뜻이 이깁니다.
     */
    public static String guess(List<String> googleTypes, String name) {
        Set<String> types = new LinkedHashSet<>();
        if (googleTypes != null) {
            for (String t : googleTypes) {
                if (t != null) {
                    types.add(t.toLowerCase(Locale.ROOT));
                }
            }
        }
        String text = name == null ? "" : name.toLowerCase(Locale.ROOT);

        /* 이름에 대놓고 적혀 있으면 그게 가장 정확합니다. 구글은 라멘집도
           그냥 "restaurant" 로 줍니다. */
        if (has(text, "라멘", "라면", "우동", "소바", "ramen", "udon", "soba", "국수")) {
            return "ramen";
        }
        if (has(text, "스시", "초밥", "sushi", "회", "sashimi")) {
            return "sushi";
        }
        if (has(text, "야키니쿠", "고기", "구이", "bbq", "steak", "스테이크", "곱창")) {
            return "meat";
        }
        if (has(text, "온천", "onsen", "센토", "찜질", "sauna", "spa", "탕")) {
            return "onsen";
        }
        if (has(text, "이자카야", "izakaya", "포차", "맥주", "beer", "bar", "펍", "pub", "와인")) {
            return "bar";
        }

        if (types.contains("lodging") || types.contains("hotel")) {
            return "stay";
        }
        if (types.contains("cafe") || types.contains("coffee_shop")) {
            return "cafe";
        }
        if (types.contains("bakery") || types.contains("ice_cream_shop")
                || types.contains("dessert_shop")) {
            return "dessert";
        }
        if (types.contains("bar") || types.contains("night_club")) {
            return "bar";
        }
        if (types.contains("spa") || types.contains("onsen")) {
            return "onsen";
        }
        if (types.contains("amusement_park") || types.contains("zoo")
                || types.contains("aquarium")) {
            return "park";
        }
        if (types.contains("museum") || types.contains("art_gallery")) {
            return "art";
        }
        if (types.contains("stadium") || types.contains("movie_theater")
                || types.contains("performing_arts_theater")) {
            return "show";
        }
        if (types.contains("park") || types.contains("natural_feature")
                || types.contains("campground") || types.contains("beach")) {
            return "nature";
        }
        if (types.contains("train_station") || types.contains("subway_station")
                || types.contains("bus_station") || types.contains("airport")
                || types.contains("transit_station")) {
            return "move";
        }
        if (types.contains("shopping_mall") || types.contains("department_store")
                || types.contains("store") || types.contains("clothing_store")
                || types.contains("convenience_store") || types.contains("supermarket")) {
            return "shop";
        }
        if (types.contains("tourist_attraction") || types.contains("point_of_interest")
                || types.contains("place_of_worship") || types.contains("church")
                || types.contains("hindu_temple") || types.contains("mosque")
                || types.contains("landmark") || types.contains("historical_landmark")) {
            return "sight";
        }
        if (types.contains("restaurant") || types.contains("meal_takeaway")
                || types.contains("food")) {
            return "food";
        }
        return null;
    }

    private static boolean has(String text, String... words) {
        for (String w : words) {
            if (text.contains(w)) {
                return true;
            }
        }
        return false;
    }
}
