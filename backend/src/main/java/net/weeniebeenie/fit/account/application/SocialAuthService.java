package net.weeniebeenie.fit.account.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserIdentity;
import net.weeniebeenie.fit.account.domain.UserIdentityRepository;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.SocialTokens;
import net.weeniebeenie.fit.shared.domain.Email;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 구글로 로그인하기.
 *
 * <h3>왜 있나</h3>
 *
 * <p>가입하려면 이메일과 <b>새 비밀번호</b>를 만들어야 했습니다. 여행 한 번
 * 같이 가자고 부른 사람에게 그것부터 시키고 있었습니다.
 *
 * <h3>이메일로 사람을 찾지 않습니다</h3>
 *
 * <p>열쇠는 {@code (provider, subject)} 입니다. 사람은 구글에서 이메일을
 * 바꿀 수 있지만 {@code subject} 는 안 바뀝니다.
 *
 * <h3>가장 조심하는 자리 — 이미 있는 이메일</h3>
 *
 * <p><b>이 앱은 가입할 때 이메일을 한 번도 확인하지 않습니다</b>
 * ({@link AuthService#register}). 그래서 "이메일이 같으면 잇는다" 를 그냥
 * 두면 이런 길이 열립니다.
 *
 * <ol>
 *   <li>남이 내 이메일로 비밀번호 계정을 먼저 만들어 둡니다. 확인 절차가
 *       없으니 됩니다</li>
 *   <li>내가 구글로 로그인합니다</li>
 *   <li>이메일이 같으니 그 계정으로 들어갑니다 — <b>남의 계정 안입니다</b></li>
 * </ol>
 *
 * <p>자동으로 잇는 것은 곧 <b>그 계정으로 로그인시켜 주는 것</b>이라, 그대로
 * 계정 탈취가 됩니다. 그래서 비밀번호가 있는 계정에는 <b>안 잇고</b> 되돌려
 * 보냅니다 — 로그인한 뒤 설정에서 직접 잇게 합니다.
 */
@Service
@RequiredArgsConstructor
public class SocialAuthService {

    private final UserRepository users;
    private final UserIdentityRepository identities;
    private final SocialTokens tokens;
    private final AuditService audit;

    /**
     * 들어옵니다. 없으면 만들고, 이을 수 있으면 잇고, 아니면 되돌려 보냅니다.
     */
    @Transactional
    public User signIn(String credential) {
        SocialTokens.Person who = tokens.readGoogle(credential);

        /* 1. 이미 아는 사람. 여기서 이메일은 안 봅니다 — 그쪽에서 주소를
              바꿨어도 같은 사람입니다. */
        UserIdentity known = identities.findByProviderAndSubject(who.provider(), who.subject())
                .orElse(null);
        if (known != null) {
            User user = users.findById(known.getUserId())
                    .orElseThrow(() -> ApiException.unauthorized("계정을 찾을 수 없습니다."));
            if (user.isDisabled()) {
                throw ApiException.unauthorized("사용할 수 없는 계정입니다.");
            }
            user.setLastLoginAt(Instant.now());
            audit.log(user.getId(), "login.google", user.getId());
            return user;
        }

        String email = Email.of(who.email()).value();
        User byEmail = users.findByEmail(email).orElse(null);

        /* 2. 처음 보는 사람. 비밀번호 없이 만듭니다. */
        if (byEmail == null) {
            User made = users.save(User.builder()
                    .email(email)
                    .name(nameOf(who))
                    .passwordHash(null)
                    .role(Role.MEMBER)
                    .build());
            identities.save(new UserIdentity(who.provider(), who.subject(), made.getId(), email));
            made.setLastLoginAt(Instant.now());
            audit.log(made.getId(), "user.register.google", made.getId(), Map.of("email", email));
            return made;
        }

        /* 3. 그 주소의 계정이 이미 있습니다.

              비밀번호가 있으면 안 잇습니다. 확인 안 된 주소로 만들어진
              계정일 수 있고, 그러면 잇는 순간 남의 계정에 들여보내는
              것이 됩니다.

              비밀번호가 없는 계정은 소셜로만 만들어진 것이라 선점할
              방법이 없습니다. 그때는 잇습니다 — 애플로 먼저 들어왔던
              사람이 구글로 들어오는 경우가 여기입니다. */
        if (byEmail.hasPassword()) {
            throw ApiException.conflict(
                    "이미 가입된 주소입니다. 비밀번호로 로그인한 뒤 설정에서 구글을 이어 주세요.");
        }
        if (byEmail.isDisabled()) {
            throw ApiException.unauthorized("사용할 수 없는 계정입니다.");
        }
        identities.save(new UserIdentity(who.provider(), who.subject(), byEmail.getId(), email));
        byEmail.setLastLoginAt(Instant.now());
        audit.log(byEmail.getId(), "identity.link.google", byEmail.getId());
        return byEmail;
    }

    /**
     * 로그인한 사람이 자기 계정에 구글을 잇습니다.
     *
     * <p>여기서는 이메일이 같은지 <b>안 봅니다.</b> 이미 로그인한 사람이
     * 자기 계정에 이으라고 한 것이라, 회사 주소로 가입해 두고 개인 구글을
     * 잇는 것이 이상한 일이 아닙니다.
     */
    @Transactional
    public void link(String userId, String credential) {
        SocialTokens.Person who = tokens.readGoogle(credential);

        identities.findByProviderAndSubject(who.provider(), who.subject()).ifPresent(already -> {
            if (already.getUserId().equals(userId)) {
                throw ApiException.badRequest("이미 이어 두었습니다.");
            }
            /* 남의 계정에 이어져 있습니다. 누구인지는 안 알려 줍니다. */
            throw ApiException.conflict("이 구글 계정은 다른 곳에 이어져 있습니다.");
        });
        if (identities.findByUserIdAndProvider(userId, who.provider()).isPresent()) {
            throw ApiException.badRequest("이미 다른 구글 계정을 이어 두었습니다. 먼저 끊어 주세요.");
        }
        identities.save(new UserIdentity(who.provider(), who.subject(), userId,
                Email.of(who.email()).value()));
        audit.log(userId, "identity.link.google", userId);
    }

    /**
     * 끊습니다.
     *
     * <p><b>끊고 나서 들어올 길이 없으면 거절합니다.</b> 비밀번호가 없고 이어
     * 둔 곳이 이것 하나뿐이면, 끊는 순간 자기 계정에서 잠깁니다.
     */
    @Transactional
    public void unlink(String userId, String provider) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("로그인이 필요합니다."));
        UserIdentity mine = identities.findByUserIdAndProvider(userId, provider)
                .orElseThrow(() -> ApiException.notFound("이어 둔 것이 없습니다."));

        if (!user.hasPassword() && identities.countByUserId(userId) <= 1) {
            throw ApiException.badRequest(
                    "이것을 끊으면 들어올 길이 없습니다. 먼저 비밀번호를 만들어 주세요.");
        }
        identities.delete(mine);
        audit.log(userId, "identity.unlink." + provider, userId);
    }

    /** 화면이 구글 단추를 낼지 정하는 데 씁니다. */
    public String clientId() {
        return tokens.clientId();
    }

    /** 설정 화면이 "무엇을 이어 두었는지" 를 보여 주는 데 씁니다. */
    @Transactional(readOnly = true)
    public List<String> providersOf(String userId) {
        return identities.findAllByUserId(userId).stream().map(UserIdentity::getProvider).toList();
    }

    /**
     * 이름.
     *
     * <p>구글이 안 주기도 합니다. 그때는 이메일의 앞부분을 씁니다 — 빈 이름을
     * 두면 동행자 목록에 아무것도 안 뜹니다. 사람이 설정에서 고칠 수 있습니다.
     */
    private static String nameOf(SocialTokens.Person who) {
        String given = who.name() == null ? "" : who.name().trim();
        if (!given.isEmpty()) {
            return given.length() > 80 ? given.substring(0, 80) : given;
        }
        String local = who.email().split("@", 2)[0];
        return local.isBlank() ? "여행자" : (local.length() > 80 ? local.substring(0, 80) : local);
    }
}
