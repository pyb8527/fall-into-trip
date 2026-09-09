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

    public record SubscribeRequest(
            @NotBlank String endpoint,
            @NotBlank String p256dh,
            @NotBlank String auth) {
    }

    public record UnsubscribeRequest(@NotBlank String endpoint) {
    }
}
