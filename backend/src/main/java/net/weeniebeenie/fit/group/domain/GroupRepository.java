package net.weeniebeenie.fit.group.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GroupRepository extends JpaRepository<Group, String> {

    /** 내가 속한 모임들. 최근에 만든 것부터. */
    @Query("""
           SELECT g FROM Group g
           WHERE g.id IN (SELECT m.id.groupId FROM GroupMember m WHERE m.id.userId = :userId)
           ORDER BY g.createdAt DESC
           """)
    List<Group> findAllOfUser(@Param("userId") String userId);
}
