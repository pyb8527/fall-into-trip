package net.weeniebeenie.fit.trip.application;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.PlaceKind;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 이름으로 장소를 찾습니다.
 *
 * <p>구글에 직접 묻지 않고 서버가 대신 물어봅니다. 이유가 둘입니다.
 *
 * <ul>
 *   <li><b>키를 숨깁니다.</b> 앱 번들에 키를 심으면 누구나 꺼내 씁니다.
 *       브라우저에서 부르는 것도 마찬가지고, 그쪽은 CORS 로 막히기까지 합니다.
 *       서버에만 두면 나가는 곳이 여기 한 군데뿐입니다.</li>
 *   <li><b>웹과 앱이 같은 길을 씁니다.</b> 화면마다 다른 방식으로 찾으면
 *       결과 모양이 갈리고, 고칠 일이 생길 때마다 두 곳을 만져야 합니다.</li>
 * </ul>
 *
 * <p>로그인한 사람만 부를 수 있습니다(SecurityConfig 의 /api/** 규칙). 열어
 * 두면 남이 우리 사용량을 태웁니다.
 */
@Slf4j
@Service
public class PlaceSearchService {

    /** 한 번에 돌려줄 개수. 더 많이 보여 줘도 고르기만 어려워집니다. */
    private static final int LIMIT = 6;

    /**
     * 달라고 할 것.
     *
     * <p>새 API 는 무엇을 달라고 했는지에 따라 요금 등급이 갈립니다. 넓게
     * 적으면 비싼 쪽으로 넘어가므로 화면이 실제로 쓰는 것만 적습니다.
     *
     * <p>사진과 후기는 넣지 않습니다 — 그쪽은 글쓴이 이름과 프로필을 함께
     * 띄워야 하는 별도의 의무가 따라붙습니다.
     */
    private static final String FIELDS = String.join(",",
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.location",
            "places.types",
            "places.rating",
            "places.userRatingCount");

    private final RestClient client = RestClient.builder()
            .baseUrl("https://places.googleapis.com")
            .build();

    /**
     * 서버 전용 키.
     *
     * 웹에서 쓰는 키와 다른 것이어야 합니다. 그쪽은 HTTP 리퍼러로 묶여 있는데,
     * 서버가 부를 때는 리퍼러가 없어 거절당합니다. 이 키는 서버 IP 로 묶습니다.
     */
    @Value("${fit.google.maps-key:}")
    private String key;

    public boolean enabled() {
        return key != null && !key.isBlank();
    }

    public List<Found> search(String query) {
        return search(query, null, null, null);
    }

    /**
     * 어느 언저리에서 찾을지를 함께 일러 줍니다.
     *
     * <p>"조용한 카페" 만으로는 구글이 어디 카페인지 모릅니다. 서울에서 짜는
     * 오사카 일정에 서울 카페가 올라옵니다. 여행에 이미 꽂힌 핀들의 한가운데를
     * 넘겨 주면 그 언저리에서 찾습니다.
     *
     * <p>가운데를 모르면(아직 아무것도 안 넣은 여행) 그냥 넘어갑니다. 억지로
     * 어딘가를 찍는 것보다 넓게 찾는 편이 낫습니다.
     *
     * @param radiusM 반경(미터). 이 밖도 나올 수 있습니다 — 구글에게 이것은
     *                울타리가 아니라 기울기입니다.
     */
    public List<Found> search(String query, Double lat, Double lng, Integer radiusM) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            return List.of();
        }
        if (!enabled()) {
            throw ApiException.badRequest("장소 검색이 꺼져 있습니다. 좌표를 직접 넣어 주세요.");
        }

        /*
          찾을 것과 어디쯤인지를 몸통에 실어 보냅니다.

          옛 API 는 이것을 주소에 붙였는데, 새 API 는 POST 로 받습니다. 찾는
          말이 주소에 실리지 않는 편이 낫기도 합니다 — 중간의 기록에 남지
          않습니다.
         */
        Map<String, Object> ask = new LinkedHashMap<>();
        ask.put("textQuery", q);
        ask.put("languageCode", "ko");
        ask.put("maxResultCount", LIMIT);
        if (lat != null && lng != null) {
            /* 울타리가 아니라 기울기입니다 — 이 밖의 곳도 나올 수 있고,
               나와야 합니다. 근교의 온천처럼 일부러 멀리 나가는 곳이 있습니다. */
            ask.put("locationBias", Map.of("circle", Map.of(
                    "center", Map.of("latitude", lat, "longitude", lng),
                    "radius", (double) (radiusM == null ? 20000 : radiusM))));
        }

        JsonNode body;
        try {
            body = client.post()
                    .uri("/v1/places:searchText")
                    .header("X-Goog-Api-Key", key)
                    .header("X-Goog-FieldMask", FIELDS)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(ask)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            /*
              왜 거절했는지는 본문에 적혀 있습니다.

              이것을 버리면 "못 찾았습니다" 만 남아, 키가 잘못된 것인지
              콘솔에서 이 API 를 안 켠 것인지 알 길이 없습니다. 옛 API 에서
              옮겨 온 뒤 가장 흔한 것이 바로 그 "안 켬" 입니다.
             */
            String why = e.getResponseBodyAsString();
            log.warn("장소 검색이 거절됐습니다 ({}): {}", e.getStatusCode(),
                    why.length() > 300 ? why.substring(0, 300) : why);
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "장소 검색을 쓸 수 없습니다. 좌표를 직접 넣어 주세요.");
        } catch (Exception e) {
            /* 구글이 느리거나 막혔습니다. 우리 잘못이 아니라는 것만 알려 줍니다. */
            log.warn("장소 검색 요청이 실패했습니다: {}", e.getMessage());
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "장소를 찾지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        }

        if (body == null) {
            return List.of();
        }

        /* 새 API 는 status 를 보내지 않습니다. 찾은 것이 없으면 places 가
           아예 없습니다 — 그것이 옛 ZERO_RESULTS 자리입니다. */
        List<Found> out = new ArrayList<>();
        for (JsonNode r : body.path("places")) {
            JsonNode at = r.path("location");
            if (!at.hasNonNull("latitude") || !at.hasNonNull("longitude")) {
                continue;
            }
            String name = r.path("displayName").path("text").asText(q);
            /* 갈래는 검색 결과에 이미 딸려 옵니다. 이것으로 핀 그림을 미리
               찍어 두면 구글을 한 번도 더 부르지 않고 지도가 알아봅니다. */
            List<String> types = new ArrayList<>();
            for (JsonNode t : r.path("types")) {
                types.add(t.asText(""));
            }
            out.add(new Found(
                    name,
                    r.path("formattedAddress").asText(""),
                    at.path("latitude").asDouble(),
                    at.path("longitude").asDouble(),
                    r.path("id").asText(null),
                    PlaceKind.guess(types, name),
                    /* 평점은 검색 응답에 이미 딸려 옵니다. 이것 때문에 장소마다
                       한 번 더 물어볼 이유가 없습니다. */
                    r.hasNonNull("rating") ? r.path("rating").asDouble() : null,
                    r.hasNonNull("userRatingCount") ? r.path("userRatingCount").asInt() : null));
            if (out.size() >= LIMIT) {
                break;
            }
        }
        return out;
    }

    /** 화면이 쓰는 만큼만. 구글 응답을 그대로 흘려보내지 않습니다. */
    /**
     * @param placeId 구글이 아는 번호. 이것만 저장이 허용됩니다. 나머지 내용은
     *                필요할 때마다 이 번호로 다시 물어봅니다.
     */
    public record Found(String name, String address, double lat, double lng, String placeId,
                        String icon, Double rating, Integer ratingCount) {
    }
}
