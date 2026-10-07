package net.weeniebeenie.fit.safety.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserBlockRepository extends JpaRepository<UserBlock, UserBlock.Key> {

    boolean existsByBlockerIdAndBlockedId(String blockerId, String blockedId);

    /** 내가 막은 사람들. 최근에 막은 사람이 위입니다. */
    List<UserBlock> findAllByBlockerIdOrderByCreatedAtDesc(String blockerId);

    /** 나를 막은 사람들. 거르는 데만 씁니다 — 화면에 내지 않습니다. */
    List<UserBlock> findAllByBlockedId(String blockedId);
}
