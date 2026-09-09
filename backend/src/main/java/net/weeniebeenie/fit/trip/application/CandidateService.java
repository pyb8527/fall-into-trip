package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Coordinates;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 가고 싶은 곳 후보와 투표.
 *
 * <p>일정에 바로 넣으면 아직 정하지도 않은 것이 확정처럼 보이고, 나중에 빼자고
 * 말하기도 어려워집니다. 후보로 올려 두고 각자 좋아요를 누른 뒤, 다 좋다고 한
 * 것만 일정으로 옮깁니다.
 *
 * <p>합의는 <b>동행자 전원</b>이 좋아요를 눌렀을 때입니다. 여행은 둘일 수도
 * 다섯일 수도 있어 "둘 다" 로는 셀 수 없습니다.
 */
@Service
@RequiredArgsConstructor
public class CandidateService {

    /** 한 여행에 올릴 수 있는 후보의 수. 넘어가면 고르는 것이 일이 됩니다. */
    private static final int MAX_CANDIDATES = 100;

    private final TripCandidateRepository candidates;
    private final CandidateVoteRepository votes;
    private final TripMemberRepository members;
    private final SavedPlaceRepository saved;
    private final PlaceRepository places;
    private final DayRepository days;
    private final TripAccessPolicy access;

    @Transactional(readOnly = true)
    public List<Card> listOf(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());

        List<TripCandidate> found = candidates.findAllByTripIdOrderByCreatedAtAsc(tripId);
        if (found.isEmpty()) {
            return List.of();
        }
        int memberCount = (int) members.findAllByIdTripId(tripId).size();

        Map<String, int[]> tally = new HashMap<>();          // [찬성, 반대]
        Map<String, Boolean> mine = new HashMap<>();
        for (CandidateVote vote : votes.findAllByCandidateIdIn(found.stream().map(TripCandidate::getId).toList())) {
            int[] counts = tally.computeIfAbsent(vote.getCandidateId(), k -> new int[2]);
            if (vote.isYes()) {
                counts[0]++;
            } else {
                counts[1]++;
            }
            if (vote.getUserId().equals(me.id())) {
                mine.put(vote.getCandidateId(), vote.isYes());
            }
        }

