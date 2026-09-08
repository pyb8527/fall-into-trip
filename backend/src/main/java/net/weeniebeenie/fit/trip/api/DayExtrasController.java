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
