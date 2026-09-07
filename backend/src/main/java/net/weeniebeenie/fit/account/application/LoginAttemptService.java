package net.weeniebeenie.fit.account.application;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인 무차별 대입 억제.
 *
 * <p>이메일과 IP 를 묶어 세고, 한도를 넘으면 잠시 막습니다. 상태를 이 프로세스
 * 메모리에만 두므로 서버를 다시 띄우면 초기화됩니다. 여러 대로 늘리거나 더
 * 엄격하게 가야 하면 Redis 같은 공유 저장소로 옮겨야 합니다. 지금 규모에서는
 * 이 정도로 충분하다고 보고 단순하게 두었습니다.
 */
@Service
public class LoginAttemptService {

    private static final int MAX_TRIES = 10;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public void checkAllowed(String key) {
        Attempt a = attempts.get(key);
        if (a == null) {
            return;
        }
        Instant now = Instant.now();
        if (now.isAfter(a.until)) {
            attempts.remove(key);
            return;
        }
        if (a.count >= MAX_TRIES) {
            long seconds = Duration.between(now, a.until).toSeconds();
            throw net.weeniebeenie.fit.shared.error.ApiException.tooMany(
                    "로그인 시도가 너무 많습니다. " + Math.max(1, seconds) + "초 뒤에 다시 시도해 주세요.");
        }
    }

    public void recordFailure(String key) {
        Instant now = Instant.now();
        attempts.compute(key, (k, a) -> (a == null || now.isAfter(a.until))
                ? new Attempt(1, now.plus(WINDOW))
                : new Attempt(a.count + 1, a.until));
    }

    public void reset(String key) {
        attempts.remove(key);
    }

    private record Attempt(int count, Instant until) {
    }
}
