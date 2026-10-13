package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.PlaceInfoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 하루치 곁다리 정보 — 장소 안내.
 *
 * <p>날짜 하나를 통째로 묻습니다. 장소를 하나씩 묻게 두면 화면이 장소 수만큼
 * 요청을 던지고, 그만큼 요금이 붙습니다.
 *
 * <p>장소 사이 동선({@code /route}, {@code /route/compare})도 여기 있었습니다.
 * 2026-10-13 에 걷어냈습니다 — 화면의 길찾기 링크가 왜 그런지 적어 둡니다
 * ({@code frontend/src/lib/directions.ts}).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/days/{dayId}")
public class DayExtrasController {

    private final PlaceInfoService info;

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
}
