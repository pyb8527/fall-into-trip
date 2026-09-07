package net.weeniebeenie.fit.account.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.account.infrastructure.security.JwtProperties;
import net.weeniebeenie.fit.account.infrastructure.security.JwtProvider;
import net.weeniebeenie.fit.account.application.AuthService;
import net.weeniebeenie.fit.account.application.RefreshTokenService;
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
    private final RefreshTokenService refreshTokens;
    private final UserRepository users;
    private final JwtProvider jwt;
    private final JwtProperties props;

    @GetMapping("/state")
    public AuthStateResponse state() {
        return new AuthStateResponse(auth.setupNeeded());
    }

    @GetMapping("/me")
    public Map<String, Object> me(@CurrentUser AuthPrincipal me) {
        User user = users.findById(me.id())
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요합니다."));
        return Map.of("user", UserView.of(user));
    }

    @PostMapping("/setup")
    public ResponseEntity<TokenResponse> setup(@Valid @RequestBody SetupRequest req,
                                               HttpServletRequest http) {
        User admin = auth.setup(req.email(), req.name(), req.password(), req.token());
        return withNewSession(admin, http);
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
