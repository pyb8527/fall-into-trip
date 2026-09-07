package net.weeniebeenie.fit.trip.domain;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.shared.error.ApiException;
import org.springframework.stereotype.Component;

/**
 * 여행에 손댈 수 있는지 판단하는 규칙.
 *
 * <p>이 판단은 장소 추가, 날짜 수정, 지출 등록 등 여러 곳에서 똑같이 필요합니다.
 * 서비스마다 조건문을 흩뿌려 두면 한 군데를 고칠 때 다른 곳이 빠지기 쉬워서
 * 규칙 자체를 도메인에 두었습니다.
 *
 * <p>규칙은 셋입니다.
 * <ul>
 *   <li>여행을 만든 사람이 주인입니다. 동행자를 부르고 여행을 지울 수 있습니다.</li>
 *   <li>동행자로 들어온 사람은 그 여행을 봅니다.</li>
 *   <li>그중 EDITOR 만 고칠 수 있습니다. VIEWER 는 보기만 합니다.</li>
 * </ul>
 *
 * <p>운영자(ADMIN)라고 해서 남의 여행을 들여다보지는 못합니다. 계정을 관리하고
 * 기록을 살피는 자리이지, 남의 일정을 볼 이유는 없습니다.
 */
@Component
@RequiredArgsConstructor
public class TripAccessPolicy {

    private final TripRepository trips;
    private final TripMemberRepository members;

    /**
     * 볼 수 있는가.
     *
     * 권한이 없으면 404 로 답합니다. 403 으로 답하면 "있긴 있는데 못 본다"가
     * 되어, id 를 바꿔 가며 어떤 여행이 존재하는지 알아낼 수 있습니다.
     */
    public void requireCanRead(String tripId, String userId) {
        if (members.findByIdTripIdAndIdUserId(tripId, userId).isEmpty()) {
            throw ApiException.notFound("여행을 찾을 수 없습니다.");
        }
    }

    /** 고칠 수 있는가. */
    public void requireCanEdit(String tripId, String userId) {
        TripMember member = members.findByIdTripIdAndIdUserId(tripId, userId)
                .orElseThrow(() -> ApiException.notFound("여행을 찾을 수 없습니다."));
        if (member.getRole() != TripRole.EDITOR) {
            throw ApiException.forbidden("이 여행을 고칠 권한이 없습니다.");
        }
    }

    /** 주인인가. 동행자를 부르거나 여행을 지울 때만 필요합니다. */
    public Trip requireOwner(String tripId, String userId) {
        Trip trip = trips.findById(tripId)
                .orElseThrow(() -> ApiException.notFound("여행을 찾을 수 없습니다."));
        if (!trip.getOwnerId().equals(userId)) {
            /* 동행자에게는 있다는 사실까지만 알려 줍니다. */
            requireCanRead(tripId, userId);
            throw ApiException.forbidden("여행을 만든 사람만 할 수 있습니다.");
        }
        return trip;
    }

    /** 화면이 편집 버튼을 보여 줄지 정할 때 씁니다. 동행자가 아니면 null. */
    public TripRole roleOf(String tripId, String userId) {
        return members.findByIdTripIdAndIdUserId(tripId, userId)
                .map(TripMember::getRole)
                .orElse(null);
    }
}
