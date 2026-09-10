package net.weeniebeenie.fit.support.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.setting.Setting;
import net.weeniebeenie.fit.support.setting.SettingRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 동행자가 고쳤을 때 알려 주기.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>함께 짜는 일정인데, 남이 고친 것은 내가 그 화면을 다시 열어야만 압니다.
 * 출발 전날 동행자가 저녁 자리를 바꿔 놨는데 나는 옛 가게로 가는 일이
 * 생깁니다.
 *
 * <h3>열쇠는 우리가 만들어 둡니다</h3>
 *
 * <p>알림을 보내려면 서버에 신분이 될 열쇠 한 쌍이 있어야 합니다. 이것을
 * 설정 파일로 받게 하면 쓰는 사람이 열쇠를 만들어 어딘가에 적어 넣어야
 * 하는데, 그 과정에서 개인키가 터미널 기록이나 채팅방에 남습니다.
 *
 * <p>그래서 서버가 처음 필요할 때 스스로 만들어 DB 에 넣어 둡니다. 공개키는
 * 화면이 가져가고(공개하라고 있는 것입니다), 개인키는 나가지 않습니다.
 *
 * <h3>한꺼번에 여러 번 울리지 않게</h3>
 *
 * <p>일정을 고칠 때는 대개 연달아 고칩니다. 장소 셋을 옮기고 시간을 두 번
 * 바꾸면 그것만으로 다섯 번입니다. 그때마다 울리면 알림을 꺼 버리게 됩니다.
 * 여행마다 받는 사람마다 한동안은 한 번만 보냅니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushService {

    /** 공개키를 담아 두는 설정 이름. */
    private static final String KEY_PUBLIC = "push.publicKey";

    /** 개인키. 밖으로 나가지 않습니다. */
    private static final String KEY_PRIVATE = "push.privateKey";

    /**
     * 같은 여행으로 다시 울리기까지 두는 시간(분).
     *
     * <p>짧으면 연달아 울리고, 길면 정작 알아야 할 것을 놓칩니다. 십 분이면
     * "한 번 앉아 고치는 동안" 은 대개 덮입니다.
     */
    private static final long QUIET_MINUTES = 10;

    /** 한 사람이 켤 수 있는 기기 수. 폰·태블릿·노트북이면 넉넉합니다. */
    private static final int MAX_DEVICES = 10;

    private final PushSubscriptionRepository subs;
    private final SettingRepository settings;

    /**
     * 알림에 적히는 연락처.
     *
     * <p>중계 서버가 문제가 생겼을 때 연락할 곳으로 씁니다. 비워 두면 표준이
     * 요구하는 자리가 비어 거절하는 중계 서버가 있어, 안 넣었으면 우리 주소를
     * 씁니다.
     */
    @Value("${fit.push.contact:https://fit.weenie-beenie.net}")
    private String contact;

    private final RestClient client = RestClient.builder().build();

    /**
     * 여행마다 사람마다 마지막으로 울린 때.
     *
     * <p>DB 에 두지 않습니다. 서버가 다시 뜨면 한 번쯤 더 울릴 뿐이고, 그것
     * 때문에 알림마다 쓰기를 한 번씩 하는 편이 손해입니다.
     */
    private final Map<String, Instant> lastSent = new ConcurrentHashMap<>();

    /* --------------------------------------------------------------- 열쇠 */

    /**
     * 화면이 가져갈 공개키.
     *
     * <p>없으면 이때 만듭니다. 아무도 알림을 안 켜는 서버에서는 열쇠도
     * 만들어지지 않습니다.
     */
    @Transactional
    public String publicKey() {
        return settings.findById(KEY_PUBLIC).map(Setting::getValue).orElseGet(() -> {
            WebPush.Keys made = WebPush.newKeys();
            settings.save(new Setting(KEY_PUBLIC, made.publicKey()));
            settings.save(new Setting(KEY_PRIVATE, made.privateKey()));
            log.info("알림 열쇠를 새로 만들었습니다.");
            return made.publicKey();
        });
    }

    private String privateKey() {
        return settings.findById(KEY_PRIVATE).map(Setting::getValue).orElse(null);
    }

    /* --------------------------------------------------------------- 켜고 끄기 */

    /**
     * 이 기기로 알림을 받겠다.
     *
     * <p>같은 기기가 다시 오면 덮어씁니다. 브라우저는 껐다 켤 때 같은 주소를
     * 주는데, 그때마다 새로 쌓으면 알림이 여러 번 옵니다.
     */
    @Transactional
    public void subscribe(AuthPrincipal me, String endpoint, String p256dh, String auth) {
        if (endpoint == null || endpoint.isBlank() || p256dh == null || auth == null) {
            throw ApiException.badRequest("알림을 켤 수 없습니다. 브라우저가 준 값이 비었습니다.");
        }

        PushSubscription found = subs.findByEndpoint(endpoint).orElse(null);
        if (found != null) {
            found.setUserId(me.id());
            found.setP256dh(p256dh);
            found.setAuth(auth);
            found.setFailedAt(null);
            return;
        }

        if (subs.countByUserId(me.id()) >= MAX_DEVICES) {
            throw ApiException.badRequest("기기를 너무 많이 켜 두었습니다. 안 쓰는 것에서 꺼 주세요.");
        }

        subs.save(PushSubscription.builder()
                .userId(me.id())
                .endpoint(endpoint)
                .p256dh(p256dh)
                .auth(auth)
                .build());
    }

    /** 이 기기에서는 그만 받겠다. */
    @Transactional
    public void unsubscribe(AuthPrincipal me, String endpoint) {
        subs.findByEndpoint(endpoint)
                .filter(s -> s.getUserId().equals(me.id()))
                .ifPresent(subs::delete);
    }

    /** 이 사람이 어디서든 켜 두었는지. 화면의 스위치가 이것을 봅니다. */
    @Transactional(readOnly = true)
    public boolean on(AuthPrincipal me) {
        return subs.countByUserId(me.id()) > 0;
    }

    /* --------------------------------------------------------------- 보내기 */

    /**
     * 이 여행을 함께 짜는 사람들에게 한 줄.
     *
     * <p>고친 사람에게는 보내지 않습니다. 자기가 방금 한 일을 알림으로 다시
     * 받으면 성가시기만 합니다.
     *
     * <p>따로 돌립니다. 알림 하나가 중계 서버에 닿는 데 이백 밀리초쯤 걸리는데,
     * 그것 때문에 장소 하나 옮기는 일이 느려질 이유가 없습니다. 실패해도
     * 고친 것은 이미 저장되어 있어야 합니다.
     */
    @Async
    @Transactional
    public void tell(List<String> userIds, String actorId, String tripId, String title, String body, String url) {
        String secret = privateKey();
        if (secret == null) {
            /* 아무도 켜지 않은 서버입니다. 열쇠도 없습니다. */
            return;
        }

        /* 고친 사람에게는 보내지 않습니다. 다만 "내일입니다" 처럼 누가 한
           일이 아닌 알림은 actorId 없이 오고, 그때는 전원이 받습니다. */
        List<String> targets = actorId == null
                ? userIds
                : userIds.stream().filter(id -> !id.equals(actorId)).toList();
        if (targets.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        for (PushSubscription sub : subs.findAllByUserIdIn(targets)) {
            String quietKey = tripId + ":" + sub.getUserId();
            Instant last = lastSent.get(quietKey);
            if (last != null && last.plusSeconds(QUIET_MINUTES * 60).isAfter(now)) {
                continue;
            }
            lastSent.put(quietKey, now);
            send(sub, secret, json(title, body, url));
        }
    }

    /** 켜자마자 한 번. 켜 놓고 오는지 안 오는지 모르는 것만큼 답답한 것이 없습니다. */
    @Async
    @Transactional
    public void hello(String endpoint) {
        String secret = privateKey();
        PushSubscription sub = subs.findByEndpoint(endpoint).orElse(null);
        if (secret == null || sub == null) {
            return;
        }
        send(sub, secret, json("알림을 켰습니다", "동행자가 일정을 고치면 여기로 알려 드립니다.", "/"));
    }

    private void send(PushSubscription sub, String secret, String payload) {
        try {
            URI where = URI.create(sub.getEndpoint());
            String audience = where.getScheme() + "://" + where.getHost();
            String token = WebPush.token(audience, contactOf(), secret,
                    Instant.now().getEpochSecond());
            byte[] sealed = WebPush.seal(sub.getP256dh(), sub.getAuth(), payload);

            client.post()
                    .uri(where)
                    .header("Authorization", "vapid t=" + token + ", k=" + publicKey())
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    /* 브라우저가 꺼져 있으면 중계 서버가 들고 있습니다. 하루를
                       넘겨 들고 있어 봐야 이미 지난 이야기입니다. */
                    .header("TTL", "86400")
                    .header("Urgency", "normal")
                    .body(sealed)
                    .retrieve()
                    .toBodilessEntity();
        } catch (org.springframework.web.client.RestClientResponseException e) {
            HttpStatusCode code = e.getStatusCode();
            if (code.value() == 404 || code.value() == 410) {
                /* 브라우저를 지웠거나 알림을 껐습니다. 없는 곳에 계속 보내는
                   것은 낭비입니다. */
                subs.delete(sub);
                return;
            }
            sub.setFailedAt(Instant.now());
            log.warn("알림을 보내지 못했습니다 ({}): {}", code, e.getResponseBodyAsString());
        } catch (Exception e) {
            sub.setFailedAt(Instant.now());
            log.warn("알림을 보내지 못했습니다: {}", e.getMessage());
        }
    }

    /** 표에 적을 연락처. mailto: 나 https: 로 시작해야 중계 서버가 받습니다. */
    private String contactOf() {
        if (contact == null || contact.isBlank()) {
            return "https://fit.weenie-beenie.net";
        }
        return contact.startsWith("mailto:") || contact.startsWith("https://")
                ? contact
                : "mailto:" + contact;
    }

    /**
     * 알림 한 장.
     *
     * <p>손으로 짭니다. 글자 몇 개짜리라 매퍼를 부를 일이 아니고, 여기서
     * 새는 문자를 막아야 할 곳도 이 한자리뿐입니다.
     */
    private static String json(String title, String body, String url) {
        return "{\"title\":\"" + esc(title) + "\",\"body\":\"" + esc(body)
                + "\",\"url\":\"" + esc(url) + "\"}";
    }

    private static String esc(String raw) {
        StringBuilder out = new StringBuilder(raw.length() + 8);
        for (char c : raw.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }

    /** 몸통을 바이트로 보낼 때 쓰는 글자표. 봉한 것은 이미 바이트라 쓰이지 않습니다. */
    static byte[] utf8(String raw) {
        return raw.getBytes(StandardCharsets.UTF_8);
    }
}
