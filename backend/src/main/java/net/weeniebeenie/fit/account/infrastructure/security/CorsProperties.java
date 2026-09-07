package net.weeniebeenie.fit.account.infrastructure.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 리프레시 쿠키를 주고받으려면 자격 증명을 허용해야 하고, 그러면 Origin 을
 * * 로 둘 수 없습니다. 그래서 허용할 곳을 명시적으로 적습니다.
 */
@Component
@ConfigurationProperties(prefix = "fit.cors")
@Getter
@Setter
public class CorsProperties {

    private List<String> allowedOrigins = List.of("http://localhost:5173");
}
