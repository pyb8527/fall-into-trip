package net.weeniebeenie.fit.support.quota;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 구글을 얼마나 불렀는지 세는 자리.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>구글을 부르는 자리마다 요금이 붙습니다. 그런데 지금은 로그인만 하면
 * 아무 제한이 없습니다. 추천 한 번에 최대 일곱 번이 나가는데(검색 하나 +
 * 영업시간 여섯), 누가 그것을 반복하면 하루치 요금이 금세 붙습니다.
 *
 * <p>남이 일부러 그럴 수도 있지만, 그보다 흔한 것은 <b>우리 실수</b>입니다.
 * 화면 하나가 잘못 만들어져 목록을 그릴 때마다 다시 부르면, 아무도 나쁜
 * 뜻이 없어도 청구서로 배우게 됩니다.
 *
 * <h3>요청이 아니라 부름을 셉니다</h3>
 *
 * <p>같은 한 번의 요청이라도 어떤 것은 구글을 한 번, 어떤 것은 열두 번
 * 부릅니다. 요청 수로 세면 무거운 쪽이 공짜가 됩니다. 자리마다 값을 매겨
 * 그만큼 셉니다.
 *
 * <h3>메모리에 둡니다</h3>
 *
 * <p>DB 에 쓰면 구글을 부를 때마다 쓰기가 한 번씩 붙습니다. 서버가 다시 뜨면
 * 세던 것이 사라지지만, 그것 때문에 한 사람이 한 번 더 쓸 수 있을 뿐입니다.
 * 여러 대로 늘릴 때가 오면 그때 옮깁니다.
 */
@Slf4j
@Component
public class GoogleQuota {

    /**
     * 한 시간에 부를 수 있는 횟수.
     *
     * <p>사람이 앉아서 열심히 짜는 경우를 재 보면 한 시간에 백 번을 넘기기
     * 어렵습니다 — 하루를 펼치면 열둘, 검색 한 번에 하나, 추천 한 번에 일곱.
     * 넉넉히 두되 도는 고리는 몇 분 안에 걸립니다.
     */
    private static final int PER_HOUR = 150;

    /** 하루치. 한 시간 한도를 내내 채우는 것은 사람이 하는 일이 아닙니다. */
    private static final int PER_DAY = 700;

    private final Map<String, Counter> hourly = new ConcurrentHashMap<>();
    private final Map<String, Counter> daily = new ConcurrentHashMap<>();

    /**
     * 이만큼 부르겠다고 알립니다.
     *
     * @param who  사람 번호. 로그인하지 않았으면 접속한 곳.
     * @param calls 이 요청이 구글을 부를 횟수.
     * @return 넘었으면 false. 그때는 부르지 않고 돌려보냅니다.
     */
    public boolean spend(String who, int calls) {
        Instant now = Instant.now();
        boolean inHour = take(hourly, who, calls, PER_HOUR, Duration.ofHours(1), now);
        boolean inDay = take(daily, who, calls, PER_DAY, Duration.ofDays(1), now);

        if (!inHour || !inDay) {
            /* 누구인지는 남기되 무엇을 찾았는지는 남기지 않습니다. */
            log.warn("구글 호출 한도에 걸렸습니다: who={} calls={}", who, calls);
            return false;
        }
        return true;
    }

    private static boolean take(Map<String, Counter> box, String who, int calls,
                                int limit, Duration window, Instant now) {
        Counter counter = box.compute(who, (k, had) ->
                had == null || had.until.isBefore(now) ? new Counter(now.plus(window)) : had);
        return counter.used.addAndGet(calls) <= limit;
    }

    /**
     * 지난 것을 치웁니다.
     *
     * <p>안 치우면 한 번 왔다 간 사람의 자리가 계속 남습니다. 한 줄이 작아도
     * 몇 달이면 쌓입니다.
     */
    @Scheduled(fixedDelay = 30 * 60 * 1000)
    public void sweep() {
        Instant now = Instant.now();
        hourly.entrySet().removeIf(e -> e.getValue().until.isBefore(now));
        daily.entrySet().removeIf(e -> e.getValue().until.isBefore(now));
    }

    private static final class Counter {
        private final Instant until;
        private final java.util.concurrent.atomic.AtomicInteger used =
                new java.util.concurrent.atomic.AtomicInteger();

        private Counter(Instant until) {
            this.until = until;
        }
    }
}
