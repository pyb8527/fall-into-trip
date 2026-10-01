package net.weeniebeenie.fit.group.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupInviteRepository extends JpaRepository<GroupInvite, String> {

    Optional<GroupInvite> findByTokenHash(String tokenHash);

    List<GroupInvite> findAllByGroupIdOrderByCreatedAtDesc(String groupId);
}
