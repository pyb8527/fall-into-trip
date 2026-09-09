package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Coordinates;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.PlaceKind;
import net.weeniebeenie.fit.trip.domain.PlaceRepository;
import net.weeniebeenie.fit.trip.domain.SavedPlace;
import net.weeniebeenie.fit.trip.domain.SavedPlaceRepository;
import net.weeniebeenie.fit.trip.domain.TripAccessPolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 나중에 쓰려고 담아 두는 장소.
 *
 * <p>남의 일정을 통째로 가져오는 길은 있었지만 "이 집만 갖고 싶다" 가 안
 * 됐습니다. 담아 두었다가 내 일정 아무 날에나 꺼내 넣습니다.
 *
 * <p>담는 순간의 값을 그대로 둡니다. 원래 글이 지워지거나 그쪽에서 이름을
 * 고쳐도 내가 담아 둔 것은 그대로여야 합니다.
 */
@Service
@RequiredArgsConstructor
public class SavedPlaceService {

    /**
     * 담아 둘 수 있는 개수.
     *
     * <p>보석함은 훑어보는 곳이라 화면을 여러 장 넘겨야 하면 담아 둔 것을
     * 잊습니다. 넘치면 안 쓰는 것부터 지우게 합니다.
     */
    private static final int MAX_SAVED = 300;

    /** 한 번에 일정으로 옮길 수 있는 개수. */
    private static final int MAX_AT_ONCE = 20;

    private final SavedPlaceRepository saved;
    private final PlaceRepository places;
    private final DayRepository days;
    private final TripAccessPolicy access;

    @Transactional(readOnly = true)
    public List<SavedPlace> listOf(AuthPrincipal me) {
        return saved.findAllByUserIdOrderByCreatedAtDesc(me.id());
    }

    /**
     * 담습니다.
     *
     * <p>같은 가게를 두 번 담아도 하나로 둡니다. 여기저기서 눈에 띌 때마다
     * 누르게 되는데 그때마다 쌓이면 보석함이 같은 것으로 채워집니다.
     *
     * <p>구글 번호를 아는 것만 같은 곳인지 판단합니다. 직접 찍은 좌표는
     * 이름이 달라도 같은 곳인지 알 수 없습니다.
     */
    @Transactional
    public SavedPlace save(AuthPrincipal me, Draft draft) {
        String name = draft.name() == null ? "" : draft.name().trim();
        if (name.isEmpty()) {
            throw ApiException.badRequest("장소 이름을 넣어 주세요.");
        }
        Coordinates at = Coordinates.of(draft.lat(), draft.lng());

        String placeId = blankToNull(draft.placeId());
        if (placeId != null) {
            var already = saved.findByUserIdAndPlaceId(me.id(), placeId);
            if (already.isPresent()) {
                return already.get();
            }
        }
        if (saved.countByUserId(me.id()) >= MAX_SAVED) {
            throw ApiException.badRequest(
                    "보석함이 가득 찼습니다. 안 쓰는 것을 지우고 담아 주세요.");
        }

        return saved.save(SavedPlace.builder()
                .userId(me.id())
                .name(name)
                .lat(at.lat())
                .lng(at.lng())
                .placeId(placeId)
                .cat(blankToNull(draft.cat()))
                .icon(blankToNull(draft.icon()))
                .note(blankToNull(draft.note()))
                .fromPost(blankToNull(draft.fromPost()))
                .build());
    }

    /**
     * 담아 둔 곳의 그림만 바꿉니다.
     *
     * <p>모르는 이름이면 비웁니다. 화면에서 넘어온 값을 그대로 믿지 않습니다.
     */
    @Transactional
    public SavedPlace retag(AuthPrincipal me, String savedId, String icon) {
        SavedPlace item = saved.findById(savedId)
                .orElseThrow(() -> ApiException.notFound("담아 둔 장소를 찾을 수 없습니다."));
        if (!item.getUserId().equals(me.id())) {
            /* 남의 보석함이 있다는 것 자체를 알릴 이유가 없습니다. */
            throw ApiException.notFound("담아 둔 장소를 찾을 수 없습니다.");
        }
        item.setIcon(PlaceKind.clean(icon));
        return item;
    }

    @Transactional
    public void remove(AuthPrincipal me, String savedId) {
        SavedPlace item = saved.findById(savedId)
                .orElseThrow(() -> ApiException.notFound("담아 둔 장소를 찾을 수 없습니다."));
        if (!item.getUserId().equals(me.id())) {
            /* 남의 보석함이 있다는 것 자체를 알릴 이유가 없습니다. */
            throw ApiException.notFound("담아 둔 장소를 찾을 수 없습니다.");
        }
        saved.delete(item);
    }

    /**
     * 담아 둔 것을 일정에 넣습니다.
     *
     * <p>보석함에서는 지우지 않습니다. 같은 곳을 여러 여행에 넣을 수 있고,
     * 넣었다고 사라지면 다시 찾아야 합니다.
     */
    @Transactional
    public List<Place> pour(AuthPrincipal me, String dayId, List<String> savedIds) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanEdit(day.getTripId(), me.id());

        if (savedIds == null || savedIds.isEmpty()) {
            throw ApiException.badRequest("넣을 장소를 골라 주세요.");
        }
        if (savedIds.size() > MAX_AT_ONCE) {
            throw ApiException.badRequest("한 번에 " + MAX_AT_ONCE + "곳까지 넣을 수 있습니다.");
        }

        /* 고른 순서가 아니라 담아 둔 순서로 들어갑니다. 화면에서 고른 차례를
           서버가 알 수 없고, 넣은 뒤 화살표로 옮기면 됩니다. */
        List<SavedPlace> picked = saved.findAllByUserIdAndIdIn(me.id(), savedIds);
        if (picked.isEmpty()) {
            throw ApiException.notFound("담아 둔 장소를 찾을 수 없습니다.");
        }

        int sort = places.findAllByDayIdOrderBySortAsc(dayId).size();
        List<Place> made = new ArrayList<>(picked.size());
        for (SavedPlace item : picked) {
            made.add(places.save(Place.builder()
                    .dayId(dayId)
                    .sort(sort++)
                    .name(item.getName())
                    .lat(item.getLat())
                    .lng(item.getLng())
                    .cat(item.getCat())
                    /* 담을 때 찍힌 그림이 일정까지 그대로 따라갑니다. 여기서
                       끊기면 보석함을 거쳐 온 곳만 지도에서 민무늬가 됩니다. */
                    .icon(item.getIcon())
                    .note(item.getNote())
                    .placeId(item.getPlaceId())
                    .updatedBy(me.id())
                    .build()));
        }
        return made;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * 담을 때 받는 것.
     *
     * @param fromPost 어느 글에서 담았는지. 검색이나 지도에서 담으면 비어 있습니다.
     */
    public record Draft(String name, Double lat, Double lng, String placeId,
                        String cat, String note, String fromPost, String icon) {
    }
}