        List<Card> out = new ArrayList<>(found.size());
        for (TripCandidate c : found) {
            int[] counts = tally.getOrDefault(c.getId(), new int[2]);
            /* 표를 안 던진 사람이 있으면 아직 정해지지 않은 것입니다. 없는 줄을
               "싫다" 로 세면 한 사람이 안 봤다는 이유로 확정됩니다. */
            boolean agreed = memberCount > 0 && counts[0] == memberCount;
            out.add(new Card(c.getId(), c.getName(), c.getLat(), c.getLng(), c.getPlaceId(),
                    c.getCat(), c.getIcon(), c.getNote(), c.getAddedBy(),
                    counts[0], counts[1], memberCount, mine.get(c.getId()), agreed));
        }
        return out;
    }

    /**
     * 후보를 올립니다.
     *
     * <p>보석함에서 가져올 수도, 검색해서 바로 올릴 수도 있습니다. 담아 둔
     * 것을 다시 적게 하면 같은 일을 두 번 합니다.
     */
    @Transactional
    public TripCandidate add(AuthPrincipal me, String tripId, Draft draft) {
        access.requireCanEdit(tripId, me.id());

        if (candidates.countByTripId(tripId) >= MAX_CANDIDATES) {
            throw ApiException.badRequest("후보가 너무 많습니다. 정한 것을 일정으로 옮겨 주세요.");
        }

        Draft from = draft;
        if (draft != null && draft.savedId() != null && !draft.savedId().isBlank()) {
            SavedPlace item = saved.findById(draft.savedId())
                    .filter(s -> s.getUserId().equals(me.id()))
                    .orElseThrow(() -> ApiException.notFound("담아 둔 장소를 찾을 수 없습니다."));
            from = new Draft(item.getName(), item.getLat(), item.getLng(),
                    item.getPlaceId(), item.getCat(), item.getNote(), null, item.getIcon());
        }
        if (from == null || from.name() == null || from.name().isBlank()) {
            throw ApiException.badRequest("장소 이름을 넣어 주세요.");
        }
        Coordinates at = Coordinates.of(from.lat(), from.lng());

        return candidates.save(TripCandidate.builder()
                .tripId(tripId)
                .name(from.name().trim())
                .lat(at.lat())
                .lng(at.lng())
                .placeId(blankToNull(from.placeId()))
                .cat(blankToNull(from.cat()))
                .icon(blankToNull(from.icon()))
                .note(blankToNull(from.note()))
                .addedBy(me.id())
                .build());
    }

    /**
     * 표를 던지거나 거둡니다.
     *
     * @param yes 비우면 던진 표를 거둡니다. 싫다고 한 것과 다릅니다.
     */
    @Transactional
    public void vote(AuthPrincipal me, String candidateId, Boolean yes) {
        TripCandidate candidate = candidates.findById(candidateId)
                .orElseThrow(() -> ApiException.notFound("후보를 찾을 수 없습니다."));
        access.requireCanRead(candidate.getTripId(), me.id());

        if (yes == null) {
            votes.deleteByCandidateIdAndUserId(candidateId, me.id());
            return;
        }
        votes.save(new CandidateVote(candidateId, me.id(), yes));
    }

    /**
     * 후보를 내립니다.
     *
     * <p>올린 사람과 여행 주인만 내릴 수 있습니다. 남이 올린 것을 아무나
     * 지우면 이야기가 끊깁니다.
     */
    @Transactional
    public void remove(AuthPrincipal me, String candidateId) {
        TripCandidate candidate = candidates.findById(candidateId)
                .orElseThrow(() -> ApiException.notFound("후보를 찾을 수 없습니다."));
        access.requireCanEdit(candidate.getTripId(), me.id());

        boolean mine = candidate.getAddedBy().equals(me.id());
        if (!mine && !isOwner(candidate.getTripId(), me.id())) {
            throw ApiException.forbidden("올린 사람만 내릴 수 있습니다.");
        }
        candidates.delete(candidate);
    }

    private boolean isOwner(String tripId, String userId) {
        try {
            access.requireOwner(tripId, userId);
            return true;
        } catch (ApiException e) {
            return false;
        }
    }

    /** 정해진 후보를 일정으로 옮깁니다. 후보 쪽에서는 지웁니다 — 이제 확정입니다. */
    @Transactional
    public int pour(AuthPrincipal me, String dayId, List<String> candidateIds) {
        Day day = days.findById(dayId)
                .orElseThrow(() -> ApiException.notFound("날짜를 찾을 수 없습니다."));
        access.requireCanEdit(day.getTripId(), me.id());

        if (candidateIds == null || candidateIds.isEmpty()) {
            throw ApiException.badRequest("옮길 후보를 골라 주세요.");
        }

        int sort = places.findAllByDayIdOrderBySortAsc(dayId).size();
        int made = 0;
        for (String id : candidateIds) {
            TripCandidate c = candidates.findById(id).orElse(null);
            /* 다른 여행의 후보를 섞어 보내는 것을 막습니다. */
            if (c == null || !c.getTripId().equals(day.getTripId())) {
                continue;
            }
            places.save(Place.builder()
                    .dayId(dayId)
                    .sort(sort++)
                    .name(c.getName())
                    .lat(c.getLat())
                    .lng(c.getLng())
                    .cat(c.getCat())
                    .icon(c.getIcon())
                    .note(c.getNote())
                    .placeId(c.getPlaceId())
                    .updatedBy(me.id())
                    .build());
            candidates.delete(c);
            made++;
        }
        if (made == 0) {
            throw ApiException.notFound("옮길 후보를 찾지 못했습니다.");
        }
        return made;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * 올릴 때 받는 것.
     *
     * @param savedId 보석함에서 가져올 때. 이것이 있으면 나머지는 보지 않습니다.
     */
    public record Draft(String name, Double lat, Double lng, String placeId,
                        String cat, String note, String savedId, String icon) {
    }

    /**
     * 화면이 띄우는 후보 한 장.
     *
     * @param myVote  내 표. 비어 있으면 아직 안 던진 것입니다.
     * @param agreed  동행자 전원이 좋다고 했는지
     */
    public record Card(String id, String name, double lat, double lng, String placeId,
                       String cat, String icon, String note, String addedBy,
                       int yes, int no, int memberCount, Boolean myVote, boolean agreed) {
    }
}
