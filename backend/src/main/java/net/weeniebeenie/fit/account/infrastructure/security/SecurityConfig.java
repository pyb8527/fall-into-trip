package net.weeniebeenie.fit.account.infrastructure.security;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.JwtAuthenticationFilter;
import net.weeniebeenie.fit.account.infrastructure.security.JwtProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * 보안 설정.
 *
 * <ul>
 *   <li>세션을 쓰지 않습니다. 인증은 액세스 토큰(Authorization 헤더)으로만 합니다.</li>
 *   <li>리프레시 토큰만 쿠키로 오가며, 그 쿠키는 {@code /api/auth/**} 밖으로는
 *       쓰이지 않습니다.</li>
 *   <li>세부 권한(여행 편집 권한 등)은 서비스 계층에서 확인합니다. 여기서는
 *       "로그인했는가 / 관리자인가" 까지만 봅니다.</li>
 * </ul>
 */
@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(JwtProperties.class)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final CorsProperties corsProperties;

    @Bean
    public PasswordEncoder passwordEncoder() {
        /* 12 라운드. 이 서버에서 검증 한 번에 약 200ms 로, 온라인 대입을 충분히 억제합니다. */
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())   // 토큰 인증이라 CSRF 토큰이 필요 없습니다
                .cors(cors -> cors.configurationSource(corsSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(f -> f.disable())
                .httpBasic(b -> b.disable())
                .headers(h -> h
                        .frameOptions(f -> f.deny())
                        .referrerPolicy(r -> r.policy(
                                org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter
                                        .ReferrerPolicy.SAME_ORIGIN)))
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/api/health",
                                "/api/auth/state",
                                "/api/auth/setup",
                                "/api/auth/register",
                                "/api/auth/login",
                                "/api/auth/refresh",
                                "/api/auth/logout").permitAll()
                        /* 링크를 받은 사람이 가입 전에도 어떤 여행인지 볼 수 있게 합니다.
                           참여 자체는 로그인해야 합니다. */
                        .requestMatchers(HttpMethod.GET, "/api/invites/*/preview").permitAll()
                        /* 게시판은 구경부터 됩니다. 남의 일정을 보러 왔다가
                           가입하는 흐름이라, 처음부터 로그인을 요구하면 아무도
                           들어오지 않습니다. 추천·복제·신고는 POST 라 아래
                           규칙에 걸려 로그인이 필요합니다. */
                        /* 내 글 목록만은 누구 것인지 알아야 하므로 로그인이
                           필요합니다. 아래 공개 규칙보다 먼저 걸어야 합니다. */
                        /* 팁 읽기는 로그인 없이도 됩니다. 남기거나 신고할 때만
                           로그인을 부릅니다(POST 라 아래 규칙에 걸립니다). */
                        .requestMatchers(HttpMethod.GET, "/api/places/*/tips").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/*/comments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/*/map").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/mine").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/posts", "/api/posts/*").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> {
                            res.setStatus(401);
                            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            res.setCharacterEncoding("UTF-8");
                            res.getWriter().write("{\"error\":\"로그인이 필요합니다.\"}");
                        })
                        .accessDeniedHandler((req, res, ex) -> {
                            res.setStatus(403);
                            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            res.setCharacterEncoding("UTF-8");
                            res.getWriter().write("{\"error\":\"권한이 없습니다.\"}");
                        }))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private CorsConfigurationSource corsSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(corsProperties.getAllowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        /* 리프레시 쿠키가 오가야 하므로 자격 증명을 허용합니다.
           그래서 Origin 은 * 로 둘 수 없고 목록으로 지정합니다. */
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
