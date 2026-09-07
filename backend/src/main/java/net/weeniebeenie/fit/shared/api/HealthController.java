package net.weeniebeenie.fit.shared.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/** 컨테이너 헬스체크가 두드리는 곳. 로그인 없이 열려 있습니다. */
@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("ok", true, "at", Instant.now().toString());
    }
}
