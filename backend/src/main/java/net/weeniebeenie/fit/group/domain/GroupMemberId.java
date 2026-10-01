package net.weeniebeenie.fit.group.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class GroupMemberId implements Serializable {

    @Column(name = "group_id", length = 16)
    private String groupId;

    @Column(name = "user_id", length = 16)
    private String userId;
}
