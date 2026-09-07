package net.weeniebeenie.fit.support.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findAllByOrderByAtDesc(Pageable pageable);

    /**
     * 운영 화면의 감사 로그 검색.
     *
     * <p>기간은 [from, to) 로 봅니다. 끝을 포함하면 "10월 8일까지" 를 고를 때
     * 그날 00:00:00.000 한 순간만 걸려 하루가 통째로 빠집니다.
     *
     * <p>from·to 는 null 을 받지 않습니다. 부르는 쪽에서 열린 쪽 끝을
     * 넣어 줍니다. PostgreSQL 은 {@code ? IS NULL} 자리에만 나오는
     * 파라미터의 타입을 알아내지 못해서(문자열은 text 로 넘어가지만 시각은
     * 그렇지 못합니다) 조건을 그렇게 쓰면 실행할 때 터집니다.
     */
    @Query("""
           SELECT a FROM AuditLog a
           WHERE (:userId IS NULL OR a.userId = :userId)
             AND (:action IS NULL OR a.action = :action)
             AND (:target IS NULL OR a.target = :target)
             AND a.at >= :from
             AND a.at < :to
           """)
    Page<AuditLog> search(@Param("userId") String userId,
                          @Param("action") String action,
                          @Param("target") String target,
                          @Param("from") Instant from,
                          @Param("to") Instant to,
                          Pageable pageable);

    /** 필터 드롭다운을 채웁니다. 종류는 코드에 박힌 만큼만 늘어나므로 전부 읽어도 됩니다. */
    @Query("SELECT DISTINCT a.action FROM AuditLog a ORDER BY a.action")
    List<String> distinctActions();

    long countByAtAfter(Instant at);

    /** 최근 활동이 어디에 몰렸는지. [action, count] 순으로 많은 것부터 옵니다. */
    @Query("""
           SELECT a.action, count(a) FROM AuditLog a
           WHERE a.at >= :from
           GROUP BY a.action
           ORDER BY count(a) DESC
           """)
    List<Object[]> countByActionSince(@Param("from") Instant from, Pageable pageable);
}
