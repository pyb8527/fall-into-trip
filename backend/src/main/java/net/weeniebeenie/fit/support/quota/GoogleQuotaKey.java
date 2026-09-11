package net.weeniebeenie.fit.support.quota;

import jakarta.servlet.http.HttpServletRequest;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 이 호출을 누구 몫으로 달 것인가.
 *
 * <h3>왜 따로 있는가</h3>
 *
 * <p>세는 자리가 문턱({@link GoogleQuotaFilter})에서 <b>구글을 실제로 부르는
 * 서비스</b>로 옮겨 왔습니다. 문턱은 요청을 손에 들고 있었지만 서비스는
 * 아닙니다.
 *
 * <p>서비스 서명에 사람을 새로 끼워 넣지 않습니다. 넷 중 하나
 * ({@code StaticMapService})는 로그인 없이도 불리고, 나머지도 이미 다른
 * 이유로 서명이 깁니다. 지금 돌고 있는 요청에서 꺼내 오는 편이 좁습니다.
 *
 * <h3>요청 밖에서 불리면</h3>
 *
 * <p>{@code null} 입니다. 그때는 세지 않고 지나갑니다 — 사람이 누른 것이
 * 아니라 우리가 돌린 것이고, 그것을 누구 몫으로 달 수가 없습니다.
 */
@Component
public class GoogleQuotaKey {

    /**
     * 로그인했으면 사람 번호, 아니면 접속한 곳.
     *
     * @return 요청 밖에서 불렸으면 {@code null}.
     */
    public String current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthPrincipal me) {
            return "u:" + me.id();
        }

        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return null;
        }
        return ipOf(attrs.getRequest());
    }

    /** 문턱이 쓰는 길. 거기서는 요청을 이미 들고 있습니다. */
    public String of(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthPrincipal me) {
            return "u:" + me.id();
        }
        return ipOf(request);
    }

    private static String ipOf(HttpServletRequest request) {
        /* 앞에 프록시가 있으면 진짜 접속한 곳은 그쪽이 알려 줍니다. */
        String forwarded = request.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank()
                ? forwarded.split(",")[0].trim()
                : request.getRemoteAddr();
        return "ip:" + ip;
    }
}
