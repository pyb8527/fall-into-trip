package net.weeniebeenie.fit.support.quota;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 구글을 얼마나 불렀는지 세는 자리.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>구글을 부르는 자리마다 요금이 붙습니다. 남이 일부러 그럴 수도 있지만,
 * 그보다 흔한 것은 <b>우리 실수</b>입니다. 화면 하나가 잘못 만들어져 목록을
 * 그릴 때마다 다시 부르면, 아무도 나쁜 뜻이 없어도 청구서로 배우게 됩니다.
 *
 * <h3>부를 것 같은 횟수가 아니라 부른 횟수를 셉니다</h3>
 *
 * <p>전에는 문턱({@link GoogleQuotaFilter})이 경로만 보고 미리 뺐습니다.
 * 문턱은 컨트롤러 앞에 서 있어서 그 뒤에 무슨 일이 있을지 모릅니다 — 404 가
 * 나든, 캐시에 맞아 구글을 안 부르든, 키가 없어 꺼져 있든 똑같이 뺐습니다.
 * 그래서 <b>구글을 한 번도 안 부르고도 한도에 걸리는</b> 일이 생겼습니다.
 *
 * <p>이제 {@link #spend}는 구글을 실제로 부르는 네 자리가 <b>캐시를 지나
 * 요청을 보내기 직전에</b> 부릅니다. 문턱은 {@link #left} 로 보기만 하고
 * 빼지 않습니다.
 *
 * <p>한 요청이 한도를 조금 넘겨 끝날 수 있습니다. 구간 열둘짜리 하루를
 * 펼치면 한 번에 서른여섯을 씁니다. 중간에 끊어 반쪽짜리 응답을 주는 것보다
 * 낫습니다 — 그러면 사람은 "왜 어떤 구간만 비었지" 를 묻게 됩니다. 대신
 * 다음 요청이 막힙니다.
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
     * 어렵습니다 — 하루를 펼치면 장소 수만큼, 검색 한 번에 하나, 추천 한 번에
     * 일곱. 넉넉히 두되 도는 고리는 몇 분 안에 걸립니다.
     *
     * <p>정직하게 세기 시작하면서 값이 어느 쪽으로 움직이는지는 아직
     * 모릅니다 — 헛것이 빠지는 만큼 줄고, 구간 비교가 정직해지는 만큼
     * 늡니다. 숫자는 재 본 뒤에 고칩니다.
     */
    private static final int PER_HOUR = 150;

    /** 하루치. 한 시간 한도를 내내 채우는 것은 사람이 하는 일이 아닙니다. */
    private static final int PER_DAY = 700;

    private final Map<String, Counter> hourly = new ConcurrentHashMap<>();
    private final Map<String, Counter> daily = new ConcurrentHashMap<>();

    /**
     * 아직 부를 몫이 남았는가. <b>세지 않습니다.</b>
     *
     * <p>문턱이 일을 시작하기 전에 물어보는 자리입니다. 이미 바닥난 사람이면
     * DB 조회도 하기 전에 돌려보냅니다 — 화면이 고리를 돌 때 그 고리를 가장
     * 앞에서 끊습니다.
     */
    public boolean left(String who) {
        if (who == null) {
            return true;
        }
        Instant now = Instant.now();
        return used(hourly, who, now) < PER_HOUR && used(daily, who, now) < PER_DAY;
    }

    /**
     * 구글을 이만큼 불렀다고 적습니다.
     *
     * <p>부르기 <b>직전에</b> 부릅니다. 캐시에 맞았으면 부르지 않습니다 —
     * 그때는 구글에 나가지 않았으므로 셀 것도 없습니다.
     *
     * @param who   사람 번호. 로그인하지 않았으면 접속한 곳. 요청 밖이면 null
     * @param calls 이번에 구글로 나가는 횟수
     * @return 넘었으면 false. 부르는 쪽은 그래도 이번 것은 끝냅니다
     */
    public boolean spend(String who, int calls) {
        if (who == null) {
            /* 예약 작업처럼 사람이 누른 것이 아닌 자리. 누구 몫으로 달 수가
               없어서 세지 않습니다. */
            return true;
        }
        Instant now = Instant.now();
        boolean inHour = take(hourly, who, calls, PER_HOUR, now, false);
        boolean inDay = take(daily, who, calls, PER_DAY, now, true);

        if (!inHour || !inDay) {
            /* 누구인지는 남기되 무엇을 찾았는지는 남기지 않습니다. */
            log.warn("구글 호출 한도에 걸렸습니다: who={} calls={}", who, calls);
            return false;
        }
        return true;
    }

    private static int used(Map<String, Counter> box, String who, Instant now) {
        Counter counter = box.get(who);
        return counter == null || !counter.until.isAfter(now) ? 0 : counter.used.get();
    }

    /**
     * 세고, 넘었으면 <b>도로 뺍니다.</b>
     *
     * <p>전에는 넘은 뒤에도 계속 더했습니다. 한 번 걸리고 나서 새로고침할수록
     * 더 깊이 들어가, 창이 끝날 때까지 풀리지 않았습니다. 못 쓴 것은 안 쓴
     * 것으로 둡니다.
     */
    private static boolean take(Map<String, Counter> box, String who, int calls,
                                int limit, Instant now, boolean byDay) {
        Counter counter = box.compute(who, (k, had) ->
                had == null || !had.until.isAfter(now) ? new Counter(endOf(now, byDay)) : had);
        if (counter.used.addAndGet(calls) <= limit) {
            return true;
        }
        counter.used.addAndGet(-calls);
        return false;
    }

    /**
     * 창이 언제 끝나는가.
     *
     * <p>첫 사용 시각부터 재지 않고 <b>시계에 맞춥니다.</b> 전에는 어제 저녁에
     * 쓴 것이 오늘 아침까지 남아, "오늘 처음인데 왜 막히지" 가 됐습니다.
     * 정각과 자정에 풀리면 "한 시간쯤 뒤" 라는 안내도 사실이 됩니다.
     *
     * <p>자정은 서버가 보는 자정입니다. 저장소의 다른 자리
     * ({@code PostView} 의 하루 한 번, {@code TripReminder} 의 내일)도 같은
     * 기준을 씁니다 — 여기만 다른 시간대를 쓰면 규칙이 둘이 됩니다.
     */
    private static Instant endOf(Instant now, boolean byDay) {
        ZoneId zone = ZoneId.systemDefault();
        if (byDay) {
            return LocalDate.now(zone).plusDays(1).atStartOfDay(zone).toInstant();
        }
        return LocalDateTime.now(zone).truncatedTo(ChronoUnit.HOURS).plusHours(1)
                .atZone(zone).toInstant();
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
        hourly.entrySet().removeIf(e -> !e.getValue().until.isAfter(now));
        daily.entrySet().removeIf(e -> !e.getValue().until.isAfter(now));
    }

    private static final class Counter {
        private final Instant until;
        private final AtomicInteger used = new AtomicInteger();

        private Counter(Instant until) {
            this.until = until;
        }
    }
}
