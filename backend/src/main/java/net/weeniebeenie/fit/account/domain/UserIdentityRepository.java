package net.weeniebeenie.fit.account.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, UserIdentity.Key> {

    Optional<UserIdentity> findByProviderAndSubject(String provider, String subject);

    /** 한 사람이 이어 둔 곳들. 설정 화면과 "끊으면 들어올 길이 없는지" 에 씁니다. */
    List<UserIdentity> findAllByUserId(String userId);

    Optional<UserIdentity> findByUserIdAndProvider(String userId, String provider);

    long countByUserId(String userId);
}
