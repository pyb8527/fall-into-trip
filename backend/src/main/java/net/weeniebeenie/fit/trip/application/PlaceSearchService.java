package net.weeniebeenie.fit.trip.application;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.PlaceKind;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

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

    private final RestClient client = RestClient.builder()
            .baseUrl("https://maps.googleapis.com")
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
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            return List.of();
        }
        if (!enabled()) {
            throw ApiException.badRequest("장소 검색이 꺼져 있습니다. 좌표를 직접 넣어 주세요.");
        }

        JsonNode body;
        try {
            body = client.get()
                    .uri(uri -> uri.path("/maps/api/place/textsearch/json")
                            .queryParam("query", q)
                            .queryParam("language", "ko")
                            .queryParam("key", key)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
        } catch (Exception e) {
            /* 구글이 느리거나 막혔습니다. 우리 잘못이 아니라는 것만 알려 줍니다. */
            log.warn("장소 검색 요청이 실패했습니다: {}", q, e);
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "장소를 찾지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        }

        if (body == null) {
            return List.of();
        }
        String status = body.path("status").asText("");
        if ("ZERO_RESULTS".equals(status)) {
            return List.of();
        }
        if (!"OK".equals(status)) {
            /* 상태 코드를 그대로 보여 주면 쓰는 사람은 무슨 말인지 모릅니다.
               자세한 것은 로그에만 남기고, 화면에는 다음에 할 일만 말합니다. */
            log.warn("장소 검색이 거절됐습니다: status={} message={}",
                    status, body.path("error_message").asText(""));
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "장소 검색을 쓸 수 없습니다. 좌표를 직접 넣어 주세요.");
        }

        List<Found> out = new ArrayList<>();
        for (JsonNode r : body.path("results")) {
            JsonNode at = r.path("geometry").path("location");
            if (!at.hasNonNull("lat") || !at.hasNonNull("lng")) {
                continue;
            }
            String name = r.path("name").asText(q);
            /* 갈래는 검색 결과에 이미 딸려 옵니다. 이것으로 핀 그림을 미리
               찍어 두면 구글을 한 번도 더 부르지 않고 지도가 알아봅니다. */
            List<String> types = new ArrayList<>();
            for (JsonNode t : r.path("types")) {
                types.add(t.asText(""));
            }
            out.add(new Found(
                    name,
                    r.path("formatted_address").asText(""),
                    at.path("lat").asDouble(),
                    at.path("lng").asDouble(),
                    r.path("place_id").asText(null),
                    PlaceKind.guess(types, name)));
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
                        String icon) {
    }
}
