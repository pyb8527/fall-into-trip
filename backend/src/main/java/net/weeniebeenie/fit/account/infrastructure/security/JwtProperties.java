package net.weeniebeenie.fit.account.infrastructure.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Getter
@Setter
@ConfigurationProperties(prefix = "fit.jwt")
public class JwtProperties {

    /** HS256 서명 키. 최소 32바이트여야 하며 운영에서는 환경변수로 넣습니다. */
    private String secret;

    /** 액세스 토큰 수명. 짧게 두고 리프레시로 갱신합니다. */
    private Duration accessTtl = Duration.ofMinutes(15);

    /** 리프레시 토큰 수명. */
    private Duration refreshTtl = Duration.ofDays(30);

    /** 리프레시 쿠키에 Secure 를 붙일지. HTTPS 뒤에서는 반드시 true. */
    private boolean secureCookie = true;

    private String issuer = "fit";
}
