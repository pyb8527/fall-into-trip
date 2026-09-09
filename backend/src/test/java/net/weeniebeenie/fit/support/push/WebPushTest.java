package net.weeniebeenie.fit.support.push;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 알림 봉하기가 표준대로인지.
 *
 * <p>진짜 확인은 폰에 알림이 뜨는 것입니다. 여기서는 그 앞의 것들 — 우리가
 * 봉한 것을 받는 쪽이 열 수 있는지, 봉투 겉면의 자릿수가 맞는지, 서명의
 * 모양이 맞는지 — 를 봅니다. 이것들이 어긋나면 브라우저는 아무 말 없이
 * 버리므로, 틀린 것을 여기서 잡지 못하면 "왜 안 오지" 만 남습니다.
 */
class WebPushTest {

    @Test
    @DisplayName("봉한 것을 받는 쪽 열쇠로 다시 연다")
    void sealAndOpen() throws Exception {
        /* 브라우저가 만들어 주는 것들을 흉내 냅니다. */
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair device = gen.generateKeyPair();

        String p256dh = WebPush.b64(WebPush.rawOf((ECPublicKey) device.getPublic()));
        String devicePrivate = WebPush.b64(WebPush.fixed(
                ((java.security.interfaces.ECPrivateKey) device.getPrivate()).getS().toByteArray(), 32));
        String auth = WebPush.b64(new byte[]{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16});

        String text = "{\"title\":\"동행자가 일정을 고쳤습니다\",\"body\":\"「이치란」 를 넣었습니다.\"}";
        byte[] body = WebPush.seal(p256dh, auth, text);

        assertEquals(text, WebPush.open(body, devicePrivate, p256dh, auth));
    }

    @Test
    @DisplayName("봉투 겉면의 자릿수가 표준과 같다")
    void envelopeLayout() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair device = gen.generateKeyPair();
        String p256dh = WebPush.b64(WebPush.rawOf((ECPublicKey) device.getPublic()));
        String auth = WebPush.b64(new byte[16]);

        byte[] body = WebPush.seal(p256dh, auth, "안녕");
        ByteBuffer in = ByteBuffer.wrap(body);

        byte[] salt = new byte[16];
        in.get(salt);
        /* 한 번에 받는 크기는 4096. 표준이 정한 값입니다. */
        assertEquals(4096, in.getInt());
        /* 그 뒤에 열쇠 길이 한 바이트, 그리고 그만큼의 공개키. */
        assertEquals(65, in.get() & 0xff);
        byte[] key = new byte[65];
        in.get(key);
        assertEquals(4, key[0], "압축하지 않은 공개키는 0x04 로 시작합니다");

        /* 봉한 글은 원문보다 GCM 꼬리표 16바이트와 끝 표시 1바이트만큼 깁니다. */
        assertEquals("안녕".getBytes(java.nio.charset.StandardCharsets.UTF_8).length + 1 + 16,
                in.remaining());
    }

    @Test
    @DisplayName("같은 글을 두 번 봉하면 다른 것이 나온다")
    void neverTheSameTwice() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair device = gen.generateKeyPair();
        String p256dh = WebPush.b64(WebPush.rawOf((ECPublicKey) device.getPublic()));
        String auth = WebPush.b64(new byte[16]);

        /* 소금과 임시 열쇠를 매번 새로 뽑으므로 같은 글도 다르게 봉해집니다.
           같으면 두 알림을 견줘 내용을 짐작할 수 있게 됩니다. */
        assertNotEquals(
                Base64.getEncoder().encodeToString(WebPush.seal(p256dh, auth, "같은 글")),
                Base64.getEncoder().encodeToString(WebPush.seal(p256dh, auth, "같은 글")));
    }

    @Test
    @DisplayName("표는 세 도막이고 서명은 64바이트다")
    void vapidToken() {
        WebPush.Keys keys = WebPush.newKeys();
        String token = WebPush.token("https://fcm.googleapis.com", "mailto:a@b.c",
                keys.privateKey(), 1_700_000_000L);

        String[] parts = token.split("\\.");
        assertEquals(3, parts.length);

        /* JWT 의 ES256 서명은 r 과 s 를 32바이트씩 이어 붙인 64바이트입니다.
           자바가 내놓는 DER 을 그대로 실으면 중계 서버가 거절합니다. */
        assertEquals(64, WebPush.unb64(parts[2]).length);

        String claims = new String(WebPush.unb64(parts[1]),
                java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(claims.contains("\"aud\":\"https://fcm.googleapis.com\""), claims);
        /* 12시간짜리. 표준은 24시간까지 받지만 시계가 어긋난 서버를 위해
           여유를 둡니다. */
        assertTrue(claims.contains("\"exp\":1700043200"), claims);
    }

    @Test
    @DisplayName("열쇠는 만들 때마다 다르고 길이가 맞다")
    void keys() {
        WebPush.Keys a = WebPush.newKeys();
        WebPush.Keys b = WebPush.newKeys();

        assertNotEquals(a.privateKey(), b.privateKey());
        assertEquals(65, WebPush.unb64(a.publicKey()).length);
        assertEquals(32, WebPush.unb64(a.privateKey()).length);
    }
}
