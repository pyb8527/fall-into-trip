package net.weeniebeenie.fit.photo.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PhotoRepository extends JpaRepository<Photo, String> {

    /** 이 사람이 올린 장 수. 한도를 볼 때 씁니다. */
    long countByOwnerId(String ownerId);
}
