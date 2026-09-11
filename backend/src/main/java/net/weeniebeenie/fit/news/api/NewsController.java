package net.weeniebeenie.fit.news.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.news.application.NewsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 소식함.
 *
 * <p>로그인한 사람만 부릅니다. {@code SecurityConfig} 의 {@code /api/**}
 * 규칙에 그대로 걸리므로 여기에 따로 적을 것이 없습니다.
 */
@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService news;

    @GetMapping
    public NewsService.View list(@CurrentUser AuthPrincipal me) {
        return news.of(me);
    }

    /**
     * 화면을 열었을 때 한 번.
     *
     * <p>끝까지 읽었는지는 보지 않습니다. 그것을 재려면 화면이 훨씬
     * 복잡해지고, 얻는 것은 "정확히 다 읽었나" 뿐입니다.
     */
    @PutMapping("/seen")
    public Map<String, Object> seen(@CurrentUser AuthPrincipal me) {
        return Map.of("seenAt", news.seen(me));
    }
}
