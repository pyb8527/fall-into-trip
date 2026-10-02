package net.weeniebeenie.fit.support.push;

import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 알림 켜고 끄기.
 *
 * <p>브라우저가 알림 자리를 하나 내주면(endpoint 와 열쇠 두 개) 그것을 여기에
 * 맡깁니다. 우리는 그리로 보냅니다.
 */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushService push;

    /**
     * 알림을 켤 때 브라우저에 넘겨줄 공개키.
     *
     * <p>로그인 없이도 줍니다 — 공개하라고 있는 것이고, 화면이 알림을 켤 수
     * 있는 서버인지 먼저 확인하는 데 씁니다.
     */
    @GetMapping("/key")
    public Map<String, Object> key() {
        return Map.of("publicKey", push.publicKey());
    }

    /** 지금 이 사람이 알림을 켜 두었는지. 화면의 스위치가 이것을 봅니다. */
    @GetMapping("/state")
    public Map<String, Object> state(@CurrentUser AuthPrincipal me) {
        return Map.of("on", push.on(me));
    }

    @PostMapping("/subscribe")
    public Map<String, Object> subscribe(@CurrentUser AuthPrincipal me,
                                         @RequestBody SubscribeRequest req) {
        push.subscribe(me, req.endpoint(), req.p256dh(), req.auth());
        /* 켜자마자 한 번 보내 봅니다. 오는지 안 오는지 모르는 채로 켜 두는
           것만큼 답답한 것이 없습니다. */
        push.hello(req.endpoint());
        return Map.of("ok", true);
    }

    @PostMapping("/unsubscribe")
    public Map<String, Object> unsubscribe(@CurrentUser AuthPrincipal me,
                                           @RequestBody UnsubscribeRequest req) {
        push.unsubscribe(me, req.endpoint());
        return Map.of("ok", true);
    }

    /**
     * 기기 하나를 켭니다.
     *
     * <h3>열쇠 둘은 비어 있을 수 있습니다</h3>
     *
     * <p>{@code p256dh}·{@code auth} 에 {@link NotBlank} 를 달아 두었습니다.
     * 그래서 <b>앱에서는 알림을 켤 수가 없었습니다</b> — 브라우저는 주소와
     * 열쇠 둘을 주지만 앱은 {@code ExponentPushToken[...]} 한 줄이 전부이고
     * (Expo 가 대신 넘겨 주므로 우리가 암호화할 일이 없습니다), 화면은 그
     * 둘을 {@code null} 로 보냅니다. 여기서 400 으로 막혀 「알림을 켜지
     * 못했어요」가 떴습니다.
     *
     * <p>비었는지 보는 일은 {@link PushService#subscribe} 가 합니다. 그쪽은
     * <b>생김새를 보고</b> 가립니다 — 앱 토큰이면 열쇠가 없어도 되고,
     * 브라우저 주소면 둘 다 있어야 합니다. 여기서 한 번 더 막으면 그 규칙이
     * 닿지 못하는 자리가 생깁니다. 규칙은 한 군데에만 둡니다.
     *
     * <p>{@code endpoint} 의 {@link NotBlank} 는 남깁니다 — 그것은 어느
     * 갈래든 있어야 하는 값입니다.
     */
    public record SubscribeRequest(
            @NotBlank String endpoint,
            String p256dh,
            String auth) {
    }

    public record UnsubscribeRequest(@NotBlank String endpoint) {
    }
}
