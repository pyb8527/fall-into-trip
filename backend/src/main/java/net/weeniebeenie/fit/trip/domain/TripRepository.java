package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TripRepository extends JpaRepository<Trip, String> {

    List<Trip> findAllByOrderByCreatedAtAsc();

    Optional<Trip> findFirstByOrderByCreatedAtAsc();

    /* 계정을 지우기 전에 확인합니다. 주인이 있는 여행은 그냥 지울 수 없습니다. */
    long countByOwnerId(String ownerId);

    /* 목록 한 페이지를 그릴 때 씁니다. 줄마다 세면 스무 줄에 스무 번 물어보게 됩니다. */
    @Query("SELECT t.ownerId, count(t) FROM Trip t WHERE t.ownerId IN :ids GROUP BY t.ownerId")
    List<Object[]> countByOwnerIds(@Param("ids") Collection<String> ids);
}
