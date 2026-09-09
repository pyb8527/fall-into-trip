package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.application.PlaceInfoService;
import net.weeniebeenie.fit.trip.application.RouteService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.Map;

/**
 * 하루치 곁다리 정보 — 동선과 장소 안내.
 *
 * <p>날짜 하나를 통째로 묻습니다. 구간을 하나씩 묻게 두면 화면이 장소 수만큼
 * 요청을 던지고, 그만큼 요금이 붙습니다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/days/{dayId}")
public class DayExtrasController {

    private final RouteService routes;
    private final PlaceInfoService info;

    @GetMapping("/route")
    public Map<String, Object> of(@CurrentUser AuthPrincipal me,
                                  @PathVariable String dayId,
                                  @RequestParam(name = "mode", defaultValue = "TRANSIT") String mode) {
        return Map.of("route", routes.of(me, dayId, parse(mode)));
    }

    /**
     * 사이사이를 세 수단으로 한꺼번에.
     *
     * <p>수단을 고르게 하지 않고 알아서 셋을 다 계산해 내려 줍니다. 대신
     * 구간마다 요금이 세 배로 나가므로, 화면은 <b>날짜 하나를 펼쳤을 때만</b>
     * 이것을 부릅니다.
     */
    @GetMapping("/route/compare")
    public Map<String, Object> compare(@CurrentUser AuthPrincipal me,
                                       @PathVariable String dayId) {
        return Map.of("gaps", routes.compare(me, dayId));
    }

    /**
     * 이 날에 넣어 둔 장소들이 언제 문을 여는지.
     *
     * <p>장소를 하나씩 묻게 두면 화면이 장소 수만큼 요청을 던집니다. 하루를
     * 통째로 묻습니다.
     */
    @GetMapping("/places-info")
    public Map<String, Object> places(@CurrentUser AuthPrincipal me, @PathVariable String dayId) {
        return Map.of("info", info.ofDay(me, dayId));
    }

    private static RouteService.Mode parse(String mode) {
        try {
            return RouteService.Mode.valueOf(mode.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("알 수 없는 이동 수단입니다.");
        }
    }
}
