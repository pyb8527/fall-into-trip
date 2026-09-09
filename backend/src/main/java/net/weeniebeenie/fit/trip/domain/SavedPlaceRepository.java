package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedPlaceRepository extends JpaRepository<SavedPlace, String> {

    List<SavedPlace> findAllByUserIdOrderByCreatedAtDesc(String userId);

    Optional<SavedPlace> findByUserIdAndPlaceId(String userId, String placeId);

    List<SavedPlace> findAllByUserIdAndIdIn(String userId, List<String> ids);

    long countByUserId(String userId);
}
