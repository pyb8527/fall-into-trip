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
 * 다녀온 자리에 남기는 것.
 *
 * <h3>기록은 여행의 것입니다</h3>
 *
 * <p>사람마다 따로 남겼었습니다. "이치란에 갔다" 는 우리 모두의 사실이지만
 * "국물이 진했다" 는 내 감상이라는 생각이었습니다. 그런데 실제로는 셋이 간
 * 여행에서 한 장소에 세 덩어리가 나란히 섰고, 남이 올린 것은 손댈 수가
 * 없었습니다 — 흐린 사진 한 장을 바꾸는 데도 올린 사람이 앱을 열어야 했습니다.
 *
 * <p>같이 다녀온 자리의 기록이니 한 장소에 하나로 둡니다. 멤버(EDITOR)면
 * 누구나 더하고 고치고 뺍니다.
 *
 * <h3>사진은 두 가지 일을 합니다</h3>
 *
 * <p>다녀와서 남기는 것(RECORD)과 가기 전에 챙겨 두는 것(REFERENCE)입니다.
 * 메뉴판 사진이나 예매 화면은 다니면서 보려고 넣는 것이지 남에게 보이려고
 * 넣는 것이 아니라, 여행기에는 기록 쪽만 따라갑니다.
 */
@Service
@RequiredArgsConstructor
public class VisitService {

    /**
     * 한 곳에 붙일 수 있는 사진 수.
     *
     * <p>기록과 참고가 따로 셉니다 — 다섯 장을 남기고 나면 메뉴판을 못 넣게
     * 되는 것은 두 가지를 가른 뜻이 없어지는 일입니다.
     */
    private static final int MAX_PHOTOS = 5;

    private final PlacePhotoRepository placePhotos;
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
     * 도장을 찍습니다.
     *
     * <p>이미 찍혀 있으면 그대로 둡니다 — 누가 먼저 찍었는지를 나중에 누른
     * 사람이 덮어쓸 이유가 없습니다.
     */
    @Transactional
    public void stamp(AuthPrincipal me, String placeId) {
        Place place = readable(me, placeId);
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
        Place place = readable(me, placeId);
        place.setVisitedAt(null);
        place.setVisitedBy(null);
    }

    /**
     * 그 자리에 남깁니다. 사진·별점·한 줄입니다.
     *
     * <p>안 보낸 칸은 그대로 둡니다(null). 지우려면 빈 값을 보냅니다 — 빈
     * 목록은 "사진 다 빼기", 0 은 "별점 안 매김", 빈 글자는 "한 줄 지우기"
     * 입니다. 안 보낸 것과 지운 것을 못 가르면, 한 줄만 고치려다 사진이
     * 통째로 날아갑니다.
     */
    @Transactional
    public Place record(AuthPrincipal me, String placeId, Mark mark) {
        Place place = editable(me, placeId);

        if (mark != null) {
            if (mark.photoIds() != null) {
                setPhotos(me, placeId, PhotoKind.RECORD, mark.photoIds());
            }
            if (mark.stars() != null) {
                /* 0 은 "안 매김" 입니다. 별 다섯 개짜리 칸에서 하나도 안 누른
                   상태를 보내는 길이 있어야 매긴 것을 지울 수 있습니다. */
                place.setStars(mark.stars() <= 0 ? null : (short) Math.min(5, mark.stars()));
            }
            if (mark.note() != null) {
                String clean = mark.note().trim();
                if (clean.length() > 200) {
                    throw ApiException.badRequest("한 줄이 너무 길어요. 200자 아래로 적어 주세요.");
                }
                place.setReview(clean.isEmpty() ? null : clean);
            }
        }
        return place;
    }

    /**
     * 다니면서 볼 사진을 챙겨 둡니다.
     *
     * <p>여행기에는 안 실립니다. 도장과도 상관없습니다 — 가기 <b>전에</b>
     * 넣어 두는 것이라, 다녀와야 넣을 수 있으면 쓸모가 없습니다.
     */
    @Transactional
    public void setRefs(AuthPrincipal me, String placeId, List<String> photoIds) {
        editable(me, placeId);
        setPhotos(me, placeId, PhotoKind.REFERENCE, photoIds == null ? List.of() : photoIds);
    }

    /** 남긴 것을 지웁니다. 도장은 그대로입니다. */
    @Transactional
    public void unrecord(AuthPrincipal me, String placeId) {
        Place place = editable(me, placeId);
        placePhotos.deleteAllByPlaceIdAndKind(placeId, PhotoKind.RECORD);
        place.setStars(null);
        place.setReview(null);
    }

