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
     *
     * <p><b>point_of_interest 와 establishment 는 아예 안 봅니다.</b> 거의 모든
     * 장소에 붙는 값이라 갈래를 가리는 데 쓸모가 없는데, 한동안 그것으로
     * 명소를 판단해서 식당과 학교까지 도리이 그림을 달고 있었습니다.
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
        if (has(text, "라멘", "라면", "우동", "소바", "ramen", "udon", "soba", "국수",
                "츠케멘", "쯔케멘", "tsukemen", "면가", "누들", "noodle")) {
            return "ramen";
        }
        if (has(text, "스시", "초밥", "sushi", "회", "sashimi")) {
            return "sushi";
        }
        if (has(text, "야키니쿠", "고기", "구이", "bbq", "steak", "스테이크", "곱창",
                "야키토리", "꼬치", "yakitori", "skewer", "닭갈비")) {
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
        /*
          밥이 명소보다 먼저입니다.

          <p>아래 sight 에 point_of_interest 가 들어 있었고, 그것이 이 검사보다
          앞에 있었습니다. 그런데 구글은 <b>거의 모든 장소</b>에 그 갈래를
          붙입니다 — 식당에도, 가게에도, 학교에도. 그래서 츠케멘집과 꼬치집이
          도리이 그림을 달고 "명소" 로 묶였습니다.

          <p>앞선 이름 규칙(라멘·초밥·고기…)이 못 걸러 낸 식당은 여기서
          걸러야 합니다. 명소 판단은 그다음입니다.
        */
        if (types.contains("restaurant") || types.contains("meal_takeaway")
                || types.contains("meal_delivery") || types.contains("food")) {
            return "food";
        }
        /*
          진짜 명소만.

          point_of_interest 와 establishment 는 뺐습니다. 거의 모든 장소에
          붙는 값이라 갈래를 가리는 데 아무 쓸모가 없고, 오히려 다른 판단을
          가로챕니다.
        */
        if (types.contains("tourist_attraction")
                || types.contains("place_of_worship") || types.contains("church")
                || types.contains("hindu_temple") || types.contains("mosque")
                || types.contains("shinto_shrine") || types.contains("buddhist_temple")
                || types.contains("landmark") || types.contains("historical_landmark")
                || types.contains("observation_deck") || types.contains("castle")) {
            return "sight";
        }
        /*
          모르면 비워 둡니다.

          학교·병원·관공서처럼 우리 열여섯 갈래에 없는 곳이 있습니다. 그런
          것에 아무 그림이나 찍으면 지도에서 <b>틀린 말</b>을 하게 됩니다.
          비워 두면 번호만 찍히고, 사람이 고르고 싶으면 고르면 됩니다.
        */
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
