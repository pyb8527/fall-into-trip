package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TripFolderItemRepository extends JpaRepository<TripFolderItem, TripFolderItem.Key> {

    List<TripFolderItem> findAllByUserId(String userId);

    void deleteByUserIdAndTripId(String userId, String tripId);

    long countByFolderId(String folderId);
}
