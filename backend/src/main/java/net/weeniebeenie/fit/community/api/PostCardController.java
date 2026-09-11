package net.weeniebeenie.fit.community.api;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.community.application.PostService;
import net.weeniebeenie.fit.community.domain.TripPost;
import net.weeniebeenie.fit.trip.application.StaticMapService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * 링크를 붙여 넣었을 때 펼쳐지는 카드.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>둘러보기를 계정 없이 열어 둔 이유는 <b>남이 보내 준 링크로 들어오는
 * 것</b>이었습니다. 그런데 정작 그 링크를 카톡·슬랙·디스코드에 붙이면 맨
 * 주소만 뜹니다. 받은 사람은 무엇인지 모르는 주소를 눌러야 하고, 대부분
 * 누르지 않습니다.
 *
 * <p>미리보기를 만드는 것들은 주소를 받아 <b>HTML 의 머리만</b> 읽습니다.
 * 우리 화면은 브라우저가 자바스크립트를 돌려야 그려지므로, 그들이 받아 가는
 * 것은 제목도 그림도 없는 빈 껍데기입니다. 게다가 화면은 주소마다 다른
 * 파일이 아니라 <code>index.html</code> 한 장이라, 글마다 다른 제목을 박아
 * 둘 자리 자체가 없습니다.
 *
 * <h3>사람과 기계에 다른 것을 줍니다</h3>
 *
 * <p>nginx 가 <code>/community/{id}</code> 로 들어온 요청 중 <b>펼치는
 * 것들만</b> 골라 여기로 넘깁니다(frontend/nginx.conf). 사람은 지금까지처럼
 * 화면을 받고, 기계는 이 한 장을 받습니다. 화면 코드는 건드리지 않습니다.
 *
 * <p>그림은 이미 있는 <code>/api/posts/{id}/map</code> 을 그대로 씁니다.
 * 서버가 6시간 들고 있고 브라우저에도 그만큼 담기라고 일러 두었으므로,
 * 여럿이 같은 글을 붙여 넣어도 구글을 다시 부르지 않습니다.
 *
 * <h3>못 그리는 글에는 그림을 걸지 않습니다</h3>
 *
 * <p>좌표가 하나도 없는 일정이나 지도 키를 안 넣어 둔 판에서는 그림 주소가
 * 오류를 냅니다. 그때 <code>og:image</code> 를 그대로 적어 두면 카드에
 * 깨진 그림 자리가 남습니다. 아예 빼면 제목과 설명만으로 단정하게 뜹니다.
 */
@RestController
@RequiredArgsConstructor
public class PostCardController {

    private final PostService posts;
    private final StaticMapService maps;

    /**
     * 펼치는 쪽이 들고 갈 정보만 담은 한 장.
     *
     * <p>사람이 이 주소로 직접 들어오는 일은 거의 없지만, 들어왔을 때 빈
     * 화면을 보지 않도록 본문에 원래 자리로 가는 줄을 하나 둡니다.
     */
    @GetMapping(value = "/api/posts/{postId}/card", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> card(@PathVariable String postId) {
        TripPost post = posts.read(postId);

        String origin = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
        String page = origin + "/community/" + postId;
        String image = hasPoints(posts.snapshotOf(post)) && maps.enabled()
                ? origin + "/api/posts/" + postId + "/map"
                : null;

        StringBuilder html = new StringBuilder(1024);
        html.append("<!doctype html>\n<html lang=\"ko\">\n<head>\n");
        html.append("<meta charset=\"utf-8\">\n");
        html.append(tag("title", post.getTitle() + " · FIT"));
        html.append(meta("description", describe(post)));
        html.append("<link rel=\"canonical\" href=\"").append(escape(page)).append("\">\n");

        html.append(og("og:type", "article"));
        html.append(og("og:site_name", "FIT"));
        html.append(og("og:locale", "ko_KR"));
        html.append(og("og:url", page));
        html.append(og("og:title", post.getTitle()));
        html.append(og("og:description", describe(post)));

        if (image != null) {
            html.append(og("og:image", image));
            /* 크기를 적어 두면 펼치는 쪽이 그림을 받기 전에 자리를 잡습니다.
               StaticMapService 에 넘기는 값과 같아야 합니다. */
            html.append(og("og:image:width", "600"));
            html.append(og("og:image:height", "320"));
            html.append(og("og:image:alt", post.getTitle() + " 동선"));
            /* 트위터는 og: 를 대부분 물려받지만 카드 모양만은 따로 말해야
               넓은 그림으로 폅니다. */
            html.append(meta("twitter:card", "summary_large_image"));
        } else {
            html.append(meta("twitter:card", "summary"));
        }

        html.append("</head>\n<body>\n");
        html.append("<h1>").append(escape(post.getTitle())).append("</h1>\n");
        html.append("<p>").append(escape(describe(post))).append("</p>\n");
        html.append("<p><a href=\"").append(escape(page)).append("\">FIT 에서 보기</a></p>\n");
        html.append("</body>\n</html>\n");

        return ResponseEntity.ok()
                /* 글의 일정은 올릴 때 뜬 사본이라 바뀌지 않습니다. 다만 제목과
                   소개는 글쓴이가 고칠 수 있으므로 그림만큼 길게 잡지
                   않습니다. */
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                /* 같은 주소가 사람에게는 화면을, 펼치는 쪽에는 이 한 장을
                   줍니다. 중간에 있는 캐시가 둘을 섞지 않게 알려 둡니다. */
                .header(HttpHeaders.VARY, HttpHeaders.USER_AGENT)
                .body(html.toString());
    }

    /**
     * 카드 밑에 깔릴 한 줄.
     *
     * <p>글쓴이가 적어 둔 소개가 있으면 그것이 먼저입니다. 없으면 어떤
     * 일정인지 셈으로 말합니다 — 어디를, 며칠, 몇 곳.
     */
    private String describe(TripPost post) {
        List<String> parts = new ArrayList<>();
        if (post.getRegion() != null && !post.getRegion().isBlank()) {
            parts.add(post.getRegion());
        }
        parts.add(post.getDayCount() + "일");
        parts.add(post.getPlaceCount() + "곳");
        parts.add(posts.authorNameOf(post));

        String facts = String.join(" · ", parts);
        String summary = post.getSummary();
        return summary == null || summary.isBlank() ? facts : facts + " — " + summary;
    }

    /** 찍을 점이 하나라도 있는지. 없으면 지도 그림 쪽이 오류를 냅니다. */
    private boolean hasPoints(JsonNode snapshot) {
        for (JsonNode day : snapshot.path("days")) {
            for (JsonNode place : day.path("places")) {
                if (place.hasNonNull("lat") && place.hasNonNull("lng")) {
                    return true;
                }
            }
        }
        return false;
    }

    private static String tag(String name, String text) {
        return "<" + name + ">" + escape(text) + "</" + name + ">\n";
    }

    private static String meta(String name, String content) {
        return "<meta name=\"" + name + "\" content=\"" + escape(content) + "\">\n";
    }

    /** 오픈그래프는 <code>name</code> 이 아니라 <code>property</code> 를 씁니다. */
    private static String og(String property, String content) {
        return "<meta property=\"" + property + "\" content=\"" + escape(content) + "\">\n";
    }

    /**
     * 글쓴이가 적은 것이 그대로 HTML 이 되지 않게.
     *
     * <p>제목과 소개는 사람이 적습니다. 따옴표 하나만 새어 나가도 속성이
     * 거기서 끊기고, 그 뒤는 우리가 쓰지 않은 표가 됩니다.
     */
    private static String escape(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
