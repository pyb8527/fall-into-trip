package net.weeniebeenie.fit.group.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** 모임에 속한 한 사람. */
@Entity
@Table(name = "group_members")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GroupMember {

    @EmbeddedId
    private GroupMemberId id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private GroupRole role = GroupRole.MEMBER;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt = Instant.now();

    public GroupMember(String groupId, String userId, GroupRole role) {
        this.id = new GroupMemberId(groupId, userId);
        this.role = role == null ? GroupRole.MEMBER : role;
        this.joinedAt = Instant.now();
    }
}
