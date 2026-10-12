package net.weeniebeenie.fit.trip.application;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.support.quota.GoogleQuota;
import net.weeniebeenie.fit.support.quota.GoogleQuotaKey;
import net.weeniebeenie.fit.shared.domain.Coordinates;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 장소에서 장소로 가는 데 걸리는 시간과 실제 경로.
 *
 * <p>같은 두 지점이라도 걸어서 25분이 지하철로 8분입니다. 그래서 수단을 받아
 * 그 수단으로 계산합니다.
 *
 * <p>대중교통은 경유지를 넣을 수 없습니다(구글 제약). 그래서 한 구간씩 따로
 * 묻습니다. 다른 수단도 같은 길로 통일했습니다. 수단마다 코드가 갈리면 화면에서
 * 어느 쪽이 왜 다른지 설명하기 어려워집니다.
 *
 * <p>키는 장소 검색과 같은 것을 씁니다. 구글 콘솔에서 그 키에 Routes API 를
 * 허용해 두어야 합니다. 안 그러면 거절당합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RouteService {

    /**
     * 한 번에 물어볼 구간의 최대치.
     *
     * <p>구간마다 요금이 붙습니다. 대중교통은 경유지를 못 받으므로(구글 제약)
     * 한 구간씩 따로 묻고, 다른 수단도 같은 길로 통일했습니다. 그래서
     * <b>장소 N곳이면 호출이 N−1번</b>입니다.
     *
     * <p>열둘이었습니다. "하루에 열 곳을 넘게 넣는 일정은 드물다" 고 봤는데,
     * 실제로는 열셋째 구간부터 그냥 없었습니다 — 잘렸다는 말도 없이요.
     * 스물넷이면 하루 스물다섯 곳까지 끊김 없이 나옵니다.
     *
     * <p>구글 쪽 한도가 아닙니다. Routes API 는 경유지를 스물다섯까지 받지만
     * 우리는 경유지를 안 쓰므로 거기서 오는 제약이 없습니다. 이 숫자는 순전히
     * <b>요금 울타리</b>입니다.
     */
    private static final int MAX_LEGS = 24;

    /**
     * 셋을 견줄 때의 최대치.
     *
     * <p>열둘로 두었습니다. 견주기는 구간마다 세 수단을 다 물으므로 요금이
     * 세 배라, "하루에 열둘을 넘기는 일은 드물다" 고 봤습니다.
     *
     * <p>그런데 일정 화면이 쓰는 길이 바로 이쪽입니다. 그래서 장소를 열셋째
     * 넣는 순간 <b>그 아래로는 이동 시간이 통째로 안 나왔습니다</b> — 위는
     * 나오는데 아래만 비어서, 고장으로 읽힙니다.
     *
     * <p>위와 같게 둡니다. 한도가 둘이면 화면마다 다른 데서 잘리고, 어느
     * 쪽에 걸린 것인지는 쓰는 사람이 알 수 없습니다.
     *
     * <p>값은 분당 할당량이 받습니다. 스물넷이면 하루를 한 번 펼치는 데
     * 일흔두 번이 1분 안에 나가므로, 구글 콘솔의 Routes 분당 한도가 그보다
     * 넉넉해야 합니다 — 60으로 두면 한 번 펼치다 걸립니다.
     */
    private static final int MAX_COMPARE_LEGS = MAX_LEGS;

    /**
     * 답을 들고 있는 시간.
     *
     * <p>걷기와 자동차는 좌표가 같으면 답도 거의 같아 오래 들고 있어도 됩니다.
     * 대중교통은 시각에 따라 달라지므로 짧게 둡니다.
     *
     * <p>디스크에 남기지 않고 메모리에만 둡니다. 구글 약관이 결과를 오래 쌓아
     * 두는 것을 제한합니다.
     */
    private static final Duration KEEP_STATIC = Duration.ofHours(6);
    private static final Duration KEEP_TRANSIT = Duration.ofMinutes(20);

    /**
     * <b>못 물어본</b> 구간을 들고 있는 시간.
     *
     * <p>답이 아니라 사고입니다. 답만큼 오래 들고 있으면 한 번의 사고가 여섯
     * 시간짜리 거짓말이 됩니다. 그렇다고 아예 안 들고 있으면 구글이 잠깐
     * 맛이 갔을 때 날짜를 열 때마다 서른여섯 번씩 다시 나갑니다.
     */
    private static final Duration KEEP_FAILED = Duration.ofMinutes(1);

    /**
     * 여기까지는 걷는 것이 선택입니다.
     *
     * <p>5분이면 갈 길을 30분 걷는 사람이 있습니다. 돈을 아끼려고도 하고 그냥
     * 걷고 싶어서도 합니다. 그 아래는 손대지 않습니다.
     */
    private static final Duration WALK_SANE = Duration.ofMinutes(90);

    /** 그 위로, 다른 수단이 이만큼 빠르면 걷기는 고를 것이 아닙니다. */
    private static final int WALK_TOO_MUCH = 3;

    /** 들고 있을 답의 개수. 넘으면 오래 안 쓴 것부터 버립니다. */
    private static final int CACHE_MAX = 2000;

    /** "09:30" 처럼 적은 것만 시각으로 읽습니다. "점심때쯤" 은 안 읽습니다. */
    private static final Pattern CLOCK = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    /** 시각을 안 적어 둔 자리. 낮이면 대개 다닙니다. */
    private static final LocalTime DEFAULT_DEPARTURE = LocalTime.of(9, 0);

    /* 구글이 받는 창. 이 밖이면 departureTime 을 아예 안 보냅니다. 넉넉히
       줄여 잡습니다 — 경계에서 거절당하면 그 구간만 통째로 사라집니다. */
    private static final Duration WINDOW_PAST = Duration.ofDays(5);
    private static final Duration WINDOW_AHEAD = Duration.ofDays(95);

    private final GoogleQuota quota;
    private final GoogleQuotaKey quotaKey;
    private final TripAccessPolicy access;
    private final DayRepository days;
    private final PlaceRepository places;

    private final RestClient client = RestClient.builder()
            .baseUrl("https://routes.googleapis.com")
            .build();

    @Value("${fit.google.maps-key:}")
    private String key;

    /** 오래 안 쓴 것부터 빠지도록 접근 순서를 기억하는 맵. */
    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<String, Cached>(256, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > CACHE_MAX;
                }
            });

    public boolean enabled() {
        return key != null && !key.isBlank();
    }

    /*
      일부러 트랜잭션으로 감싸지 않습니다. 구간마다 구글을 부르는데, 그동안
      트랜잭션이 열려 있으면 DB 연결 하나를 네트워크가 끝날 때까지 붙들고
      있게 됩니다. 열두 구간이면 몇 초입니다. 그 사이 다른 요청이 연결을
      못 얻습니다.

      읽기는 두 번뿐이고 서로 묶여야 할 이유가 없어, 각자 알아서 열고 닫게
      둡니다.
    */
    public DayRoute of(AuthPrincipal me, String dayId, Mode mode) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanRead(day.getTripId(), me.id());

        if (!enabled()) {
            throw ApiException.badRequest("경로 안내가 꺼져 있어요.");
        }

        List<Place> list = places.findAllByDayIdOrderBySortAsc(dayId);
        if (list.size() < 2) {
            return new DayRoute(mode, List.of(), 0, 0, false);
        }

        int pairs = Math.min(list.size() - 1, MAX_LEGS);
        boolean trimmed = list.size() - 1 > MAX_LEGS;

        List<Leg> legs = new ArrayList<>(pairs);
        int seconds = 0;
        int meters = 0;

        for (int i = 0; i < pairs; i++) {
            Leg leg = leg(list.get(i), list.get(i + 1), mode,
                    departureFor(day, list.get(i)));
            legs.add(leg);
            if (leg.reachable()) {
                seconds += leg.seconds();
                meters += leg.meters();
            }
        }

        return new DayRoute(mode, legs, seconds, meters, trimmed);
    }

    /**
     * 장소와 장소 사이를 <b>세 수단으로 한꺼번에</b>.
     *
     * <p>전에는 사람이 위에서 수단을 하나 골라야 이동 시간이 나왔습니다. 그런데
     * 정작 알고 싶은 것은 "이 구간은 뭘 타야 하나" 이고, 그것은 셋을 나란히
     * 놓아야만 알 수 있습니다. 걸어서 25분인 줄 알았는데 지하철도 25분이면
     * 그냥 걷는 게 낫습니다.
     *
     * <p>그래서 날짜를 펼치면 알아서 셋을 다 계산해 사이사이에 끼워 넣습니다.
     * 고르는 일이 사라집니다.
     *
     * <p><b>구간마다 요금이 세 배로 나갑니다.</b> 그래서 이렇게 막아 둡니다.
     *
     * <ul>
     *   <li>"전체" 를 볼 때는 부르지 않습니다. 날짜 하나를 펼쳤을 때만입니다.
     *       (그 판단은 화면이 합니다)</li>
     *   <li>답은 걷기·자동차 여섯 시간, 대중교통 이십 분 들고 있습니다. 같은
     *       날을 다시 열어도 다시 나가지 않습니다.</li>
     *   <li>한 날에 열두 구간까지만 봅니다.</li>
     * </ul>
     *
     * <p>세 수단이 모두 안 되는 구간도 있습니다(몇 백 미터 거리에는 구글이
     * 대중교통을 안 태웁니다). 그런 것은 빼고 되는 것만 내놓습니다.
     *
     * <h3>숙소도 그날 동선의 앞뒤에 섭니다</h3>
     *
     * <p>하루를 짤 때 가장 먼저 묻는 두 구간이 없었습니다 — 「호텔에서 첫
     * 곳까지 몇 분」(아침에 몇 시에 나가나)과 「마지막 곳에서 호텔까지 몇 분」
     * (밤에 몇 시에 끊나). 숙소는 장소가 아니라 {@link Day} 의 다른 칸이라
     * 짝짓기에 끼지 않았고, 사람은 숙소를 장소로 한 번 더 넣어 우회했습니다.
     * 그러면 숙소가 「3번 장소」 가 됩니다.
     *
     * <p>아침은 <b>전날 밤</b> 숙소에서 나섭니다. {@code Day.stay} 는 그날
     * 밤 자는 곳이라, 그날 숙소에서 출발시키면 체크아웃하고 옮기는 날 아직
     * 들어가지도 않은 호텔에서 나서게 됩니다. 저녁은 그날 숙소로 돌아갑니다.
     *
     * <p>둘은 {@code gaps} 에 섞지 않고 따로 싣습니다. 지도 선과 「다음
     * 곳까지」 를 그리는 쪽이 {@code gaps} 를 장소 사이로 읽고 있어서, 섞으면
     * 그쪽이 모두 숙소를 가려내야 합니다.
     *
     * <p>한도 24 안에서 셉니다. 아침 하나가 먼저, 장소 사이가 남은 만큼,
     * 저녁은 안 잘렸고 남았을 때만입니다 — {@link #legsOf}.
     */
    public Compared compare(AuthPrincipal me, String dayId) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanRead(day.getTripId(), me.id());

        if (!enabled()) {
            throw ApiException.badRequest("경로 안내가 꺼져 있어요.");
        }

        /* 장소가 하나뿐이어도 숙소 구간은 나옵니다 — 「호텔에서 그 한 곳까지」
           도 묻는 값입니다. 그래서 둘 미만이 아니라 하나도 없을 때만 그칩니다. */
        List<Place> list = places.findAllByDayIdOrderBySortAsc(dayId);
        if (list.isEmpty()) {
            return new Compared(List.of(), null, false, null, null);
        }

        /* 앞 날은 같은 여행 안에서만 찾습니다. 날짜 하나를 볼 수 있으면 그
           여행 전체를 볼 수 있으므로(requireCanRead) 따로 묻지 않습니다. */
        Planned plan = legsOf(list,
                stayEnds(days.findAllByTripIdOrderBySortAsc(day.getTripId()), day),
                MAX_COMPARE_LEGS);

        Gap morning = plan.morning() == null ? null
                : gapOf(plan.morning().from(), plan.morning().to(), day)
                        .withEnds(STAY, plan.morning().to().getId());
        List<Gap> out = new ArrayList<>(plan.between().size());
        for (Pair pair : plan.between()) {
            out.add(gapOf(pair.from(), pair.to(), day));
        }
        Gap evening = plan.evening() == null ? null
                : gapOf(plan.evening().from(), plan.evening().to(), day)
                        .withEnds(plan.evening().from().getId(), STAY);

        /* 이 지역에 대중교통 안내가 아예 없는지 보려고 셉니다 — 아래 noteFor.
           숙소 구간도 셉니다. 숙소에서 첫 곳까지가 그날 가장 긴 구간인 일이
           흔해서, 빼면 짧은 구간만 남아 「대중교통이 없다」 를 못 짚습니다. */
        List<Pair> asked = new ArrayList<>(plan.between());
        List<Gap> answered = new ArrayList<>(out);
        if (morning != null) {
            asked.add(plan.morning());
            answered.add(morning);
        }
        if (evening != null) {
            asked.add(plan.evening());
            answered.add(evening);
        }
        int longEnough = (int) asked.stream().filter(p -> farApart(p.from(), p.to())).count();
        int transitFound = (int) answered.stream()
                .filter(g -> g.options().stream().anyMatch(o -> o.mode() == Mode.TRANSIT))
                .count();
        return new Compared(out, noteFor(longEnough, transitFound), plan.trimmed(),
                morning, evening);
    }

    /**
     * 한 구간을 세 수단으로.
     *
     * <p>장소 사이 · 아침 · 저녁이 모두 이 길을 지납니다. 셋이 따로 물으면
     * 말이 안 되는 걷기를 빼는 자리와 빠른 것 · 싼 것을 고르는 자리가 셋으로
     * 갈리고, 하나만 고쳐질 날이 옵니다.
     *
     * <p>구글에는 {@link #leg} 로만 나갑니다 — 캐시를 먼저 보고, 없을 때만
     * {@link #ask} 가 문턱을 1씩 깎습니다. 숙소 구간이라고 다른 셈을 하지
     * 않습니다.
     */
    private Gap gapOf(Place from, Place to, Day day) {
        List<Option> options = new ArrayList<>(3);
        for (Mode mode : Mode.values()) {
            Leg leg = leg(from, to, mode, departureFor(day, from));
            if (leg.reachable() && leg.seconds() > 0) {
                options.add(new Option(mode, leg.seconds(), leg.meters(),
                        leg.polyline(), leg.fare()));
            }
        }
        dropSillyWalk(options);
        return new Gap(from.getId(), to.getId(), options,
                pick(options, true), pick(options, false));
    }

    /**
     * 숙소 쪽 끝을 가리키는 이름.
     *
     * <p>숙소는 장소가 아니라 번호가 없습니다. 화면은 고른 수단을
     * {@code fromId} 로 기억하는데, 이 이름은 장소 번호와 겹칠 일이 없습니다
     * (장소 번호는 {@code Ids.next()} 가 짓는 열여섯 자).
     */
    static final String STAY = "stay";

    /**
     * 숙소가 첫 곳 · 마지막 곳과 이만큼 가까우면 그 구간을 묻지 않습니다.
     *
     * <p>숙소를 장소로도 넣은 사람이 있습니다 — 숙소 칸이 생기기 전부터 그렇게
     * 해 왔습니다. 그 사람에게 「호텔에서 호텔까지 0분」 을 세 수단으로 사 오는
     * 것은 값만 들고 할 말이 없습니다. 잰 숫자가 아니라 가리려는 숫자입니다
     * (계획서 「아직 모르는 것」).
     */
    private static final int STAY_SAME_PLACE = 100;

    /**
     * 그날의 아침 출발점과 저녁 도착점.
     *
     * <p>아침은 바로 앞 날({@code sort} 하나 앞)의 숙소, 저녁은 이 날의
     * 숙소입니다. 좌표가 없으면 없는 것으로 둡니다 — 이름만으로는 구글에 물을
     * 수 없습니다.
     *
     * <p>「앞 날」 을 날짜가 아니라 차례로 잡습니다. 날짜를 안 적은 여행도
     * 있고, 화면이 날을 늘어놓는 것도 차례입니다.
     *
     * @param ordered 같은 여행의 날들, 차례대로
     */
    static StayEnds stayEnds(List<Day> ordered, Day day) {
        Day before = null;
        for (Day d : ordered) {
            if (d.getId().equals(day.getId())) {
                break;
            }
            before = d;
        }
        return new StayEnds(stayOf(before), stayOf(day));
    }

    /**
     * 숙소를 구간의 끝으로 쓸 임시 장소.
     *
     * <p>저장하지 않습니다. {@link #fromHere} 가 「여기」 를 만드는 것과 같은
     * 수법입니다 — {@link #leg} 와 캐시 열쇠가 보는 것은 좌표뿐이라, 장소 모양만
     * 갖추면 장소 사이 구간과 같은 길을 지납니다.
     */
    private static Place stayOf(Day day) {
        if (day == null || day.getStayLat() == null || day.getStayLng() == null) {
            return null;
        }
        return Place.builder()
                .name(day.getStayName())
                .lat(day.getStayLat())
                .lng(day.getStayLng())
                .build();
    }

    /**
     * 그날 어느 구간을 물을지.
     *
     * <p>구글을 부르지 않는 셈만 따로 떼어 둡니다. 어느 구간을 묻는가는 키가
     * 없어도 잴 수 있어야 합니다 — 확인용 서버에는 키가 없습니다.
     *
     * <p>한도 {@code max} 를 셋이 나눕니다. 아침 하나가 먼저 자리를 잡습니다 —
     * 하루를 펼친 사람이 맨 먼저 보는 줄이고, 앞쪽이 비면 고장으로 읽힙니다.
     * 장소 사이가 남은 만큼, 저녁은 장소 사이가 하나도 안 잘렸고 자리가 남았을
     * 때만입니다. 장소 사이가 잘렸는데 저녁이 붙어 있으면 「마지막 곳에서
     * 호텔까지」 위로 빈 구간이 생기고, 그 빈칸이 어디서 왔는지 알 수 없습니다.
     */
    static Planned legsOf(List<Place> list, StayEnds ends, int max) {
        if (list.isEmpty()) {
            return new Planned(null, List.of(), null, false);
        }
        Place first = list.get(0);
        Place last = list.get(list.size() - 1);

        Pair morning = ends.morning() != null && !sameSpot(ends.morning(), first)
                ? new Pair(ends.morning(), first) : null;
        int room = max - (morning == null ? 0 : 1);

        int wanted = list.size() - 1;
        int pairs = Math.max(0, Math.min(wanted, room));
        boolean trimmed = wanted > pairs;
        List<Pair> between = new ArrayList<>(pairs);
        for (int i = 0; i < pairs; i++) {
            between.add(new Pair(list.get(i), list.get(i + 1)));
        }

        Pair evening = !trimmed && room - pairs > 0
                && ends.evening() != null && !sameSpot(last, ends.evening())
                ? new Pair(last, ends.evening()) : null;
        return new Planned(morning, between, evening, trimmed);
    }

    private static boolean sameSpot(Place a, Place b) {
        return new Coordinates(a.getLat(), a.getLng())
                .metersTo(new Coordinates(b.getLat(), b.getLng())) < STAY_SAME_PLACE;
    }

    /**
     * 그날 앞뒤의 숙소. 없으면 비어 있습니다.
     *
     * @param morning 전날 밤 숙소 — 아침에 나서는 곳
     * @param evening 이 날 밤 숙소 — 저녁에 돌아가는 곳
     */
    record StayEnds(Place morning, Place evening) {
    }

    /** 묻기로 한 구간 하나. */
    record Pair(Place from, Place to) {
    }

    /**
     * 그날 물을 구간들.
     *
     * @param trimmed 한도에 걸려 장소 사이를 다 못 물었는지
     */
    record Planned(Pair morning, List<Pair> between, Pair evening, boolean trimmed) {
    }

    /**
     * 대중교통이 왜 하나도 없는지.
     *
     * <h3>왜 말해 줘야 하나</h3>
     *
     * <p><b>구글은 일본에 대중교통 길찾기를 API 로 주지 않습니다.</b> 걷기·
     * 자전거·차는 주고 대중교통만 안 줍니다. 구글 지도 앱에 나오는 것은
     * 라이선스가 다릅니다. 그래서 오류가 아니라 <b>빈 답</b>이 옵니다.
     *
     * <p>그동안 우리는 그것을 조용히 지웠습니다. 그래서 쓰는 사람은 <b>앱이
     * 고장 난 줄</b> 알았습니다 — 구글 지도에는 나오는 스카이라이너가 여기는
     * 없으니까요.
     *
     * <p>모르는 것을 아는 척하지 않는 것만큼, <b>아는 것을 말하지 않는 것도
     * 틀린 일</b>입니다.
     *
     * <h3>어떻게 가리는가</h3>
     *
     * <p>구간 하나가 비는 것은 흔합니다 — 몇백 미터에 전철이 없는 것은 맞는
     * 답입니다. 그래서 <b>전철을 탈 만한 구간이 있는데 그중 하나도 안
     * 나왔을 때</b>만 말합니다.
     *
     * @param longEnough  전철을 탈 만큼 떨어진 구간의 수
     * @param transitFound 실제로 대중교통이 나온 구간의 수
     */
    static String noteFor(int longEnough, int transitFound) {
        if (longEnough == 0 || transitFound > 0) {
            return null;
        }
        return "이 지역은 구글이 대중교통 길찾기를 내주지 않아요. "
                + "구글 지도 앱에서는 보이지만 다른 앱으로는 가져올 수 없는 자리예요.";
    }

    /**
     * 전철을 탈 만큼 떨어져 있는가.
     *
     * <p>몇백 미터 사이에 대중교통이 없는 것은 <b>맞는 답</b>입니다. 그런
     * 구간까지 세면 짧은 구간만 있는 하루가 "이 지역은 대중교통이 없다" 로
     * 잘못 읽힙니다.
     */
    static boolean farApart(Place from, Place to) {
        return new Coordinates(from.getLat(), from.getLng())
                .metersTo(new Coordinates(to.getLat(), to.getLng())) >= TRANSIT_WORTH_ASKING;
    }

    /** 이만큼 떨어져 있으면 대중교통이 있을 만합니다. */
    private static final int TRANSIT_WORTH_ASKING = 2000;

    /**
     * 사이사이와, 왜 대중교통이 없는지 한 줄.
     *
     * @param trimmed 장소가 너무 많아 뒷부분을 못 구했는지. 이 말을 안 하면
     *                없는 것이 고장으로 읽힙니다
     * @param morning 전날 밤 숙소에서 첫 곳까지. {@code fromId} 가 {@link #STAY}.
     *                첫째 날 · 숙소 좌표가 없는 날 · 숙소가 첫 곳 바로 옆이면 없음
     * @param evening 마지막 곳에서 이 날 숙소까지. {@code toId} 가 {@link #STAY}
     */
    public record Compared(List<Gap> gaps, String note, boolean trimmed,
                           Gap morning, Gap evening) {
    }

    /**
     * 말이 안 되는 걷기를 뺍니다.
     *
     * <p>나리타 공항에서 닛포리까지 <b>걸어서 14시간</b>이 나왔습니다. 구글이
     * 대중교통을 안 줬고, 남은 것이 걷기와 차였고, 걷기는 요금이 없어서
     * <b>"싼 쪽" 추천으로까지 올라갔습니다.</b> 돈을 아끼자고 13시간을 더
     * 쓰는 사람은 없습니다.
     *
     * <h3>길이만 보고 자르지 않습니다</h3>
     *
     * <p>두 시간 걷는 것이 답인 자리가 있습니다 — 산길이나 둘레길처럼 <b>걷는
     * 것이 곧 목적</b>인 곳입니다. 그래서 시간만으로 자르면 멀쩡한 답을
     * 지웁니다.
     *
     * <p>대신 <b>훨씬 나은 대안이 있을 때만</b> 뺍니다. 차로 한 시간인데
     * 걸어서 열네 시간이면 그것은 고를 것이 아닙니다. 반대로 걷는 것 말고
     * 길이 없으면 몇 시간이 걸려도 그대로 둡니다 — 그때는 그것이 유일한
     * 답입니다.
     */
    static void dropSillyWalk(List<Option> options) {
        Option walk = options.stream().filter(o -> o.mode() == Mode.WALK).findFirst().orElse(null);
        if (walk == null || options.size() < 2) {
            return;
        }
        /* 짧은 걷기는 건드리지 않습니다. 5분 차를 30분 걷는 것은 사람이
           실제로 고르는 선택입니다. */
        if (walk.seconds() <= WALK_SANE.toSeconds()) {
            return;
        }
        int best = options.stream().filter(o -> o.mode() != Mode.WALK)
                .mapToInt(Option::seconds).min().orElse(Integer.MAX_VALUE);
        if (walk.seconds() > best * WALK_TOO_MUCH) {
            options.remove(walk);
        }
    }

    /**
     * 추천할 것 하나.
     *
     * @param fastest 시간을 아끼는 쪽이면 true, 돈을 아끼는 쪽이면 false
     *
     * <p>돈 쪽은 요금이 <b>없는</b> 것(걷기)이 가장 쌉니다. 같은 값이면 빠른
     * 쪽을 고릅니다. 다만 통화가 서로 다르면 비교하지 않습니다 — 엔과 원을
     * 숫자만으로 견주면 엉뚱한 답이 나옵니다. 한 구간 안에서는 통화가 같으므로
     * 실제로 문제가 되지는 않지만, 그래도 확인하고 넘어갑니다.
     */
    /** 시험이 부르는 이름. 안에서는 {@link #pick} 하나로 씁니다. */
    static Mode fastestOf(List<Option> options) {
        return pick(options, true);
    }

    static Mode cheapestOf(List<Option> options) {
        return pick(options, false);
    }

    private static Mode pick(List<Option> options, boolean fastest) {
        Option best = null;
        for (Option o : options) {
            if (best == null) {
                best = o;
                continue;
            }
            if (fastest) {
                if (o.seconds() < best.seconds()) {
                    best = o;
                }
                continue;
            }
            long mine = o.fare() == null ? 0 : o.fare().amount();
            long theirs = best.fare() == null ? 0 : best.fare().amount();
            boolean sameMoney = o.fare() == null || best.fare() == null
                    || o.fare().currency().equals(best.fare().currency());
            if (!sameMoney) {
                continue;
            }
            if (mine < theirs || (mine == theirs && o.seconds() < best.seconds())) {
                best = o;
            }
        }
        return best == null ? null : best.mode();
    }

    /**
     * 한 수단으로 갔을 때.
     *
     * @param fare 대중교통은 구글이 준 값, 자동차는 우리가 어림한 값, 걷기는
     *             없음. 어느 쪽인지는 fare.estimated 가 말합니다.
     */
    public record Option(Mode mode, int seconds, int meters, String polyline,
                         TaxiFare.Money fare) {
    }

    /**
     * 장소와 장소 사이의 빈칸.
     *
     * @param fastest  가장 빨리 가는 수단
     * @param cheapest 가장 돈이 덜 드는 수단. 둘이 같으면 고민할 것이 없습니다.
     */
    public record Gap(String fromId, String toId, List<Option> options,
                      Mode fastest, Mode cheapest) {

        /** 숙소 쪽 끝은 임시 장소의 번호가 아니라 {@link #STAY} 로 내려 보냅니다. */
        Gap withEnds(String fromId, String toId) {
            return new Gap(fromId, toId, options, fastest, cheapest);
        }
    }

    /**
     * 지금 서 있는 자리에서 그 장소까지.
     *
     * <p>일정에 적힌 순서가 아니라 <b>내가 있는 곳</b>이 출발점입니다. 길 위에서
     * 궁금한 것은 대개 이쪽입니다.
     *
     * <p>보낸 좌표는 어디에도 남기지 않습니다. 이 요청을 처리하는 동안만 씁니다.
     * 아래 캐시에도 넣지 않습니다 — 사람이 움직이므로 다음에 물을 때는 이미
     * 다른 자리이고, 무엇보다 남의 위치를 서버가 들고 있을 이유가 없습니다.
     */
    public Leg fromHere(AuthPrincipal me, String placeId, double lat, double lng, Mode mode) {
        Place to = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없어요."));
        Day day = days.findById(to.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanRead(day.getTripId(), me.id());

        if (!enabled()) {
            throw ApiException.badRequest("경로 안내가 꺼져 있어요.");
        }

        Coordinates at = Coordinates.of(lat, lng);
        Place here = Place.builder().name("여기").lat(at.lat()).lng(at.lng()).build();
        /* "지금 여기서" 는 정말 지금입니다. 그래서 시각을 안 넘깁니다 —
           구글이 현재로 잡는 것이 여기서는 맞습니다. */
        Leg got = ask(here, to, mode, null);
        /* 못 물어봤으면 "그 길이 없다" 로 내려보냅니다. 이 자리는 캐시를
           안 쓰므로 들고 있을 것이 없습니다. */
        return (got == null ? Leg.unreachable("me", to.getId()) : got)
                .withEnds("me", to.getId());
    }

    /**
     * 두 곳 사이의 길 하나를, 지도에 그릴 모양으로만.
     *
     * <p>"가는 길에 있는 곳" 을 찾을 때 씁니다. 구글이 요구하는 것이 정확히
     * 우리가 이미 받아 두는 그 {@code encodedPolyline} 입니다.
     *
     * <p><b>따로 캐시를 보지 않습니다.</b> {@link #leg} 가 이미 봅니다 —
     * 있으면 거기서 나오고 없으면 구글에 묻습니다. 그리고 사람이 그 날을
     * 펼칠 때 화면이 {@code /route} 를 부르므로, 그 날의 구간은 대개 이미
     * 들어 있습니다(걷기·차·자전거 6시간).
     *
     * <p>못 구하면 {@code null} 입니다. 그때 부르는 쪽은 점으로 내려앉아야
     * 합니다 — 길을 못 구한 것이 "찾은 것이 없음" 이 되면, 이 기능은 있는
     * 것이 없는 것보다 나쁩니다.
     */
    public String pathBetween(Place from, Place to, Mode mode) {
        if (!enabled() || from == null || to == null) {
            return null;
        }
        try {
            /* 길 모양만 씁니다. 걷기로 묻고 있고(WALK) 시각표가 없으므로
               언제인지가 상관없습니다. */
            String line = leg(from, to, mode, null).polyline();
            return line == null || line.isBlank() ? null : line;
        } catch (RuntimeException e) {
            /* 길을 못 구한 것으로 찾는 일까지 막지 않습니다. */
            return null;
        }
    }

    /**
     * 그 날 그 시각.
     *
     * <p>대중교통은 <b>언제 타는지가 곧 답을 가릅니다.</b> 안 보내면 구글이
     * 지금으로 잡아서, 11월 일정을 새벽에 짜면 그때 안 다니는 노선이 전부
     * "그런 길 없음" 으로 옵니다.
     *
     * <h3>시각대는 경도로 어림합니다</h3>
     *
     * <p>구글에게는 절대 시각을 줘야 하는데, 우리는 그 나라의 시간대를
     * 모릅니다. 좌표로 시간대를 사 오는 길(Time Zone API)이 있지만 그건
     * 바깥문을 하나 더 여는 일입니다.
     *
     * <p>그래서 <b>경도를 15로 나눠 어림합니다.</b> 오사카(135도)는 +9로
     * 정확히 맞고, 유럽은 한두 시간 틀립니다. <b>틀려도 됩니다</b> — 여기서
     * 고치려는 것은 "낮에 다니는 것을 밤으로 물어서 아무것도 안 나오는 것"
     * 이지 분 단위 정확도가 아닙니다.
     *
     * <h3>구글이 받는 창이 있습니다</h3>
     *
     * <p>지금으로부터 7일 전 ~ 100일 뒤까지만 받습니다. 그 밖이면 <b>안
     * 보냅니다</b> — 보내면 요청 자체가 거절돼서 지금보다 나빠집니다. 아주
     * 먼 여행은 지금처럼 현재 시각으로 계산되고, 그건 원래 하던 대로입니다.
     *
     * @return 못 정하면 {@code null}
     */
    static Instant departureFor(Day day, Place from) {
        LocalDate date = day == null ? null : day.getIso();
        if (date == null) {
            return null;
        }

        /* 적어 둔 시각을 씁니다. "점심때쯤" 처럼 자유롭게 적은 것은 못 읽으니
           낮으로 둡니다 — 집 규칙이 자유 글자를 숫자로 읽지 말라고 합니다. */
        LocalTime at = DEFAULT_DEPARTURE;
        String written = from == null ? null : from.getTime();
        if (written != null && CLOCK.matcher(written.trim()).matches()) {
            at = LocalTime.parse(written.trim());
        }

        /* 경도 15도가 한 시간입니다. 날짜변경선 근처가 ±14까지 갑니다. */
        int offset = Math.max(-12, Math.min(14,
                (int) Math.round((from == null ? 0 : from.getLng()) / 15.0)));
        Instant when = LocalDateTime.of(date, at).toInstant(ZoneOffset.ofHours(offset));

        Instant now = Instant.now();
        if (when.isBefore(now.minus(WINDOW_PAST)) || when.isAfter(now.plus(WINDOW_AHEAD))) {
            return null;
        }
        return when;
    }

    /**
     * @param when 그 날 그 시각에 다니는 것으로 물어봅니다. 비어 있으면
     *             구글이 <b>지금</b>으로 잡습니다 — {@link #departureFor}
     */
    private Leg leg(Place from, Place to, Mode mode, Instant when) {
        String id = cacheKey(from, to, mode, when);
        Cached hit = cache.get(id);
        if (hit != null && hit.until().isAfter(Instant.now())) {
            return hit.leg().withEnds(from.getId(), to.getId());
        }

        Leg fresh = ask(from, to, mode, when);

        /*
          못 물어본 것을 오래 들고 있지 않습니다.

          전에는 성공·실패를 안 가리고 넣었습니다. 그래서 <b>한 번 실패하면
          걷기·자동차는 여섯 시간 동안 그 수단이 화면에서 사라졌습니다.</b>
          새로고침해도 캐시에서 같은 실패가 나왔습니다.

          그렇다고 아예 안 넣을 수도 없습니다. 구글이 잠깐 맛이 갔을 때
          날짜를 열 때마다 서른여섯 번씩 다시 나가고, 그 실패도 문턱을
          깎습니다(spend 는 나가기 전에 셉니다). 그래서 <b>잠깐만</b>
          들고 있습니다 — 사람이 다시 열어 볼 때쯤이면 풀려 있습니다.
         */
        if (fresh == null) {
            cache.put(id, new Cached(Leg.unreachable(from.getId(), to.getId()),
                    Instant.now().plus(KEEP_FAILED)));
            return Leg.unreachable(from.getId(), to.getId());
        }

        Duration keep = mode == Mode.TRANSIT ? KEEP_TRANSIT : KEEP_STATIC;
        cache.put(id, new Cached(fresh, Instant.now().plus(keep)));
        return fresh;
    }

    /**
     * 같은 자리를 다시 묻지 않도록 좌표를 다섯 자리까지만 봅니다. 그 아래는 한
     * 걸음 남짓이라 경로가 달라지지 않습니다.
     */
    private String cacheKey(Place from, Place to, Mode mode, Instant when) {
        /* 시각이 열쇠에 들어가야 합니다. 안 넣으면 11월 1일 아침과 11월 3일
           밤이 같은 칸을 쓰고, 먼저 물은 쪽의 답이 다른 날에도 나옵니다. */
        return String.format(Locale.ROOT, "%s|%.5f,%.5f|%.5f,%.5f|%s",
                mode, from.getLat(), from.getLng(), to.getLat(), to.getLng(),
                when == null ? "now" : when.toString());
    }

    private Leg ask(Place from, Place to, Mode mode, Instant when) {
        /* 여기가 실제로 나가는 자리입니다. 캐시에 맞은 구간은 여기까지 안
           오므로 세지 않습니다. leg() 와 fromHere() 둘 다 이 앞을 지나므로
           한 곳만 적어 두면 빠뜨릴 자리가 없습니다. */
        quota.spend(quotaKey.current(), 1);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("origin", point(from.getLat(), from.getLng()));
        body.put("destination", point(to.getLat(), to.getLng()));
        body.put("travelMode", mode.name());
        body.put("languageCode", "ko");
        body.put("units", "METRIC");
        /* routingPreference 는 차로 갈 때만 받습니다. 걷기나 대중교통에 붙이면
           요청 자체가 거절당합니다. */
        if (mode == Mode.DRIVE) {
            body.put("routingPreference", "TRAFFIC_AWARE");
        }
        /*
          언제 타는지.

          안 보내면 구글이 <b>지금</b>으로 잡습니다. 그래서 11월 일정을 새벽에
          짜면 그 시각에 안 다니는 노선이 전부 "그런 길 없음" 으로 왔습니다.
          걷기와 차는 시각표가 없어 멀쩡히 나오니, 대중교통만 빠진 것처럼
          보였습니다.

          걷기·차에는 안 붙입니다. 차에 붙이면 그 시각의 교통량으로 계산이
          바뀌는데, 그건 이 결함과 상관없는 다른 변화입니다.
         */
        if (mode == Mode.TRANSIT && when != null) {
            body.put("departureTime", DateTimeFormatter.ISO_INSTANT.format(when));
        }

        try {
            JsonNode res = client.post()
                    .uri("/directions/v2:computeRoutes")
                    .header("X-Goog-Api-Key", key)
                    /* 달라고 한 것만 옵니다. 안 적으면 요청이 거절되고, 넓게
                       적으면 더 비싼 등급으로 넘어갑니다. */
                    /* 대중교통일 때만 요금을 더 달라고 합니다. 걷기·자동차에
                       붙이면 있지도 않은 칸을 달라는 것이라 거절당합니다. */
                    .header("X-Goog-FieldMask", mode == Mode.TRANSIT
                            ? "routes.duration,routes.distanceMeters,"
                              + "routes.polyline.encodedPolyline,routes.travelAdvisory.transitFare"
                            : "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline")
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            JsonNode route = res == null ? null : res.path("routes").path(0);
            if (route == null || route.isMissingNode() || route.isEmpty()) {
                /*
                  섬과 뭍처럼 그 수단으로는 이어지지 않는 구간이 있습니다.
                  오류가 아니라 "그 길은 없다" 입니다.

                  대중교통에서는 자주 일어납니다. 두 곳이 몇 백 미터밖에 안
                  떨어져 있으면 구글은 버스나 지하철을 태울 이유가 없다고 보고
                  아무 경로도 주지 않습니다. 그래서 짧은 구간만 있는 하루는
                  대중교통으로 아무것도 안 나오는 것처럼 보입니다.

                  왜 비었는지 뒤에서 알아볼 수 있게 남깁니다. 조용히 넘기면
                  키 문제인지 거리 문제인지 구별할 방법이 없습니다.
                */
                /*
                  <b>무엇을 물었는지도 함께 남깁니다.</b>

                  <p>전에는 응답만 남겼습니다. 그래서 빈 답이 왔을 때 "구글이
                  없다고 한 것" 까지는 알아도 <b>우리가 뭘 물었는지</b>를 알
                  방법이 없었습니다. 도쿄 한복판 4km 에 전철이 없다고 나올
                  때 의심해야 하는 것은 답이 아니라 질문입니다.

                  <p>키는 안 남깁니다 — 몸통에 없습니다. 좌표는 이미 위에
                  찍히고 있고, 그 좌표는 사람이 일정에 스스로 넣은 자리라
                  자취가 아닙니다.
                 */
                /*
                  가까운 데 전철이 없는 것은 <b>맞는 답</b>입니다.

                  <p>구글은 몇백 미터 구간에 대중교통을 안 태웁니다 — 걸으라는
                  뜻이고, 우리도 그 구간은 세지 않습니다(farApart).

                  <p>그런데 그것까지 INFO 로 찍고 있었습니다. 하루에 짧은 구간이
                  여럿이면 그만큼 줄이 쌓여서, 정작 <b>진짜 이상한 것</b>(도쿄
                  한복판 4km 에 전철이 없다는 답)이 그 사이에 묻힙니다.

                  <p>가까운 구간의 빈 답은 DEBUG 로 내립니다. 평소에는 안 보이고
                  파고들 때만 켭니다.
                 */
                boolean expected = mode == Mode.TRANSIT && !farApart(from, to);
                if (expected) {
                    log.debug("가까워서 대중교통이 없어요: {},{} -> {},{}",
                            from.getLat(), from.getLng(), to.getLat(), to.getLng());
                } else {
                    log.info("경로가 비었어요: mode={} {},{} -> {},{} | 물은 것={} | 받은 것={}",
                            mode, from.getLat(), from.getLng(), to.getLat(), to.getLng(),
                            body, res == null ? "null" : res.toString());
                }
                return Leg.unreachable(from.getId(), to.getId());
            }

            int meters = route.path("distanceMeters").asInt(0);
            TaxiFare.Money fare = mode == Mode.TRANSIT
                    ? transitFare(route.path("travelAdvisory").path("transitFare"))
                    /* 구글은 택시 요금을 주지 않습니다. 우리가 어림하고, 화면이
                       "어림값" 이라고 붙입니다. */
                    : mode == Mode.DRIVE
                            ? TaxiFare.estimate(from.getLat(), from.getLng(), meters)
                            : null;

            return new Leg(
                    from.getId(),
                    to.getId(),
                    seconds(route.path("duration").asText("")),
                    meters,
                    route.path("polyline").path("encodedPolyline").asText(null),
                    true,
                    fare);
        } catch (Exception e) {
            /*
              한 구간이 안 됐다고 하루 전체를 못 보여 줄 이유는 없습니다. 그
              구간만 비워 두고 나머지를 그립니다.

              <b>여기서는 null 입니다.</b> "그 길이 없다"(위)와 달리 이것은
              "못 물어봤다" 입니다. 둘을 같은 값으로 돌려주면 부르는 쪽이
              가릴 수 없고, 그러면 실패한 답이 캐시에 여섯 시간 눌러앉습니다.
             */
            log.warn("경로를 받지 못했어요: mode={} {}", mode, e.getMessage());
            return null;
        }
    }

    private static Map<String, Object> point(double lat, double lng) {
        return Map.of("location", Map.of("latLng", Map.of("latitude", lat, "longitude", lng)));
    }

    /** 구글은 "165s" 처럼 초 뒤에 s 를 붙여 보냅니다. */
    /**
     * 구글이 준 소요시간을 초로.
     *
     * <p><b>소수점이 붙어 옵니다.</b> 구글의 {@code Duration} 은 프로토버프
     * JSON 규칙을 따르고, 그 규칙은 "0·3·6·9 자리의 소수" 뒤에 {@code s} 를
     * 붙인다고 적혀 있습니다. 그래서 {@code "2345s"} 도 오고
     * {@code "2345.500s"} 도 옵니다.
     *
     * <p>전에는 {@link Integer#parseInt} 하나로 읽었습니다. 소수점이 붙은
     * 것은 거기서 터지고 <b>0초</b>가 됐습니다. 그리고 {@code compare} 가
     * {@code seconds() > 0} 으로 거르므로 <b>그 수단이 조용히 사라졌습니다.</b>
     *
     * <p>로그도 안 남았습니다 — 경로는 멀쩡히 왔고, 우리가 못 읽은 것뿐입니다.
     * 그래서 "구글맵에는 나오는데 우리 앱에는 대중교통이 없다" 가 됐습니다.
     *
     * <p>0 은 <b>못 읽었다</b>는 뜻으로만 씁니다. 실제로 0초 걸리는 구간은
     * 없습니다.
     */
    static int seconds(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        String digits = text.endsWith("s") ? text.substring(0, text.length() - 1) : text;
        try {
            /* 소수를 그대로 받아 반올림합니다. 초 아래는 이동 시간에서 뜻이
               없습니다. */
            double parsed = Double.parseDouble(digits.trim());
            return parsed <= 0 ? 0 : (int) Math.round(parsed);
        } catch (NumberFormatException e) {
            log.warn("소요시간을 못 읽었어요: {}", text);
            return 0;
        }
    }

    /** 사람이 고르는 이동 수단. 구글이 받는 이름과 같게 둡니다. */
    public enum Mode {
        WALK,
        TRANSIT,
        DRIVE
    }

    /**
     * 한 구간.
     *
     * @param polyline  지도에 그릴 길. 이어지지 않는 구간이면 비어 있습니다.
     * @param reachable 그 수단으로 갈 수 있는지
     */
    public record Leg(String fromId, String toId, int seconds, int meters,
                      String polyline, boolean reachable, TaxiFare.Money fare) {

        static Leg unreachable(String fromId, String toId) {
            return new Leg(fromId, toId, 0, 0, null, false, null);
        }

        Leg withEnds(String fromId, String toId) {
            return new Leg(fromId, toId, seconds, meters, polyline, reachable, fare);
        }
    }

    /**
     * 구글이 준 대중교통 요금.
     *
     * <p>{"currencyCode":"JPY","units":"230"} 처럼 옵니다. 소수점 아래는 nanos
     * 로 따로 오는데, 표에 적을 값이라 버립니다.
     *
     * <p>이것은 어림이 아니라 구글이 계산한 값이라 estimated 가 false 입니다.
     */
    private static TaxiFare.Money transitFare(JsonNode fare) {
        if (fare == null || fare.isMissingNode() || !fare.hasNonNull("currencyCode")) {
            return null;
        }
        long units = fare.path("units").asLong(0);
        if (units <= 0) {
            return null;
        }
        return new TaxiFare.Money(fare.path("currencyCode").asText(""), units, false);
    }

    /**
     * 하루치 경로.
     *
     * @param trimmed 장소가 너무 많아 뒷부분을 계산하지 않았는지
     */
    public record DayRoute(Mode mode, List<Leg> legs, int totalSeconds, int totalMeters,
                           boolean trimmed) {
    }

    private record Cached(Leg leg, Instant until) {
    }
}
