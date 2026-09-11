package net.weeniebeenie.fit.support.quota;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 구글로 나가는 길목에 문턱을 둡니다.
 *
 * <h3>여기서는 보기만 합니다</h3>
 *
 * <p>전에는 이 자리가 경로를 보고 "이 요청은 열두 번 부를 것" 이라고 미리
 * 빼 두었습니다. 그런데 문턱은 컨트롤러 앞에 서 있어서 <b>그 뒤에 무슨 일이
 * 있을지 모릅니다.</b> 404 가 나든, 캐시에 맞아 구글을 안 부르든, 키가 없어
 * 꺼져 있든 똑같이 뺐습니다. 그래서 구글을 한 번도 안 부르고도 한도에 걸리는
 * 일이 생겼습니다 — 없는 날짜를 열세 번 부르면 그날치가 바닥났습니다.
 *
 * <p>이제 세는 일은 구글을 실제로 부르는 네 자리가 합니다
 * ({@code PlaceSearchService}, {@code PlaceInfoService}, {@code RouteService},
 * {@code StaticMapService}). 각자 캐시를 지나 요청을 보내기 직전에 씁니다.
 *
 * <h3>그래도 문턱은 남깁니다</h3>
 *
 * <p>하는 일이 하나 있습니다 — <b>이미 바닥난 사람을 일을 시작하기 전에
 * 돌려보내는 것.</b> 화면 하나가 잘못 만들어져 고리를 돌 때, DB 조회도 하기
 * 전에 그 고리를 끊는 자리입니다. 그리고 한도에 걸렸다는 말을 한 군데서만
 * 하게 됩니다.
 */
@Component
@RequiredArgsConstructor
/* 시큐리티가 사람을 알아본 뒤여야 합니다. 앞에 서면 전부 손님으로 셉니다. */
@Order(Integer.MAX_VALUE - 10)
public class GoogleQuotaFilter extends OncePerRequestFilter {

    private final GoogleQuota quota;
    private final GoogleQuotaKey key;

    /**
     * 이 자리가 구글을 부를 수 있는가.
     *
     * <p>몇 번 부를지는 묻지 않습니다. 그건 캐시에 맞았는지, 그 날에 장소가
     * 몇 개인지에 따라 달라져서 여기서는 알 수 없는 값입니다. 세는 일은
     * 부르는 쪽이 합니다.
     */
    static boolean touchesGoogle(String method, String path) {
        if (path.startsWith("/api/places/search")) {
            return true;
        }
        if (path.equals("/api/recommend") || path.endsWith("/recommend")) {
            return "POST".equals(method);
        }
        return path.endsWith("/places-info")
                || path.endsWith("/route/compare")
                || path.endsWith("/route")
                || path.endsWith("/info")
                || path.endsWith("/map");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!touchesGoogle(request.getMethod(), request.getRequestURI())
                || quota.left(key.of(request))) {
            chain.doFilter(request, response);
            return;
        }

        /*
          한도에 걸렸습니다.

          "잠시 뒤" 라고만 하면 얼마나 기다려야 하는지 모릅니다. 창이 정각과
          자정에 풀리므로 그렇게 적습니다. 무엇을 하다 걸렸는지는 적지
          않습니다 — 찾던 말이 화면에 남을 이유가 없습니다.
         */
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"error\":\"장소를 너무 자주 찾았습니다. 다음 시간에 다시 해 주세요.\"}");
    }
}
