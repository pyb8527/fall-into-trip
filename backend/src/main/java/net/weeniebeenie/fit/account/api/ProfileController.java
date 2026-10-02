package net.weeniebeenie.fit.account.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.application.ProfileService;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지가 묻는 길.
 *
 * <p>둘이지만 하는 일은 같습니다 — {@code /api/me/profile} 은 내 것,
 * {@code /api/users/{id}/profile} 은 남의 것입니다. 길을 가른 까닭은
 * <b>내 것에는 번호가 필요 없다</b>는 것뿐입니다. 화면이 제 번호를 알아야
 * 제 프로필을 볼 수 있으면, 그 번호를 어디선가 먼저 받아 와야 합니다.
 */
@RestController
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profiles;

    @GetMapping("/api/me/profile")
    public ProfileService.Profile mine(@CurrentUser AuthPrincipal me) {
        return profiles.of(me, null);
    }

    /**
     * 이름·한 줄 소개·얼굴 사진. 늘 제 것만 고칩니다.
     *
     * <p>안 보낸 칸은 그대로 둡니다. 지우는 것은 빈 글("")입니다 — 얼굴
     * 사진도 같습니다(규칙은 {@link ProfileService#edit}).
     */
    @PatchMapping("/api/me/profile")
    public ProfileService.Profile edit(@CurrentUser AuthPrincipal me, @RequestBody EditBody body) {
        return profiles.edit(me,
                body == null ? null : body.name(),
                body == null ? null : body.bio(),
                body == null ? null : body.photoId());
    }

    /**
     * @param photoId 올릴 얼굴 사진의 번호. <b>내가 올린 사진이어야</b> 합니다 —
     *                안 보면 남의 사진을 제 얼굴에 박아 넣을 수 있습니다
     */
    public record EditBody(String name, String bio, String photoId) {
    }

    @GetMapping("/api/users/{userId}/profile")
    public ProfileService.Profile of(@CurrentUser AuthPrincipal me, @PathVariable String userId) {
        return profiles.of(me, userId);
    }
}
