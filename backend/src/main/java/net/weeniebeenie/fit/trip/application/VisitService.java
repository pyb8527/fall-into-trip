package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.photo.domain.PhotoRepository;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 다니면서 볼 사진을 챙겨 두는 일.
 *
 * <h3>도장과 기록이 여기 있었습니다</h3>
 *
 * <p>「다녀왔다」 도장과 그 자리에 남기는 사진·별점·한 줄이 이 서비스의
 * 절반이었습니다. 둘 다 걷었습니다.
 *
 * <p>도장은 <b>갔다 왔는지를 본인이 알기 때문</b>입니다. 그걸 앱에 또 눌러
 * 주는 것은 할 일 목록에 체크하는 느낌이지 여행이 아닙니다.
 *
 * <p>장소마다 남기는 기록은 <b>장소를 먼저 골라야 한다는 것</b>이 문제였습니다.
 * 숙소에서 찍은 단체 사진, 이동 중에 찍은 것, 마지막 날 공항에서 먹은 우동은
 * 올릴 데가 없었습니다. 피드가 그 일을 대신합니다.
 *
 * <h3>남는 것</h3>
 *
 * <p>메뉴판, 예매 화면, 가는 길 지도 — <b>가기 전에 챙겨 두고 가게 앞에서
 * 꺼내 보는 것</b>입니다. 피드와 다른 일이라 남깁니다. 남에게 보이려고 넣는
 * 것이 아니고, 여행기에도 안 실립니다.
 */
@Service
@RequiredArgsConstructor
public class VisitService {

    /**
     * 한 곳에 챙겨 둘 수 있는 사진 수.
     *
     * <p>메뉴판 한 장, 예매 화면 한 장, 가는 길 두어 장이면 넉넉합니다.
     */
    private static final int MAX_PHOTOS = 5;

    private final PlacePhotoRepository placePhotos;
    private final PhotoRepository photos;
    private final PlaceRepository places;
    private final DayRepository days;
    private final TripAccessPolicy access;

    /**
     * 다니면서 볼 사진을 챙겨 둡니다.
     *
     * <p>보내 온 목록이 곧 그 장소의 사진입니다 — 빠진 것은 뗍니다. 하나씩
     * 붙이고 떼는 길을 따로 두면 화면이 지금 몇 장인지를 저마다 세게 되고,
     * 그러면 다섯 장 한도가 새기 시작합니다.
     */
    @Transactional
    public void setRefs(AuthPrincipal me, String placeId, List<String> photoIds) {
        editable(me, placeId);

        List<String> clean = (photoIds == null ? List.<String>of() : photoIds).stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        if (clean.size() > MAX_PHOTOS) {
            throw ApiException.badRequest("사진은 한 곳에 " + MAX_PHOTOS + "장까지 붙일 수 있어요.");
        }

        /*
          붙일 수 있는 사진인지 먼저 다 봅니다.

          <p>내가 올린 것이거나, 이미 이 자리에 붙어 있는 것이어야 합니다.
          뒤엣것이 필요한 까닭은 이것이 여행의 것이기 때문입니다 — 동행자가
          한 장을 보태면서 목록을 되보낼 때 그 안에는 남이 올린 사진이 들어
          있고, 내 것만 받으면 그 순간 남의 사진이 다 떨어집니다.

          <p>하나라도 안 되면 아무것도 안 바꿉니다. 반만 바뀐 자리가 남으면
          화면과 서버가 서로 다른 것을 들고 있게 됩니다.
        */
        List<String> already = photosOf(placeId);
        for (String id : clean) {
            if (!already.contains(id)) {
                mine(me, id);
            }
        }

        placePhotos.deleteAllByPlaceId(placeId);
        /* 지우고 바로 넣으면 같은 트랜잭션 안에서 넣기가 먼저 갈 수 있습니다.
           여기서 한 번 밀어 두면 차례가 지켜집니다. */
        placePhotos.flush();
        for (int at = 0; at < clean.size(); at++) {
            placePhotos.save(new PlacePhoto(placeId, clean.get(at), at, me.id()));
        }
    }

    /** 이 장소에 챙겨 둔 사진들. 고른 차례대로입니다. */
    @Transactional(readOnly = true)
    public List<String> photosOf(String placeId) {
        return placePhotos.findAllByPlaceIdOrderBySortAsc(placeId).stream()
                .map(PlacePhoto::getPhotoId)
                .toList();
    }

    /** 이 여행에 챙겨 둔 사진 전부. */
    @Transactional(readOnly = true)
    public List<PlacePhoto> photosOfTrip(String tripId) {
        return placePhotos.findAllOfTrip(tripId);
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

    /** 고칠 수 있는 여행의 장소여야 챙겨 둘 수 있습니다. */
    private Place editable(AuthPrincipal me, String placeId) {
        Place place = places.findById(placeId)
                .orElseThrow(() -> ApiException.notFound("장소를 찾을 수 없어요."));
        String tripId = days.findById(place.getDayId())
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없어요."))
                .getTripId();
        access.requireCanEdit(tripId, me.id());
        return place;
    }
}
