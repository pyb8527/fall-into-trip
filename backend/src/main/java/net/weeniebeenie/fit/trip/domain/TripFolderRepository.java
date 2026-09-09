package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TripFolderRepository extends JpaRepository<TripFolder, String> {

    List<TripFolder> findAllByUserIdOrderBySortAscCreatedAtAsc(String userId);

    Optional<TripFolder> findByUserIdAndName(String userId, String name);

    long countByUserId(String userId);
}
