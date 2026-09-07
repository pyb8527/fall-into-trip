package net.weeniebeenie.fit.account.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    long countByDisabledTrue();

    long countByRole(Role role);

    /**
     * 운영 화면의 계정 검색.
     *
     * 비어 있는 조건은 걸지 않습니다. 조건마다 메서드를 따로 두면 조합이
     * 늘어날수록 감당이 안 되므로 한 곳에서 받습니다. {@code q} 는 부르는
     * 쪽에서 소문자 + 양쪽 % 로 다듬어 넘깁니다.
     */
    @Query("""
           SELECT u FROM User u
           WHERE (:q IS NULL OR lower(u.email) LIKE :q OR lower(u.name) LIKE :q)
             AND (:role IS NULL OR u.role = :role)
             AND (:disabled IS NULL OR u.disabled = :disabled)
           """)
    Page<User> search(@Param("q") String q,
                      @Param("role") Role role,
                      @Param("disabled") Boolean disabled,
                      Pageable pageable);
}
