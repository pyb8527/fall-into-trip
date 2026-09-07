package net.weeniebeenie.fit.account.domain;

import net.weeniebeenie.fit.account.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** 탈취가 보이면 그 로그인에서 파생된 토큰을 통째로 끊습니다. */
    @Modifying
    @Query("UPDATE RefreshToken t SET t.revokedAt = :at WHERE t.familyId = :familyId AND t.revokedAt IS NULL")
    int revokeFamily(@Param("familyId") String familyId, @Param("at") Instant at);

    /** 비밀번호 변경·계정 정지처럼 전 기기를 내보내야 할 때. */
    @Modifying
    @Query("UPDATE RefreshToken t SET t.revokedAt = :at WHERE t.userId = :userId AND t.revokedAt IS NULL")
    int revokeAllOfUser(@Param("userId") String userId, @Param("at") Instant at);

    @Modifying
    @Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :at")
    int deleteExpired(@Param("at") Instant at);
}
