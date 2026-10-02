package net.weeniebeenie.fit.account.infrastructure.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 카카오로 로그인하기 — 카카오 쪽 대화.
 *
 * <h3>구글과 길이 다릅니다</h3>
 *
 * <p>구글은 브라우저가 받은 ID 토큰을 서버가 서명으로 확인합니다. 카카오는
 * 브라우저를 카카오로 보냈다가 <b>서버 주소(콜백)로 돌려받습니다</b> — 그
 * 주소에 붙어 오는 일회용 코드를 서버가 카카오에 직접 내고 토큰으로 바꿉니다.
 * 토큰을 브라우저가 한 번도 안 만지고, 사람 정보도 서버가 카카오에게 직접
 * 묻습니다. 그래서 서명을 따로 볼 것이 없습니다 — 받은 곳이 카카오입니다.
 *
 * <h3>state 는 두 겹입니다</h3>
 *
 * <p>콜백 주소는 누구나 부를 수 있습니다. 남이 제 카카오 코드를 붙인 링크를
 * 내게 누르게 하면 <b>내 브라우저가 남의 계정으로 로그인됩니다</b>(로그인
 * CSRF). 그래서 시작할 때 만든 값을 서버에 적어 두고, 같은 값을 그 브라우저의
 * 쿠키에도 둡니다. 콜백에서 둘이 맞아야 받습니다.
 *
 * <p>잇기(설정에서 카카오를 이음)는 그 값에 「누구의 계정에」를 함께 적어
 * 둡니다. 콜백에는 로그인 헤더가 안 실리기 때문입니다.
 *
 * <h3>이메일이 안 올 수 있습니다</h3>
 *
 * <p>카카오는 이메일 동의를 앱 설정과 사람의 선택에 맡깁니다. 확인된
 * 주소({@code is_email_valid}·{@code is_email_verified})만 이메일로 칩니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KakaoLogin {

    public static final String KAKAO = "kakao";

    /** 시작에서 콜백까지 기다리는 시간. 카카오 동의 화면을 읽을 만큼입니다. */
    private static final Duration WAIT = Duration.ofMinutes(10);

    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /** state → 누가 기다리나. 서버 하나에서 돌므로 메모리로 충분합니다. */
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();

    @Value("${fit.social.kakao.rest-key:}")
    private String restKey;

    @Value("${fit.social.kakao.client-secret:}")
    private String clientSecret;

    /** 운영 콜백. 콘솔에 등록한 Redirect URI 입니다. */
    private static final String DEFAULT_REDIRECT = "https://fit.weenie-beenie.net/api/auth/kakao/callback";

    @Value("${fit.social.kakao.redirect-uri:}")
    private String redirectSetting;

    /* 도커는 안 넣은 값도 빈 글자로 넘깁니다. 그러면 스프링의 기본값이 안
       먹으므로 여기서 비었는지 봅니다. */
    private String redirectUri() {
        return redirectSetting == null || redirectSetting.isBlank()
                ? DEFAULT_REDIRECT : redirectSetting.trim();
    }

    /** 앱에 건넬 일회용 표. 받은 사람과, 시작할 때 웹뷰가 낸 값의 해시. */
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();

    /** 표가 살아 있는 시간. 앱으로 돌아와 바로 바꿔 가므로 짧게 둡니다. */
    private static final Duration TICKET = Duration.ofMinutes(2);

    /**
     * 기다리는 한 건.
     *
     * @param userId 잇기면 그 계정. 로그인이면 비어 있습니다
     * @param nonce  앱(껍데기)에서 시작했으면 그 웹뷰가 낸 값의 해시.
     *               브라우저면 비어 있습니다
     */
    public record Pending(String userId, Instant until, String nonce) {
        public boolean fromApp() {
            return nonce != null;
        }
    }

    private record Ticket(String userId, String nonce, Instant until) {
    }

    public boolean enabled() {
        return restKey != null && !restKey.isBlank();
    }

    /** 시작합니다. 돌려준 주소로 브라우저를 보냅니다. */
    public String authorizeUrl(String state, String userId) {
        return authorizeUrl(state, userId, null);
    }

    /**
     * 시작합니다.
     *
     * @param nonce 앱에서 시작했으면 웹뷰가 만든 값. 끝에 표를 바꿀 때 같은
     *              값을 내야 합니다 — 쿠키를 대신하는 두 번째 겹입니다
     */
    public String authorizeUrl(String state, String userId, String nonce) {
        if (!enabled()) {
            throw ApiException.badRequest("카카오 로그인이 꺼져 있어요.");
        }
        sweep();
        pending.put(state, new Pending(userId, Instant.now().plus(WAIT),
                nonce == null ? null : sha256(nonce)));
        return "https://kauth.kakao.com/oauth/authorize?response_type=code"
                + "&client_id=" + enc(restKey.trim())
                + "&redirect_uri=" + enc(redirectUri())
                + "&state=" + enc(state);
    }

    /**
     * 콜백에서 state 를 꺼냅니다. 한 번 쓰면 사라집니다.
     *
     * <p>쿠키 값과 같아야 합니다 — 위 머리말의 두 겹.
     */
    public Pending take(String state, String cookie) {
        if (state == null || state.isBlank()) {
            throw ApiException.badRequest("로그인을 다시 시작해 주세요.");
        }
        Pending got = pending.remove(state);
        if (got == null || got.until().isBefore(Instant.now())) {
            throw ApiException.badRequest("시간이 지났어요. 로그인을 다시 시작해 주세요.");
        }
        /*
          앱에서 시작한 것은 쿠키를 안 봅니다.

          <p>시작은 앱 위에 띄운 브라우저에서 했는데, 카카오톡 앱을 거쳐 돌아올
          때는 다른 브라우저로 올 수 있습니다. 쿠키가 거기에는 없습니다. 대신
          끝에서 표를 바꿀 때 웹뷰가 시작할 때 낸 값을 다시 내야 합니다 —
          남이 만든 표를 내 앱에 밀어 넣어도 그 값을 모르니 못 씁니다.
        */
        if (!got.fromApp() && (cookie == null || !state.equals(cookie))) {
            throw ApiException.badRequest("로그인을 다시 시작해 주세요.");
        }
        return got;
    }

    /** 앱에 건넬 표를 만듭니다. 한 번 쓰면 사라집니다. */
    public String ticketFor(String userId, Pending from) {
        String raw = net.weeniebeenie.fit.shared.domain.Ids.secret();
        tickets.put(sha256(raw), new Ticket(userId, from.nonce(), Instant.now().plus(TICKET)));
        return raw;
    }

    /**
     * 표를 사람으로 바꿉니다. 시작할 때 낸 값이 맞아야 합니다.
     *
     * <p>틀려도 표는 사라집니다. 같은 표로 값을 여러 번 찔러 보지 못하게.
     */
    public String redeem(String ticket, String nonce) {
        if (ticket == null || nonce == null) {
            throw ApiException.badRequest("로그인을 다시 시작해 주세요.");
        }
        Ticket got = tickets.remove(sha256(ticket));
        if (got == null || got.until().isBefore(Instant.now()) || !got.nonce().equals(sha256(nonce))) {
            throw ApiException.badRequest("로그인을 다시 시작해 주세요.");
        }
        return got.userId();
    }

    /** 코드를 토큰으로 바꾸고, 그 토큰으로 누구인지 묻습니다. */
    public SocialTokens.Person read(String code) {
        if (code == null || code.isBlank()) {
            throw ApiException.badRequest("카카오에서 돌아온 값이 비어 있어요.");
        }
        Map<String, String> form = new LinkedHashMap<>();
        form.put("grant_type", "authorization_code");
        form.put("client_id", restKey.trim());
        form.put("redirect_uri", redirectUri());
        form.put("code", code);
        if (clientSecret != null && !clientSecret.isBlank()) {
            form.put("client_secret", clientSecret.trim());
        }

        JsonNode token = send(HttpRequest.newBuilder(URI.create("https://kauth.kakao.com/oauth/token"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(formOf(form)))
                .build());
        String access = token.path("access_token").asText(null);
        if (access == null) {
            throw ApiException.badRequest("카카오 로그인을 마치지 못했어요. 다시 시도해 주세요.");
        }

        JsonNode me = send(HttpRequest.newBuilder(URI.create("https://kapi.kakao.com/v2/user/me"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + access)
                .GET()
                .build());

        String subject = me.path("id").asText(null);
        if (subject == null || subject.isBlank()) {
            throw ApiException.badRequest("카카오가 계정 번호를 주지 않았어요.");
        }
        JsonNode account = me.path("kakao_account");
        /* 확인된 주소만 이메일로 칩니다. 안 확인된 주소를 받으면 그 주소의
           주인이 아닌 사람이 그 주소로 들어옵니다(구글의 email_verified 와
           같은 까닭). */
        String email = account.path("is_email_valid").asBoolean(false)
                && account.path("is_email_verified").asBoolean(false)
                ? account.path("email").asText(null) : null;
        String name = account.path("profile").path("nickname").asText(null);
        if (name == null) {
            name = me.path("properties").path("nickname").asText(null);
        }
        return new SocialTokens.Person(KAKAO, subject, email, name);
    }

    private JsonNode send(HttpRequest req) {
        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                /* 카카오가 무엇이라고 했는지는 기록에만 남깁니다. 화면에 그대로
                   내보내면 설정이 어떻게 틀렸는지를 남에게 알려 주게 됩니다. */
                log.warn("kakao {} {} -> {} {}", req.method(), req.uri().getPath(),
                        res.statusCode(), res.body());
                throw ApiException.badRequest("카카오 로그인을 마치지 못했어요. 다시 시도해 주세요.");
            }
            return mapper.readTree(res.body());
        } catch (ApiException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApiException.badRequest("카카오와 연결하지 못했어요.");
        } catch (Exception e) {
            log.warn("kakao call failed: {}", e.toString());
            throw ApiException.badRequest("카카오와 연결하지 못했어요. 잠시 뒤 다시 해 주세요.");
        }
    }

    /** 지난 것을 걷습니다. 시작만 하고 안 돌아온 사람이 쌓이지 않게. */
    private void sweep() {
        Instant now = Instant.now();
        for (Iterator<Pending> it = pending.values().iterator(); it.hasNext(); ) {
            if (it.next().until().isBefore(now)) {
                it.remove();
            }
        }
        tickets.values().removeIf(t -> t.until().isBefore(now));
    }

    private static String sha256(String raw) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String formOf(Map<String, String> form) {
        return form.entrySet().stream()
                .map(e -> enc(e.getKey()) + "=" + enc(e.getValue()))
                .collect(Collectors.joining("&"));
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
