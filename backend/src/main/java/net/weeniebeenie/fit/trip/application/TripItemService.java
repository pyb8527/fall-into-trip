package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 챙길 것.
 *
 * <p>여권, 어댑터, 약, 우산. 떠나기 전에 서로 "그거 챙겼어?" 를 몇 번씩 묻게
 * 되는 것들입니다.
 *
 * <p>누가 챙길지를 함께 적습니다. 그것이 없으면 목록이 "각자 알아서" 가 되고,
 * 그러면 어댑터가 셋이거나 없거나 둘 중 하나가 됩니다.
 *
 * <p>체크는 동행자 누구나 할 수 있습니다. 맡은 사람만 체크하게 하면 "내 것
 * 체크 좀 해 줘" 를 부탁하게 됩니다.
 */
@Service
@RequiredArgsConstructor
public class TripItemService {

    /** 한 여행에 적을 수 있는 개수. 이보다 많으면 목록이 아니라 창고입니다. */
    private static final int MAX_PER_TRIP = 100;

    private final TripItemRepository items;
    private final TripMemberRepository members;
    private final UserRepository users;
    private final TripAccessPolicy access;

    @Transactional(readOnly = true)
    public List<View> listOf(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());
        Map<String, String> names = namesOf(tripId);
        return items.findAllByTripIdOrderBySortAscCreatedAtAsc(tripId).stream()
                .map(i -> new View(i.getId(), i.getName(), i.getOwnerId(),
                        i.getOwnerId() == null ? null : names.get(i.getOwnerId()), i.isDone()))
                .toList();
    }

    @Transactional
    public TripItem add(AuthPrincipal me, String tripId, String name, String ownerId) {
        access.requireCanEdit(tripId, me.id());

        if (items.countByTripId(tripId) >= MAX_PER_TRIP) {
            throw ApiException.badRequest("챙길 것을 " + MAX_PER_TRIP + "개까지 적을 수 있습니다.");
        }

        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("무엇을 챙길지 적어 주세요.");
        }
        if (clean.length() > 80) {
            clean = clean.substring(0, 80);
        }

        return items.save(TripItem.builder()
                .tripId(tripId)
                .name(clean)
                .ownerId(ownerOf(tripId, ownerId))
                .sort((int) items.countByTripId(tripId))
                .createdBy(me.id())
                .build());
    }

    /**
     * 체크하거나, 맡은 사람을 바꾸거나.
     *
     * <p>비운 칸은 건드리지 않습니다 — null 은 "손대지 마라" 입니다. 맡은
     * 사람을 지우려면 빈 문자열을 보냅니다.
     */
    @Transactional
    public void update(AuthPrincipal me, String itemId, Boolean done, String ownerId) {
        TripItem item = items.findById(itemId)
                .orElseThrow(() -> ApiException.notFound("그런 것이 없습니다."));
        access.requireCanEdit(item.getTripId(), me.id());

        if (done != null) {
            item.setDone(done);
        }
        if (ownerId != null) {
            item.setOwnerId(ownerId.isBlank() ? null : ownerOf(item.getTripId(), ownerId));
        }
    }

    @Transactional
    public void delete(AuthPrincipal me, String itemId) {
        TripItem item = items.findById(itemId)
                .orElseThrow(() -> ApiException.notFound("그런 것이 없습니다."));
        access.requireCanEdit(item.getTripId(), me.id());
        items.delete(item);
    }

    /** 동행자가 맞는지. 아니면 아무도 안 맡은 것으로 둡니다. */
    private String ownerOf(String tripId, String ownerId) {
        if (ownerId == null || ownerId.isBlank()) {
            return null;
        }
        boolean member = members.findAllByIdTripId(tripId).stream()
                .anyMatch(m -> m.getId().getUserId().equals(ownerId));
        if (!member) {
            throw ApiException.badRequest("이 여행의 동행자가 아닙니다.");
        }
        return ownerId;
    }

    private Map<String, String> namesOf(String tripId) {
        Map<String, String> out = new LinkedHashMap<>();
        members.findAllByIdTripId(tripId).forEach(m -> users.findById(m.getId().getUserId())
                .ifPresent(u -> out.put(u.getId(), u.getName())));
        return out;
    }

    /** @param ownerName 맡은 사람의 이름. 아무도 안 맡았으면 비어 있습니다. */
    public record View(String id, String name, String ownerId, String ownerName, boolean done) {
    }
}
