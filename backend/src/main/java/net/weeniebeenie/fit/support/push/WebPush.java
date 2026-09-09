package net.weeniebeenie.fit.support.push;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.util.Arrays;
import java.util.Base64;

/**
 * 브라우저에 알림 하나를 보내는 데 필요한 암호 작업.
 *
 * <p>여기에 라이브러리를 붙이지 않았습니다. 쓸 만한 것은 하나같이 netty 와
 * BouncyCastle 을 통째로 끌고 오는데, 우리가 쓰는 것은 자바 17 이 이미 다
 * 갖고 있는 것들(P-256 타원곡선, ECDH, HMAC, AES-GCM)뿐입니다.
 *
 * <h3>무엇을 하는가</h3>
 *
 * <ol>
 *   <li><b>우리가 보낸 것임을 밝힙니다</b>(VAPID, RFC 8292). 서버의 열쇠로
 *       서명한 표를 함께 보냅니다. 이것이 없으면 누구든 남의 브라우저에
 *       알림을 밀어 넣을 수 있습니다.</li>
 *   <li><b>내용을 봉합니다</b>(RFC 8291). 알림 글은 구글·애플의 중계 서버를
 *       지나가는데, 그들이 읽을 수 있으면 안 됩니다. 받는 기기만 열 수 있게
 *       봉해서 보냅니다. 중계 서버는 봉투만 봅니다.</li>
 * </ol>
 *
 * <h3>봉하는 차례</h3>
 *
 * <p>표준에 정해진 그대로입니다. 한 자리라도 어긋나면 브라우저가 조용히
 * 버리므로, 각 단계에 무엇이 들어가는지 적어 둡니다.
 *
 * <pre>
 *   공유비밀 = ECDH(우리 임시 개인키, 기기 공개키)
 *   IKM      = HKDF(소금=기기의 auth, 재료=공유비밀,
 *                   설명="WebPush: info"+0+기기공개키+우리임시공개키, 32바이트)
 *   PRK      = HKDF-추출(소금=이번에 뽑은 난수 16바이트, 재료=IKM)
 *   열쇠     = HKDF-펼침(PRK, "Content-Encoding: aes128gcm"+0, 16바이트)
 *   난스     = HKDF-펼침(PRK, "Content-Encoding: nonce"+0, 12바이트)
 * </pre>
 */
public final class WebPush {

    /** 브라우저가 한 번에 받는 크기. 표준이 정한 값이라 바꿀 것이 없습니다. */
    private static final int RECORD_SIZE = 4096;

    /** 압축하지 않은 P-256 공개키의 길이(0x04 + x 32 + y 32). */
    private static final int RAW_KEY_LEN = 65;

    private WebPush() {
    }

    /* --------------------------------------------------------------- 열쇠 */

    /** 서버가 처음 한 번 만들어 두고 계속 쓰는 열쇠 한 쌍. */
    public record Keys(String publicKey, String privateKey) {
    }

    /**
     * 서버의 신분이 될 열쇠 한 쌍.
     *
     * <p>공개키는 브라우저에 그대로 넘어갑니다 — 공개하라고 있는 것입니다.
     * 개인키는 서버 밖으로 나가지 않습니다. 이것이 새면 남이 우리 이름으로
     * 알림을 보낼 수 있습니다.
     */
    public static Keys newKeys() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
            gen.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair pair = gen.generateKeyPair();

            ECPublicKey pub = (ECPublicKey) pair.getPublic();
            ECPrivateKey priv = (ECPrivateKey) pair.getPrivate();

            return new Keys(
                    b64(rawOf(pub)),
                    /* 개인키는 32바이트 정수 하나입니다. 앞에 부호 자리가
                       붙어 33바이트로 나오는 일이 있어 잘라 맞춥니다. */
                    b64(fixed(priv.getS().toByteArray(), 32)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("알림 열쇠를 만들지 못했습니다.", e);
        }
    }

    /* ------------------------------------------------------------- 봉하기 */