    /** 이 장소에 붙은 사진들. */
    @Transactional(readOnly = true)
    public List<String> photosOf(String placeId, PhotoKind kind) {
        return placePhotos.findAllByPlaceIdAndKindOrderBySortAsc(placeId, kind).stream()
                .map(PlacePhoto::getPhotoId)
                .toList();
    }

    /** 이 여행에 붙은 사진 전부. 기록과 참고가 함께 옵니다. */
    @Transactional(readOnly = true)
    public List<PlacePhoto> photosOfTrip(String tripId) {
        return placePhotos.findAllOfTrip(tripId);
    }

    /**
     * 사진을 통째로 맞춥니다.
     *
     * <p>보내 온 목록이 곧 그 장소의 사진입니다 — 빠진 것은 뗍니다. 하나씩
     * 붙이고 떼는 길을 따로 두면 화면이 지금 몇 장인지를 저마다 세게 되고,
     * 그러면 다섯 장 한도가 새기 시작합니다.
     *
     * <p>뗀 사진 자체는 여기서 안 지웁니다. 지우는 것은 따로 부릅니다 —
     * 뗀 것과 지운 것은 다른 일이고, 올린 글에 실려 있으면 지우면 안 됩니다.
     */
    private void setPhotos(AuthPrincipal me, String placeId, PhotoKind kind, List<String> want) {
        List<String> clean = want.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        if (clean.size() > MAX_PHOTOS) {
            throw ApiException.badRequest("사진은 한 곳에 " + MAX_PHOTOS + "장까지 붙일 수 있어요.");
        }

        /*
          붙일 수 있는 사진인지 먼저 다 봅니다.

          <p>내가 올린 것이거나, 이미 이 자리에 붙어 있는 것이어야 합니다.
          뒤엣것이 필요한 까닭은 기록이 여행의 것이기 때문입니다 — 동행자가
          한 줄을 고치면서 목록을 되보낼 때 그 안에는 남이 올린 사진이
          들어 있고, 내 것만 받으면 그 순간 남의 사진이 다 떨어집니다.

          <p>하나라도 안 되면 아무것도 안 바꿉니다. 반만 바뀐 자리가 남으면
          화면과 서버가 서로 다른 것을 들고 있게 됩니다.
        */
        List<String> already = placePhotos.findAllByPlaceIdAndKindOrderBySortAsc(placeId, kind)
                .stream()
                .map(PlacePhoto::getPhotoId)
                .toList();
        for (String id : clean) {
            if (!already.contains(id)) {
                mine(me, id);
            }
        }

        placePhotos.deleteAllByPlaceIdAndKind(placeId, kind);
        /* 지우고 바로 넣으면 같은 트랜잭션 안에서 넣기가 먼저 갈 수 있습니다.
           여기서 한 번 밀어 두면 차례가 지켜집니다. */
        placePhotos.flush();
        for (int at = 0; at < clean.size(); at++) {
            placePhotos.save(new PlacePhoto(placeId, clean.get(at), kind, at, me.id()));
        }
    }

    /**
     * 내가 올린 사진인지.
     *
     * <p>안 보면 남의 사진 번호를 적어 넣어 내 여행에 붙일 수 있습니다.
     * 번호는 난수라 찍어서 맞히기 어렵지만, 어렵다는 것이 막았다는 뜻은
     * 아닙니다.
     */
    private void mine(AuthPrincipal me, String photoId) {
        photos.findById(photoId)
                .filter(p -> p.getOwnerId().equals(me.id()))
                .orElseThrow(() -> ApiException.badRequest("그런 사진이 없어요."));
    }

    /** 남기는 것들. null 은 "그대로 두기", 빈 목록은 "다 떼기". */
    public record Mark(List<String> photoIds, Integer stars, String note) {
    }

    /** 볼 수 있는 여행의 장소여야 도장을 찍을 수 있습니다. */
    private Place readable(AuthPrincipal me, String placeId) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없어요."));
        access.requireCanRead(tripOf(place), me.id());
        return place;
    }

    /**
     * 고칠 수 있는 여행의 장소여야 남길 수 있습니다.
     *
     * <p>도장보다 한 칸 빡빡합니다. 도장은 "다녀왔다" 는 사실이라 같이 다닌
     * 사람이면 누구나 누르지만, 남기는 것은 여행에 <b>내용을 더하는</b>
     * 일이라 구경하러 들어온 사람(VIEWER)이 할 일은 아닙니다.
     */
    private Place editable(AuthPrincipal me, String placeId) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없어요."));
        access.requireCanEdit(tripOf(place), me.id());
        return place;
    }

    private String tripOf(Place place) {
        return days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."))
                .getTripId();
    }
}
