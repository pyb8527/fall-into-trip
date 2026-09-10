package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.support.push.PushService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 내일 뭐 하는지 미리 알려 줍니다.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>알림은 이미 있지만 "동행자가 고쳤을 때" 만 옵니다. 그런데 정작 알아야
 * 할 것은 <b>내일 아침 몇 시에 어디로 가는지</b> 입니다. 전날 밤에 앱을 열어
 * 확인하는 사람은 열지 않는 날 늦습니다.
 *
 * <h3>전날 저녁에 한 번</h3>
 *
 * <p>당일 아침에 보내면 이미 늦습니다 — 첫 일정이 아홉 시면 일곱 시에는
 * 일어나야 하고, 그 시간에 알림을 받아 봐야 할 수 있는 것이 없습니다.
 * 전날 저녁에 보내면 준비할 시간이 있습니다.
 *
 * <h3>시간대는 여행지가 아니라 우리 서버 기준입니다</h3>
 *
 * <p>여행마다 어느 나라인지 알 수는 있지만(장소 좌표), 알림을 받는 사람은
 * 대개 아직 집에 있습니다. 출발 전날 밤에 오는 것이라 집 시간이 맞습니다.
 * 여행 중이라면 한두 시간 어긋날 수 있는데, "내일 첫 일정" 을 알리는 데
 * 그 정도는 문제가 되지 않습니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TripReminder {

    private final DayRepository days;
    private final PlaceRepository places;
    private final TripRepository trips;
    private final TripMemberRepository members;
    private final PushService push;

    /**
     * 매일 저녁 여덟 시.
     *
     * <p>한 번만 돕니다. 놓치면 그날은 안 갑니다 — 지난 것을 뒤늦게 보내면
     * 자는 사람을 깨웁니다.
     */
    @Scheduled(cron = "0 0 20 * * *")
    @Transactional(readOnly = true)
    public void tellAboutTomorrow() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);

        for (Day day : days.findAllByIso(tomorrow)) {
            List<Place> plan = places.findAllByDayIdOrderBySortAsc(day.getId());
            if (plan.isEmpty()) {
                /* 비어 있는 날에 대해 알릴 것이 없습니다. */
                continue;
            }

            trips.findById(day.getTripId()).ifPresent(trip -> {
                List<String> people = members.findAllByIdTripId(trip.getId()).stream()
                        .map(m -> m.getId().getUserId())
                        .toList();

                /*
                  고친 사람에게는 안 보내는 규칙(tell)이 여기서는 걸리면
                  안 됩니다. 이건 누가 한 일에 대한 알림이 아니라 내일에
                  대한 알림이라, 전원이 받아야 합니다.
                 */
                push.tell(people, null, "tomorrow:" + day.getId(),
                        trip.getTitle() + " — 내일입니다",
                        lineOf(plan, day),
                        "/trip/" + trip.getId());
            });
        }
    }

    /**
     * 한 줄 요약.
     *
     * <p>알림에 일정을 다 적으면 읽히지 않습니다. 첫 곳과 몇 군데인지만
     * 적고, 나머지는 눌러서 봅니다.
     */
    private static String lineOf(List<Place> plan, Day day) {
        Place first = plan.get(0);
        String when = first.getTime() == null ? "" : first.getTime() + " ";
        String more = plan.size() > 1 ? " 외 " + (plan.size() - 1) + "곳" : "";
        String stay = day.getStayName() == null ? "" : " · 숙소 " + day.getStayName();
        return when + first.getName() + more + stay;
    }
}
