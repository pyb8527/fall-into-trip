package net.weeniebeenie.fit.safety.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProfileReportRepository extends JpaRepository<ProfileReport, ProfileReport.Key> {

    boolean existsByUserIdAndReporterId(String userId, String reporterId);

    long countByUserId(String userId);

    List<ProfileReport> findAllByUserIdOrderByCreatedAtDesc(String userId);

    /**
     * 운영자가 봐야 할 사람 — 신고가 하나라도 들어온 사람.
     *
     * <p>많이 받은 사람이 위입니다. 세 건이 넘어 소개와 사진이 감춰진 사람이
     * 먼저 보여야 합니다.
     *
     * @return [사람 번호, 신고 수, 마지막 신고 때]
     */
    @Query(value = """
           SELECT r.userId, count(r), max(r.createdAt) FROM ProfileReport r
           GROUP BY r.userId
           ORDER BY count(r) DESC, max(r.createdAt) DESC
           """,
           countQuery = "SELECT count(DISTINCT r.userId) FROM ProfileReport r")
    Page<Object[]> needingReview(Pageable pageable);

    @Modifying
    @Query("DELETE FROM ProfileReport r WHERE r.userId = :userId")
    int deleteAllOf(@Param("userId") String userId);
}
