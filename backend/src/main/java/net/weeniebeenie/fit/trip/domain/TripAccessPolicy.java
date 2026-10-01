package net.weeniebeenie.fit.trip.domain;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.group.domain.GroupMember;
import net.weeniebeenie.fit.group.domain.GroupMemberRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 이 여행에 손댈 수 있는가, 그리고 이 여행의 사람들은 누구인가.
 *
 * <h3>멤버 표가 하나가 되었습니다</h3>
 *
 * <p>여행마다 사람을 따로 불렀습니다(trip_members). 그래서 「여행 멤버」와
 * 「그룹 멤버」 둘이 생길 뻔했고, 그러면 묻는 자리마다 <b>두 갈래</b>를 봐야
 * 했습니다 — 이 저장소에서 그 질문이 지나가는 자리가 마흔 군데가 넘습니다.
 *
 * <p>여행 멤버를 없애고 그룹으로 합쳤습니다. 규칙이 한 줄이 됩니다.
 *
 * <pre>
 *   내 여행이다        = 내가 만들었다
 *                     OR (그룹 여행이고) 그 그룹의 멤버다
 * </pre>
 *
 * <p>보는 것과 고치는 것을 안 가릅니다. 모임에 구경꾼을 두는 것은 앞뒤가
 * 안 맞습니다 — 보여 주기만 하려면 여행기를 올려 링크를 주면 되고, 그쪽이
 * 그 일을 하는 자리입니다.
 *
 * <h3>없으면 404 입니다</h3>
 *
 * <p>403 으로 답하면 "있긴 있는데 못 본다" 가 되어, id 를 바꿔 가며 어떤
 * 여행이 존재하는지 알아낼 수 있습니다.
 *
 * <h3>「이 여행의 사람들」도 여기서 답합니다</h3>
 *
 * <p>가계부·챙길 것·후보 투표·알림이 저마다 멤버 표를 뒤지고 있었습니다.
 * 규칙이 바뀌면 그 자리들이 따로따로 틀립니다. {@link #peopleOf} 하나로
 * 모읍니다.
 */
@Component
@RequiredArgsConstructor
public class TripAccessPolicy {

    private final TripRepository trips;
    private final GroupMemberRepository groupMembers;

    /** 볼 수 있는가. 못 보면 404. */
    public void requireCanRead(String tripId, String userId) {
        mine(tripId, userId);
    }

    /**
     * 고칠 수 있는가.
     *
     * <p>보는 것과 같습니다. 볼 수 있으면 고칠 수 있습니다 — 「보기만」을
     * 없앴습니다.
     */
    public void requireCanEdit(String tripId, String userId) {
        mine(tripId, userId);
    }

    /** 주인인가. 여행을 지우거나 그룹을 바꿀 때만 필요합니다. */
    public Trip requireOwner(String tripId, String userId) {
        Trip trip = mine(tripId, userId);
        if (!trip.getOwnerId().equals(userId)) {
            throw ApiException.forbidden("여행을 만든 사람만 할 수 있어요.");
        }
        return trip;
    }

    /** 손댈 수 있는 여행인지 보고, 맞으면 그 여행을 돌려줍니다. */
    public Trip mine(String tripId, String userId) {
        Trip trip = trips.findById(tripId)
                .orElseThrow(() -> ApiException.notFound("여행을 찾을 수 없어요."));
        if (!reachable(trip, userId)) {
            throw ApiException.notFound("여행을 찾을 수 없어요.");
        }
        return trip;
    }

    /** 묻기만 합니다. 못 보면 false — 오류를 던지지 않습니다. */
    public boolean canRead(String tripId, String userId) {
        return trips.findById(tripId).map(t -> reachable(t, userId)).orElse(false);
    }

    private boolean reachable(Trip trip, String userId) {
        if (userId == null) {
            return false;
        }
        if (trip.getOwnerId().equals(userId)) {
            return true;
        }
        String groupId = trip.getGroupId();
        return groupId != null
                && groupMembers.findByIdGroupIdAndIdUserId(groupId, userId).isPresent();
    }

    /**
     * 이 여행에 딸린 사람들.
     *
     * <p>만든 사람과, 그룹 여행이면 그 그룹 멤버 전부입니다. 만든 사람이 늘
     * 맨 앞입니다 — 정산에서 "누가 냈나" 를 세울 때 차례가 흔들리면 안
     * 됩니다.
     *
     * <p>혼자 여행이면 한 사람입니다.
     */
    public List<String> peopleOf(String tripId) {
        return trips.findById(tripId).map(this::peopleOf).orElse(List.of());
    }

    public List<String> peopleOf(Trip trip) {
        Set<String> out = new LinkedHashSet<>();
        out.add(trip.getOwnerId());
        if (trip.getGroupId() != null) {
            groupMembers.findAllByIdGroupId(trip.getGroupId()).stream()
                    .map(m -> m.getId().getUserId())
                    .forEach(out::add);
        }
        return new ArrayList<>(out);
    }

    /**
     * 내가 볼 수 있는 여행 번호 전부.
     *
     * <p>내가 만든 것과, 내가 속한 그룹의 것입니다.
     */
    public List<String> tripIdsOf(String userId) {
        List<String> groupIds = groupMembers.findAllByIdUserId(userId).stream()
                .map(m -> m.getId().getGroupId())
                .toList();
        Set<String> out = new LinkedHashSet<>();
        trips.findAllByOwnerId(userId).forEach(t -> out.add(t.getId()));
        if (!groupIds.isEmpty()) {
            trips.findAllByGroupIdIn(groupIds).forEach(t -> out.add(t.getId()));
        }
        return new ArrayList<>(out);
    }

    /** 내가 볼 수 있는 여행 전부. */
    public List<Trip> tripsOf(String userId) {
        List<String> groupIds = groupMembers.findAllByIdUserId(userId).stream()
                .map(GroupMember::getId)
                .map(id -> id.getGroupId())
                .toList();
        Set<Trip> out = new LinkedHashSet<>(trips.findAllByOwnerId(userId));
        if (!groupIds.isEmpty()) {
            out.addAll(trips.findAllByGroupIdIn(groupIds));
        }
        return new ArrayList<>(out);
    }
}
