package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.photo.domain.PhotoRepository;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * 다녀온 곳 표시.
 *
 * 이건 사람마다 따로 남습니다. 같은 여행을 가도 누구는 들르고 누구는 지나칠
 * 수 있으니, 한 사람이 체크했다고 모두에게 칠해지면 안 됩니다.
 */
@Service
@RequiredArgsConstructor
public class VisitService {

    private final VisitRepository visits;
    private final PhotoRepository photos;
    private final PlaceRepository places;
    private final DayRepository days;
    private final TripAccessPolicy access;

    /**
     * 이 여행에서 다녀온 곳.
     *
     * <p>누가 찍었는지는 안 봅니다 — 도장은 여행의 것입니다.
     */
    @Transactional(readOnly = true)
    public List<String> visitedPlaceIds(String tripId) {
        return places.findAllOfTrip(tripId).stream()
                .filter(p -> p.getVisitedAt() != null)
                .map(Place::getId)
                .toList();
    }

    /**
     * 그 자리에서 남긴 것들.
     *
     * <p><b>같이 간 사람 것까지</b> 옵니다. 같은 일정을 같이 다녔으니 서로
     * 무엇을 남겼는지 볼 수 있어야 합니다 — 안 보이면 셋이 간 여행의 기록이
     * 셋으로 흩어져 아무 데도 온전한 것이 없습니다.
     *
     * <p>누가 남겼는지는 함께 옵니다. 사진은 여행의 것이 아니라 그 사람의
     * 것이라, 이름 없이 섞어 두면 누구의 감상인지 알 수 없습니다.
     */
    @Transactional(readOnly = true)
    public List<Visit> marksOf(String tripId) {
        return visits.findAllOfTrip(tripId);
    }

    /**
     * 도장을 찍습니다. 사진·별점·한 줄을 함께 남길 수 있습니다.
     *
     * <p>이미 찍힌 자리에 다시 부르면 <b>덮어쓰지 않고 보탭니다</b> — 도장을
     * 먼저 찍고 나중에 사진을 붙이는 것이 실제 순서입니다. 지우려면 빈
     * 문자열을 보냅니다(null 은 "그대로 두기" 입니다).
     */
    /**
     * 도장을 찍습니다.
     *
     * <p>이미 찍혀 있으면 그대로 둡니다 — 누가 먼저 찍었는지를 나중에 누른
     * 사람이 덮어쓸 이유가 없습니다.
     */
    @Transactional
    public void stamp(AuthPrincipal me, String placeId) {
        Place place = requireReadable(me, placeId);
        if (place.getVisitedAt() == null) {
            place.setVisitedAt(Instant.now());
            place.setVisitedBy(me.id());
        }
    }

    /**
     * 도장을 뺍니다.
     *
     * <p>같이 간 사람 누구나 뺄 수 있습니다. 잘못 찍은 것을 찍은 사람만 뺄 수
     * 있게 두면, 그 사람이 앱을 안 열면 영영 찍힌 채로 남습니다.
     *
     * <p>남긴 것은 안 지웁니다 — 도장을 잘못 눌렀다고 사진까지 사라지면
     * 되돌릴 수 없는 일이 됩니다.
     */
    @Transactional
    public void unstamp(AuthPrincipal me, String placeId) {
        Place place = requireReadable(me, placeId);
        place.setVisitedAt(null);
        place.setVisitedBy(null);
    }

    @Transactional
    public Visit mark(AuthPrincipal me, String placeId, Mark mark) {
        requireReadable(me, placeId);
        VisitId id = new VisitId(me.id(), placeId);
        Visit row = visits.findById(id).orElseGet(() -> visits.save(new Visit(me.id(), placeId)));

        if (mark != null) {
            if (mark.photoId() != null) {
                row.setPhotoId(mark.photoId().isBlank() ? null : mine(me, mark.photoId()));
            }
            if (mark.stars() != null) {
                /* 0 은 "안 매김" 입니다. 별 다섯 개짜리 칸에서 하나도 안 누른
                   상태를 보내는 길이 있어야 매긴 것을 지울 수 있습니다. */
                row.setStars(mark.stars() <= 0 ? null : (short) Math.min(5, mark.stars()));
            }
            if (mark.note() != null) {
                String clean = mark.note().trim();
                if (clean.length() > 200) {
                    throw ApiException.badRequest("한 줄이 너무 길어요. 200자 아래로 적어 주세요.");
                }
                row.setNote(clean.isEmpty() ? null : clean);
            }
        }
        return row;
    }

    /**
     * 내가 올린 사진인지.
     *
     * <p>안 보면 남의 사진 번호를 적어 넣어 내 여행기에 붙일 수 있습니다.
     * 번호는 난수라 찍어서 맞히기 어렵지만, 어렵다는 것이 막았다는 뜻은
     * 아닙니다.
     */
    private String mine(AuthPrincipal me, String photoId) {
        return photos.findById(photoId)
                .filter(p -> p.getOwnerId().equals(me.id()))
                .map(p -> p.getId())
                .orElseThrow(() -> ApiException.badRequest("그런 사진이 없어요."));
    }

    /** 도장에 함께 남기는 것들. null 은 "그대로 두기", 빈 값은 "지우기". */
    public record Mark(String photoId, Integer stars, String note) {
    }

    /** 내가 남긴 것을 지웁니다. 도장은 그대로입니다. */
    @Transactional
    public void unmark(AuthPrincipal me, String placeId) {
        requireReadable(me, placeId);
        visits.deleteById(new VisitId(me.id(), placeId));
    }

    /** 볼 수 있는 여행의 장소여야 찍을 수 있습니다. */
    private Place requireReadable(AuthPrincipal me, String placeId) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없어요."));
        Day day = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."));
        access.requireCanRead(day.getTripId(), me.id());
        return place;
    }
}