    /**
     * 이 기기만 열 수 있게 글을 봉합니다.
     *
     * @param p256dh 기기의 공개키(브라우저가 준 것, base64url)
     * @param auth   기기의 비밀 한 조각(브라우저가 준 것, base64url)
     */
    public static byte[] seal(String p256dh, String auth, String text) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        return seal(p256dh, auth, text, salt, null);
    }

    /**
     * 소금과 임시 열쇠를 밖에서 넣을 수 있는 판.
     *
     * <p>시험에서만 씁니다. 봉하는 일은 매번 다른 난수를 쓰는 것이 핵심이라
     * 결과를 견줘 볼 수가 없는데, 그 난수를 정해 주면 견줄 수 있습니다.
     */
    static byte[] seal(String p256dh, String auth, String text, byte[] salt, KeyPair given) {
        try {
            byte[] uaPublicRaw = unb64(p256dh);
            byte[] authSecret = unb64(auth);
            ECPublicKey uaPublic = publicFrom(uaPublicRaw);

            /* 알림 하나마다 새로 만듭니다. 같은 것을 두 번 쓰면 두 알림을
               견줘 내용을 짐작할 수 있게 됩니다. */
            KeyPair ephemeral = given;
            if (ephemeral == null) {
                KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
                gen.initialize(new ECGenParameterSpec("secp256r1"));
                ephemeral = gen.generateKeyPair();
            }
            byte[] asPublicRaw = rawOf((ECPublicKey) ephemeral.getPublic());

            KeyAgreement ecdh = KeyAgreement.getInstance("ECDH");
            ecdh.init(ephemeral.getPrivate());
            ecdh.doPhase(uaPublic, true);
            byte[] shared = ecdh.generateSecret();

            /* "WebPush: info" + 0 + 기기공개키 + 우리임시공개키 */
            ByteArrayOutputStream keyInfo = new ByteArrayOutputStream();
            keyInfo.writeBytes("WebPush: info".getBytes(StandardCharsets.US_ASCII));
            keyInfo.write(0);
            keyInfo.writeBytes(uaPublicRaw);
            keyInfo.writeBytes(asPublicRaw);

            byte[] ikm = hkdf(authSecret, shared, keyInfo.toByteArray(), 32);
            byte[] prk = extract(salt, ikm);
            byte[] cek = expand(prk, info("Content-Encoding: aes128gcm"), 16);
            byte[] nonce = expand(prk, info("Content-Encoding: nonce"), 12);

            /* 글 끝에 2 하나를 붙입니다. "여기서 끝" 이라는 표시이고,
               표준이 이렇게 정해 두었습니다. */
            byte[] plain = text.getBytes(StandardCharsets.UTF_8);
            byte[] padded = Arrays.copyOf(plain, plain.length + 1);
            padded[plain.length] = 2;

            Cipher gcm = Cipher.getInstance("AES/GCM/NoPadding");
            gcm.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"),
                    new GCMParameterSpec(128, nonce));
            byte[] sealed = gcm.doFinal(padded);

            /*
              봉투의 겉면(RFC 8188).

                소금 16 | 한 번에 받는 크기 4 | 열쇠 길이 1 | 우리 임시 공개키 65 | 봉한 글
             */
            ByteBuffer body = ByteBuffer.allocate(16 + 4 + 1 + RAW_KEY_LEN + sealed.length);
            body.put(salt);
            body.putInt(RECORD_SIZE);
            body.put((byte) RAW_KEY_LEN);
            body.put(asPublicRaw);
            body.put(sealed);

            return body.array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("알림을 봉하지 못했습니다.", e);
        }
    }

    /**
     * 봉한 것을 다시 엽니다.
     *
     * <p>서버가 쓸 일은 없습니다 — 브라우저가 하는 일입니다. 시험에서 우리가
     * 봉한 것이 표준대로인지 확인하는 데만 씁니다.
     */
    static String open(byte[] body, String uaPrivateB64, String uaPublicB64, String authB64) {
        try {
            ByteBuffer in = ByteBuffer.wrap(body);
            byte[] salt = new byte[16];
            in.get(salt);
            in.getInt();
            int keyLen = in.get() & 0xff;
            byte[] asPublicRaw = new byte[keyLen];
            in.get(asPublicRaw);
            byte[] sealed = new byte[in.remaining()];
            in.get(sealed);

            KeyAgreement ecdh = KeyAgreement.getInstance("ECDH");
            ecdh.init(privateFrom(unb64(uaPrivateB64)));
            ecdh.doPhase(publicFrom(asPublicRaw), true);
            byte[] shared = ecdh.generateSecret();

            ByteArrayOutputStream keyInfo = new ByteArrayOutputStream();
            keyInfo.writeBytes("WebPush: info".getBytes(StandardCharsets.US_ASCII));
            keyInfo.write(0);
            keyInfo.writeBytes(unb64(uaPublicB64));
            keyInfo.writeBytes(asPublicRaw);

            byte[] ikm = hkdf(unb64(authB64), shared, keyInfo.toByteArray(), 32);
            byte[] prk = extract(salt, ikm);
            byte[] cek = expand(prk, info("Content-Encoding: aes128gcm"), 16);
            byte[] nonce = expand(prk, info("Content-Encoding: nonce"), 12);

            Cipher gcm = Cipher.getInstance("AES/GCM/NoPadding");
            gcm.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"),
                    new GCMParameterSpec(128, nonce));
            byte[] padded = gcm.doFinal(sealed);

            /* 뒤에 붙은 0 들을 걷고, 그 앞의 끝 표시 하나도 뗍니다. */
            int end = padded.length;
            while (end > 0 && padded[end - 1] == 0) {
                end--;
            }
            return new String(padded, 0, Math.max(0, end - 1), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("알림을 열지 못했습니다.", e);
        }
    }

    /* --------------------------------------------------------------- 서명 */

    /**
     * "우리가 보낸 것" 이라는 표(VAPID).
     *
     * <p>중계 서버가 이것을 보고 우리를 알아봅니다. 12시간짜리로 만듭니다 —
     * 표준이 24시간까지 허용하지만, 시계가 조금 어긋난 서버에서 거절당하지
     * 않게 여유를 둡니다.
     *
     * @param audience 중계 서버의 주소(스킴 + 호스트). 이것이 어긋나면 거절합니다.
     * @param subject  문제가 생겼을 때 연락할 곳. mailto: 나 https: 로 시작해야 합니다.
     */
    public static String token(String audience, String subject, String privateKeyB64, long nowSeconds) {
        try {
            ECPrivateKey priv = privateFrom(unb64(privateKeyB64));

            String header = b64(jsonHeader().getBytes(StandardCharsets.UTF_8));
            String claims = b64(jsonClaims(audience, subject, nowSeconds + 43200)
                    .getBytes(StandardCharsets.UTF_8));
            byte[] signing = (header + "." + claims).getBytes(StandardCharsets.US_ASCII);

            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initSign(priv);
            sig.update(signing);

            /*
              자바는 서명을 DER 로 내놓는데(길이가 그때그때 다릅니다), JWT 는
              r 과 s 를 32바이트씩 그냥 이어 붙인 것을 요구합니다. 바꿔 줘야
              중계 서버가 받습니다.
             */
            return header + "." + claims + "." + b64(joseOf(sig.sign()));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("알림 표를 만들지 못했습니다.", e);
        }
    }

    private static String jsonHeader() {
        return "{\"typ\":\"JWT\",\"alg\":\"ES256\"}";
    }

    private static String jsonClaims(String audience, String subject, long exp) {
        return "{\"aud\":\"" + audience + "\",\"exp\":" + exp + ",\"sub\":\"" + subject + "\"}";
    }

    /* --------------------------------------------------------------- 조각 */

    /** HKDF — 뽑아내고(extract) 펼치기(expand)를 한 번에. */
    static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) {
        return expand(extract(salt, ikm), info, length);
    }

    /** 재료를 고른 32바이트로 뽑아냅니다. */
    static byte[] extract(byte[] salt, byte[] ikm) {
        return hmac(salt, ikm);
    }

    /**
     * 뽑아 둔 것을 원하는 길이로 펼칩니다.
     *
     * <p>우리가 쓰는 길이는 모두 32바이트 이하라 한 번만 돌면 됩니다. 그
     * 이상을 부르면 표준에 맞지 않는 것을 조용히 내놓는 대신 막습니다.
     */
    static byte[] expand(byte[] prk, byte[] info, int length) {
        if (length > 32) {
            throw new IllegalArgumentException("한 번에 32바이트까지만 펼칩니다.");
        }
        byte[] input = Arrays.copyOf(info, info.length + 1);
        input[info.length] = 1;
        return Arrays.copyOf(hmac(prk, input), length);
    }

    private static byte[] hmac(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** "설명" 문자열 뒤에 0 하나. 표준이 그렇게 씁니다. */
    private static byte[] info(String label) {
        byte[] raw = label.getBytes(StandardCharsets.US_ASCII);
        return Arrays.copyOf(raw, raw.length + 1);
    }

    /** DER 서명을 r 과 s 를 이어 붙인 모양으로. */
    static byte[] joseOf(byte[] der) {
        /* 0x30 길이 0x02 r길이 r 0x02 s길이 s */
        int at = 3;
        int rLen = der[at++];
        byte[] r = Arrays.copyOfRange(der, at, at + rLen);
        at += rLen + 1;
        int sLen = der[at++];
        byte[] s = Arrays.copyOfRange(der, at, at + sLen);

        byte[] out = new byte[64];
        System.arraycopy(fixed(r, 32), 0, out, 0, 32);
        System.arraycopy(fixed(s, 32), 0, out, 32, 32);
        return out;
    }

    /** 앞의 0 을 떼거나 0 을 채워 길이를 맞춥니다. */
    static byte[] fixed(byte[] raw, int length) {
        if (raw.length == length) {
            return raw;
        }
        if (raw.length > length) {
            return Arrays.copyOfRange(raw, raw.length - length, raw.length);
        }
        byte[] out = new byte[length];
        System.arraycopy(raw, 0, out, length - raw.length, raw.length);
        return out;
    }

    /** 65바이트 날것을 자바가 아는 공개키로. */
    static ECPublicKey publicFrom(byte[] raw) throws GeneralSecurityException {
        if (raw.length != RAW_KEY_LEN || raw[0] != 4) {
            throw new InvalidKeyException("공개키 모양이 아닙니다.");
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(raw, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(raw, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC")
                .generatePublic(new ECPublicKeySpec(new ECPoint(x, y), params()));
    }

    /** 32바이트 날것을 자바가 아는 개인키로. */
    static ECPrivateKey privateFrom(byte[] raw) throws GeneralSecurityException {
        return (ECPrivateKey) KeyFactory.getInstance("EC")
                .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, raw), params()));
    }

    /** 65바이트 날것으로. */
    static byte[] rawOf(ECPublicKey key) {
        ECPoint point = key.getW();
        byte[] out = new byte[RAW_KEY_LEN];
        out[0] = 4;
        System.arraycopy(fixed(point.getAffineX().toByteArray(), 32), 0, out, 1, 32);
        System.arraycopy(fixed(point.getAffineY().toByteArray(), 32), 0, out, 33, 32);
        return out;
    }

    /**
     * P-256 의 생김새.
     *
     * <p>자바에는 "이름으로 곡선 값을 꺼내라" 는 곧은 길이 없어서, 열쇠를
     * 하나 만들어 그 안에 든 것을 꺼내 씁니다. 한 번 만들어 두고 계속 씁니다.
     */
    private static ECParameterSpec cached;

    static synchronized ECParameterSpec params() throws GeneralSecurityException {
        if (cached == null) {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
            gen.initialize(new ECGenParameterSpec("secp256r1"));
            cached = ((ECPublicKey) gen.generateKeyPair().getPublic()).getParams();
        }
        return cached;
    }

    public static String b64(byte[] raw) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }

    public static byte[] unb64(String raw) {
        /* 브라우저는 = 를 떼고 주는데, 붙여 주는 것도 있습니다. 둘 다 받습니다. */
        return Base64.getUrlDecoder().decode(raw.replace("=", ""));
    }
}
