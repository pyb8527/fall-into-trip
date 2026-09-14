package net.weeniebeenie.fit.account.infrastructure.security;

import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 남이 발급한 로그인 토큰을 읽습니다.
 *
 * <h3>손으로 검증하지 않습니다</h3>
 *
 * <p>{@link NimbusJwtDecoder} 가 공개키 목록(JWKS)을 받아 캐시하고, 구글이
 * 키를 바꾸면 따라가고, 서명과 만료와 시계 오차를 봅니다. 이것을 손으로
 * 짜면 보안 구멍이 정확히 거기서 납니다. 키를 안 받아 두면 느리고, 받아
 * 두고 안 갱신하면 <b>구글이 키를 바꾸는 날 모두가 로그인에 실패</b>합니다.
 *
 * <p>우리가 얹는 것은 두 가지뿐입니다 — <b>누가 발급했는가</b>({@code iss})와
 * <b>우리에게 준 것인가</b>({@code aud}). 둘째를 안 보면 남의 앱에 발급된
 * 토큰으로 우리 계정에 들어옵니다.
 *
 * <h3>갈래가 늘어날 자리</h3>
 *
 * <p>애플이 올 때 {@code decoderFor} 에 갈래 한 줄이 늘고 나머지는 그대로입니다.
 * 주소와 {@code iss}·{@code aud} 만 다릅니다.
 */
@Component
public class SocialTokens {

    /** 이 저장소에서 쓰는 제공자 이름. {@code user_identities.provider} 에 그대로 들어갑니다. */
    public static final String GOOGLE = "google";

    private final Map<String, JwtDecoder> decoders = new ConcurrentHashMap<>();

    @Value("${fit.social.google.client-id:}")
    private String googleClientId;

    /**
     * 읽어 낸 사람.
     *
     * @param subject 그쪽에서의 번호. <b>이메일이 아니라 이것이 열쇠입니다</b>
     * @param email   그쪽이 알려 준 주소. 확인된 것만 옵니다
     */
    public record Person(String provider, String subject, String email, String name) {}

    /**
     * 화면에 내려보낼 클라이언트 ID. 꺼져 있으면 빈 값입니다.
     *
     * <p>비밀이 아닙니다 — 구글 단추를 그리는 데 브라우저가 알아야 하는
     * 값이고, 이것만으로는 아무것도 못 합니다. 진짜 확인은 서명입니다.
     */
    public String clientId() {
        return googleClientId == null ? "" : googleClientId;
    }

    public boolean enabled(String provider) {
        return GOOGLE.equals(provider) && googleClientId != null && !googleClientId.isBlank();
    }

    /**
     * 구글 ID 토큰을 읽습니다.
     *
     * <p>확인 안 된 이메일은 거절합니다. 회사 계정 중에 그런 것이 있는데,
     * 그것을 받으면 <b>주소의 주인이 아닌 사람</b>이 그 주소로 들어옵니다.
     */
    public Person readGoogle(String credential) {
        if (!enabled(GOOGLE)) {
            throw ApiException.badRequest("구글 로그인이 꺼져 있습니다.");
        }
        Jwt jwt = read(GOOGLE, credential);

        if (!Boolean.TRUE.equals(jwt.getClaim("email_verified"))) {
            throw ApiException.badRequest("구글에서 확인되지 않은 주소입니다. 다른 방법으로 로그인해 주세요.");
        }
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw ApiException.badRequest("구글이 이메일을 주지 않았습니다.");
        }
        return new Person(GOOGLE, jwt.getSubject(), email, jwt.getClaimAsString("name"));
    }

    private Jwt read(String provider, String credential) {
        if (credential == null || credential.isBlank()) {
            throw ApiException.badRequest("로그인 정보가 비어 있습니다.");
        }
        try {
            return decoders.computeIfAbsent(provider, this::decoderFor).decode(credential);
        } catch (JwtException e) {
            /*
              왜 틀렸는지는 밖으로 안 보냅니다.

              서명이 안 맞는지, 만료됐는지, 남의 앱 것인지를 알려 주면 그것이
              곧 찔러 보는 사람에게 주는 힌트가 됩니다. 로그인 실패 문구를
              뭉뚱그리는 것과 같은 이유입니다.
             */
            throw ApiException.badRequest("로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
        }
    }

    private JwtDecoder decoderFor(String provider) {
        if (!GOOGLE.equals(provider)) {
            throw ApiException.badRequest("모르는 로그인 방법입니다.");
        }
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                /* 발급자. 구글은 두 가지 모양을 다 씁니다. */
                issuedBy("accounts.google.com", "https://accounts.google.com"),
                /* 우리에게 준 것인가. 이것을 안 보면 남의 앱 토큰으로 들어옵니다. */
                audience(googleClientId),
                /* 만료와 시계 오차는 스프링이 기본으로 봅니다. */
                JwtValidators.createDefault()));
        return decoder;
    }

    private static OAuth2TokenValidator<Jwt> issuedBy(String... allowed) {
        List<String> ok = List.of(allowed);
        return jwt -> ok.contains(jwt.getIssuer() == null ? null : jwt.getIssuer().toString())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure();
    }

    private static OAuth2TokenValidator<Jwt> audience(String expected) {
        return jwt -> jwt.getAudience() != null && jwt.getAudience().contains(expected)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure();
    }
}
