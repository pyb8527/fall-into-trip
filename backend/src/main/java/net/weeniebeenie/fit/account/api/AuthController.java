package net.weeniebeenie.fit.account.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserMark;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.account.infrastructure.security.JwtProperties;
import net.weeniebeenie.fit.account.infrastructure.security.JwtProvider;
import net.weeniebeenie.fit.account.infrastructure.security.KakaoLogin;
import net.weeniebeenie.fit.account.application.AuthService;
import net.weeniebeenie.fit.account.application.SocialAuthService;
import net.weeniebeenie.fit.account.application.RefreshTokenService;
import net.weeniebeenie.fit.account.api.dto.AuthDtos;
import net.weeniebeenie.fit.account.api.dto.AuthDtos.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 인증.
 *
 * <p>토큰을 둘로 나눠 씁니다.
 * <ul>
 *   <li><b>액세스 토큰</b> — 응답 본문으로만 내려보냅니다. 프론트는 메모리에
 *       들고 있다가 Authorization 헤더에 실어 보냅니다. 저장소에 두지 않으므로
 *       스크립트가 끼어들어도 새어 나가지 않습니다.</li>
 *   <li><b>리프레시 토큰</b> — HttpOnly 쿠키로만 오갑니다. 스크립트가 읽을 수
 *       없고, 경로를 {@code /api/auth} 로 좁혀 다른 요청에는 실리지 않습니다.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String REFRESH_COOKIE = "fit_refresh";
    private static final String COOKIE_PATH = "/api/auth";

    private final AuthService auth;
    private final SocialAuthService social;
    private final RefreshTokenService refreshTokens;
    private final UserRepository users;
    private final JwtProvider jwt;
    private final JwtProperties props;
    private final KakaoLogin kakao;

    /** 카카오 로그인의 state 를 그 브라우저에 묶는 쿠키. {@link KakaoLogin} 의 두 겹. */
    private static final String KAKAO_COOKIE = "fit_kakao_state";
    private static final String KAKAO_PATH = "/api/auth/kakao";

    @GetMapping("/state")
    public AuthStateResponse state() {
        return new AuthStateResponse(auth.setupNeeded(), social.clientId(), kakao.enabled());
    }

    /**
     * 나.
     *
     * <p>{@code hasPassword} 와 {@code providers} 를 함께 내려보냅니다. 설정
     * 화면이 <b>"비밀번호 바꾸기"</b> 를 띄울지 <b>"비밀번호 만들기"</b> 를
     * 띄울지 정해야 하고, 구글로만 들어온 사람에게 현재 비밀번호를 물으면
     * 답할 수가 없습니다.
     */
    @GetMapping("/me")
    public Map<String, Object> me(@CurrentUser AuthPrincipal me) {
        User user = users.findById(me.id())
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요해요."));
        return Map.of(
                "user", UserView.of(user),
                "hasPassword", user.hasPassword(),
                "providers", social.providersOf(user.getId()));
    }

    /** 누구나 가입합니다. 가입하면 바로 로그인된 상태가 됩니다. */
    @PostMapping("/register")
    public ResponseEntity<TokenResponse> register(@Valid @RequestBody RegisterRequest req,
                                                  HttpServletRequest http) {
        User user = auth.register(req.email(), req.name(), req.password());
        return withNewSession(user, http);
    }

    @PostMapping("/setup")
    public ResponseEntity<TokenResponse> setup(@Valid @RequestBody SetupRequest req,
                                               HttpServletRequest http) {
        User admin = auth.setup(req.email(), req.name(), req.password(), req.token());
        return withNewSession(admin, http);
    }

    /**
     * 구글로 들어옵니다.
     *
     * <p>브라우저가 구글에게 받은 ID 토큰을 그대로 보냅니다. 서버가 그것을
     * 검증하고, <b>지금 로그인과 똑같은 모양</b>으로 세션을 내줍니다 —
     * 세션을 내주는 자리가 하나라 소셜이 붙어도 규칙이 안 갈라집니다.
     *
     * <p>이미 그 주소로 비밀번호 계정이 있으면 409 입니다. 자동으로 잇지
     * 않습니다 — 그 까닭은 {@link SocialAuthService} 에 적었습니다.
     */
    @PostMapping("/google")
    public ResponseEntity<TokenResponse> google(@RequestBody SocialRequest req,
                                                HttpServletRequest http) {
        User user = social.signIn(req == null ? null : req.credential());
        return withNewSession(user, http);
    }

    /* ------------------------------------------------------------ 카카오 */

    /**
     * 카카오로 들어가기 — 시작.
     *
     * <p>화면이 이 주소로 <b>페이지를 옮깁니다</b>(fetch 가 아니라). 카카오
     * 동의 화면을 거쳐 아래 콜백으로 돌아옵니다.
     */
    @GetMapping("/kakao/start")
    public ResponseEntity<Void> kakaoStart() {
        if (!kakao.enabled()) {
            return back("/login", "카카오 로그인이 꺼져 있어요.");
        }
        String state = net.weeniebeenie.fit.shared.domain.Ids.secret();
        return ResponseEntity.status(302)
                .header(HttpHeaders.SET_COOKIE, kakaoCookie(state).toString())
                .header(HttpHeaders.LOCATION, kakao.authorizeUrl(state, null))
                .build();
    }

    /**
     * 로그인한 사람이 자기 계정에 카카오를 잇습니다 — 시작.
     *
     * <p>콜백에는 로그인 헤더가 안 실리므로, 여기서 「누구의 계정에」를
     * state 에 적어 두고 갈 주소를 돌려줍니다. 화면은 그 주소로 옮깁니다.
     */
    @PostMapping("/link/kakao")
    public ResponseEntity<Map<String, Object>> kakaoLink(@CurrentUser AuthPrincipal me) {
        String state = net.weeniebeenie.fit.shared.domain.Ids.secret();
        String url = kakao.authorizeUrl(state, me.id());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, kakaoCookie(state).toString())
                .body(Map.of("url", url));
    }

    /**
     * 카카오에서 돌아오는 자리. 카카오 콘솔에 적은 Redirect URI 가 이것입니다.
     *
     * <p>들어오기면 세션 쿠키를 심고 첫 화면으로, 잇기면 설정으로 보냅니다.
     * 화면은 켤 때 늘 쿠키로 세션을 되살리므로(auth-provider) 따로 넘길 것이
     * 없습니다. 안 됐으면 까닭을 주소에 실어 되돌립니다.
     */
    @GetMapping("/kakao/callback")
    public ResponseEntity<Void> kakaoCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @CookieValue(name = KAKAO_COOKIE, required = false) String cookie,
            HttpServletRequest http) {
        KakaoLogin.Pending waiting;
        try {
            waiting = kakao.take(state, cookie);
        } catch (ApiException e) {
            return back("/login", e.getMessage());
        }
        String home = waiting.userId() == null ? "/login" : "/settings";

        /* 동의 화면에서 「취소」를 누르면 code 없이 error 만 옵니다. 그건
           잘못이 아니라 마음을 바꾼 것이라 아무 말 없이 되돌립니다. */
        if (error != null || code == null) {
            return back(home, null);
        }
        try {
            var who = kakao.read(code);
            if (waiting.userId() != null) {
                social.link(waiting.userId(), who);
                return back("/settings", null);
            }
            User user = social.signIn(who);
            String refresh = refreshTokens.issue(user.getId(),
                    http.getHeader(HttpHeaders.USER_AGENT), clientIp(http));
            return ResponseEntity.status(302)
                    .header(HttpHeaders.SET_COOKIE, refreshCookie(refresh).toString())
                    .header(HttpHeaders.SET_COOKIE, kakaoCookie("").toString())
                    .header(HttpHeaders.LOCATION, "/")
                    .build();
        } catch (ApiException e) {
            return back(home, e.getMessage());
        }
    }

    /** 화면으로 돌려보냅니다. 할 말이 있으면 주소에 싣습니다. state 쿠키는 걷습니다. */
    private ResponseEntity<Void> back(String path, String message) {
        String to = message == null ? path
                : path + "?social_error=" + java.net.URLEncoder.encode(message,
                java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.status(302)
                .header(HttpHeaders.SET_COOKIE, kakaoCookie("").toString())
                .header(HttpHeaders.LOCATION, to)
                .build();
    }

    /**
     * state 쿠키. 비우면 걷습니다.
     *
     * <p>{@code Lax} 라야 합니다 — 카카오에서 우리 주소로 넘어오는 것은 남의
     * 사이트에서 오는 이동이고, {@code Strict} 면 그때 쿠키가 안 실립니다.
     */
    private ResponseCookie kakaoCookie(String state) {
        return ResponseCookie.from(KAKAO_COOKIE, state)
                .httpOnly(true)
                .secure(props.isSecureCookie())
                .sameSite("Lax")
                .path(KAKAO_PATH)
                .maxAge(state.isEmpty() ? 0 : 600)
                .build();
    }

    /** 로그인한 사람이 자기 계정에 구글을 잇습니다. */
    @PostMapping("/link/google")
    public Map<String, Object> link(@CurrentUser AuthPrincipal me,
                                    @RequestBody SocialRequest req) {
        social.link(me.id(), req == null ? null : req.credential());
        return Map.of("providers", social.providersOf(me.id()));
    }

    /** 끊습니다. 끊고 나서 들어올 길이 없으면 거절합니다. */
    @DeleteMapping("/link/{provider}")
    public Map<String, Object> unlink(@CurrentUser AuthPrincipal me,
                                      @PathVariable String provider) {
        social.unlink(me.id(), provider);
        return Map.of("providers", social.providersOf(me.id()));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest req,
                                               HttpServletRequest http) {
        User user = auth.login(req.email(), req.password(), clientIp(http));
        return withNewSession(user, http);
    }

    /**
     * 액세스 토큰 재발급.
     *
     * 쿠키로 온 리프레시 토큰을 새 것으로 갈아 끼웁니다. 이미 쓴 토큰이 다시
     * 오면 가로챈 것으로 보고 그 로그인 전체를 끊습니다.
     */
    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String cookie,
            HttpServletRequest http) {

        var rotated = refreshTokens.rotate(cookie, http.getHeader(HttpHeaders.USER_AGENT), clientIp(http))
                .orElseThrow(() -> ApiException.unauthorized("다시 로그인해 주세요."));

        User user = users.findById(rotated.userId())
                .filter(u -> !u.isDisabled())
                .orElseThrow(() -> ApiException.unauthorized("다시 로그인해 주세요."));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(rotated.token()).toString())
                .body(new TokenResponse(auth.issueAccessToken(user), jwt.accessTtlSeconds(), UserView.of(user)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String cookie) {
        refreshTokens.revoke(cookie);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearedCookie().toString())
                .body(Map.of("ok", true));
    }

    /** 모든 기기에서 내보냅니다. */
    @PostMapping("/logout-all")
    public ResponseEntity<Map<String, Object>> logoutAll(@CurrentUser AuthPrincipal me) {
        int n = refreshTokens.revokeAllOf(me.id());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearedCookie().toString())
                .body(Map.of("ok", true, "revoked", n));
    }

    @PostMapping("/password")
    public ResponseEntity<TokenResponse> changePassword(@CurrentUser AuthPrincipal me,
                                                        @Valid @RequestBody PasswordChangeRequest req,
                                                        HttpServletRequest http) {
        auth.changePassword(me.id(), req.current(), req.next());
        User user = users.findById(me.id()).orElseThrow();
        /* 방금 전부 끊었으므로 이 기기용으로 새 세션을 하나 내줍니다. */
        return withNewSession(user, http);
    }

    /**
     * 지도에서 나를 가리킬 그림을 고릅니다.
     *
     * <p>비밀번호와 달리 세션을 건드리지 않습니다. 그림 하나 바꿨다고 다른
     * 기기에서 로그아웃될 이유가 없습니다.
     */
    @PatchMapping("/mark")
    public Map<String, Object> mark(@CurrentUser AuthPrincipal me,
                                    @RequestBody AuthDtos.MarkRequest req) {
        User user = users.findById(me.id()).orElseThrow();
        user.setMark(UserMark.clean(req == null ? null : req.mark()));
        users.save(user);
        return Map.of("user", AuthDtos.UserView.of(user));
    }

    /* ------------------------------------------------------------ 도우미 */

    private ResponseEntity<TokenResponse> withNewSession(User user, HttpServletRequest http) {
        String refresh = refreshTokens.issue(user.getId(),
                http.getHeader(HttpHeaders.USER_AGENT), clientIp(http));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(refresh).toString())
                .body(new TokenResponse(auth.issueAccessToken(user), jwt.accessTtlSeconds(), UserView.of(user)));
    }

    private ResponseCookie refreshCookie(String token) {
        return ResponseCookie.from(REFRESH_COOKIE, token)
                .httpOnly(true)
                .secure(props.isSecureCookie())
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(props.getRefreshTtl())
                .build();
    }

    private ResponseCookie clearedCookie() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(props.isSecureCookie())
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(0)
                .build();
    }

    /** Cloudflare·nginx 뒤에 있으므로 원래 주소를 헤더에서 찾습니다. */
    private static String clientIp(HttpServletRequest req) {
        for (String header : new String[]{"CF-Connecting-IP", "X-Forwarded-For"}) {
            String value = req.getHeader(header);
            if (value != null && !value.isBlank()) {
                return value.split(",")[0].trim();
            }
        }
        return req.getRemoteAddr();
    }
}
