package net.weeniebeenie.fit.group.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, GroupMemberId> {

    List<GroupMember> findAllByIdGroupId(String groupId);

    List<GroupMember> findAllByIdUserId(String userId);

    Optional<GroupMember> findByIdGroupIdAndIdUserId(String groupId, String userId);

    void deleteByIdGroupIdAndIdUserId(String groupId, String userId);

    long countByIdGroupId(String groupId);

    long countByIdUserId(String userId);
}
