package net.weeniebeenie.fit.support.push;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, String> {

    List<PushSubscription> findAllByUserId(String userId);

    List<PushSubscription> findAllByUserIdIn(List<String> userIds);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    long countByUserId(String userId);
}
