package net.weeniebeenie.fit.account.domain;

import net.weeniebeenie.fit.account.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {

    /* 이메일은 대소문자를 가리지 않습니다. 인덱스도 lower(email) 로 걸려 있습니다. */
    @Query("SELECT u FROM User u WHERE lower(u.email) = lower(:email)")
    Optional<User> findByEmail(@Param("email") String email);

    @Query("SELECT count(u) > 0 FROM User u WHERE lower(u.email) = lower(:email)")
    boolean existsByEmail(@Param("email") String email);

    List<User> findAllByOrderByCreatedAtAsc();

    long countByRoleAndDisabledFalse(Role role);
}
