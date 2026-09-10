package net.weeniebeenie.fit.support.quota;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 구글로 나가는 길목에 문턱을 둡니다.
 *
 * <h3>왜 서비스가 아니라 여기인가</h3>
 *
 * <p>구글을 부르는 것은 서비스 넷입니다. 거기에 각각 세는 코드를 넣으면 네
 * 군데를 맞춰야 하고, 다섯 번째가 생겼을 때 빠뜨립니다. 나가는 길은 결국
 * 이 앞을 지나므로, 한자리에서 봅니다.
 *
 * <p>대신 여기서는 "이 요청이 구글을 몇 번 부를 것인가" 를 알아야 합니다.
 * 그것은 자리마다 정해져 있으므로 아래 표에 적어 둡니다. 실제보다 넉넉히
 * 잡습니다 — 덜 잡으면 문턱이 뜻대로 서지 않습니다.
 *
 * <h3>누구를 세는가</h3>
 *
 * <p>로그인한 사람은 사람 번호로. 글의 지도 그림처럼 로그인 없이 열리는
 * 자리는 접속한 곳으로 셉니다. 그쪽은 여러 사람이 한 회선을 쓸 수 있어
 * 넉넉한 편이 낫지만, 아무 문턱이 없는 것보다는 낫습니다.
 */
@Component
@RequiredArgsConstructor
/* 시큐리티가 사람을 알아본 뒤여야 합니다. 앞에 서면 전부 손님으로 셉니다. */
@Order(Integer.MAX_VALUE - 10)
public class GoogleQuotaFilter extends OncePerRequestFilter {

    private final GoogleQuota quota;

    /**
     * 이 요청이 구글을 몇 번 부르는가.
     *
     * @return 0 이면 구글과 상관없는 자리입니다. 그냥 지나갑니다.
     */
    static int callsOf(String method, String path) {
        if (path.startsWith("/api/places/search")) {
            return 1;
        }
        /* 추천 — 검색 한 번 + 그날 문 여는지 여섯 번. */
        if (path.equals("/api/recommend") || path.endsWith("/recommend")) {
            return "POST".equals(method) ? 7 : 0;
        }
        /* 하루치 영업시간 — 그 날의 장소마다 하나씩, 열둘까지. */
        if (path.endsWith("/places-info")) {
            return 12;
        }
        /* 세 가지 이동 수단을 각각 물어봅니다. */
        if (path.endsWith("/route/compare")) {
            return 3;
        }
        if (path.endsWith("/route") || path.endsWith("/info") || path.endsWith("/map")) {
            return 1;
        }
        return 0;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        int calls = callsOf(request.getMethod(), request.getRequestURI());
        if (calls == 0 || quota.spend(who(request), calls)) {
            chain.doFilter(request, response);
            return;
        }

        /*
          한도에 걸렸습니다.

          "잠시 뒤" 라고만 하면 얼마나 기다려야 하는지 모릅니다. 한 시간
          단위로 풀리므로 그렇게 적습니다. 무엇을 하다 걸렸는지는 적지
          않습니다 — 찾던 말이 화면에 남을 이유가 없습니다.
         */
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"error\":\"장소를 너무 자주 찾았습니다. 한 시간쯤 뒤에 다시 해 주세요.\"}");
    }

    /** 로그인했으면 사람 번호, 아니면 접속한 곳. */
    private static String who(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthPrincipal me) {
            return "u:" + me.id();
        }
        /* 앞에 프록시가 있으면 진짜 접속한 곳은 그쪽이 알려 줍니다. */
        String forwarded = request.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank()
                ? forwarded.split(",")[0].trim()
                : request.getRemoteAddr();
        return "ip:" + ip;
    }
}
