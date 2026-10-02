package net.weeniebeenie.fit.trip.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.api.dto.TripDtos;
import net.weeniebeenie.fit.trip.application.RecommendService;
import net.weeniebeenie.fit.trip.api.dto.TripDtos.*;
import net.weeniebeenie.fit.trip.application.TripQueryService;
import net.weeniebeenie.fit.trip.application.FolderService;
import net.weeniebeenie.fit.trip.application.TripService;
import net.weeniebeenie.fit.trip.domain.Trip;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TripController {

    private final TripService trips;
    private final FolderService folders;
    private final TripQueryService query;
    private final ObjectMapper mapper;
    private final RecommendService recommend;
    /* 남긴 것에 누가 남겼는지를 붙이려고 이름만 읽습니다. */
    private final net.weeniebeenie.fit.account.domain.UserRepository users;

    /** 내가 볼 수 있는 여행 목록. */
    @GetMapping("/trips")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me) {
        /* 폴더는 여행마다 따로 묻지 않고 한 번에 받아 짝지웁니다. 여행 수만큼
           질의가 붙으면 목록 한 번에 그만큼 왕복합니다. */
        Map<String, String> placed = folders.placementOf(me);
        return Map.of("trips", trips.listFor(me).stream()
                .map(s -> TripSummaryView.of(s, placed.get(s.id())))
                .toList());
    }

    @PostMapping("/trips")
    public Map<String, Object> create(@CurrentUser AuthPrincipal me,
                                      @Valid @RequestBody CreateTripRequest req) {
        Trip trip = trips.create(me, req.title(), req.startIso(), req.nightsOrZero(), req.groupId());
        return Map.of("trip", TripView.of(trip));
    }

    /**
     * 이 여행의 사람들.
     *
     * <p>만든 사람과, 모임 여행이면 그 모임 사람 전부입니다. 화면 셋이
     * 이것을 씁니다 — 일정의 이름표, 챙길 것의 맡은 사람, 정산의 "누가 냈나".
     * 모임을 따로 묻게 하면 혼자 여행에서는 물을 모임이 없습니다.
     */
    @GetMapping("/trips/{id}/people")
    public Map<String, Object> people(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return Map.of("people", trips.peopleOf(me, id));
    }

    /**
     * 누가 가고 누가 못 가나.
     *
     * <p>{@code /people} 과 따로 둡니다. 그쪽은 이제 「가는 사람」만
     * 내므로(TripAccessPolicy.peopleOf), 못 간다고 한 사람을 보여 주려면
     * 다른 길이 필요합니다.
     */
    @GetMapping("/trips/{id}/going")
    public Map<String, Object> going(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        return Map.of("going", trips.goingOf(me, id));
    }

    /**
     * 내 답을 적습니다.
     *
     * <p>누구 줄을 고칠지 받지 않습니다. 늘 <b>부른 사람 제 줄</b>입니다 —
     * 제 참석은 제가 정합니다. 남이 바꿀 수 있으면 그것은 참석 응답이
     * 아니라 명단입니다.
     */
    @PutMapping("/trips/{id}/going")
    public Map<String, Object> answerGoing(@CurrentUser AuthPrincipal me,
                                           @PathVariable String id,
                                           @RequestBody GoingBody body) {
        trips.answerGoing(me, id, body == null ? null : body.answer(),
                body == null ? null : body.note());
        return Map.of("ok", true);
    }

    /** @param answer GOING · NOT_GOING · MAYBE */
    public record GoingBody(net.weeniebeenie.fit.trip.domain.GoingAnswer answer, String note) {
    }

    /** 혼자 여행을 모임으로 옮기거나 다시 뺍니다. 만든 사람만 합니다. */
    @PatchMapping("/trips/{id}/group")
    public Map<String, Object> group(@CurrentUser AuthPrincipal me,
                                     @PathVariable String id,
                                     @RequestBody GroupRequest req) {
        trips.moveToGroup(me, id, req.groupId());
        return Map.of("ok", true);
    }

    public record GroupRequest(String groupId) {
    }

    /**
     * 이 여행을 밑그림 삼아 새로 하나.
     *
     * <p>동행자는 부르지 않고, 다녀온 표시는 지웁니다. 자세한 것은
     * {@link net.weeniebeenie.fit.trip.application.TripService#duplicate}.
     */
    @PostMapping("/trips/{id}/copy")
    public Map<String, Object> copy(@CurrentUser AuthPrincipal me,
                                    @PathVariable String id,
                                    @Valid @RequestBody DuplicateTripRequest req) {
        Trip made = trips.duplicate(me, id, req.title(), req.startIso());
        return Map.of("trip", TripView.of(made));
    }

    /**
     * 말로 묻고 갈 곳을 받습니다.
     *
     * <p>지금 어디 있는지를 <b>본문</b>으로 받습니다. 주소에 실으면 nginx 접근
     * 기록과 브라우저 방문 기록에 남습니다 — 사람이 어디 있었는지는 거기 남길
     * 값이 아닙니다.
     *
     * <p>물어본 문장도 기록에 남기지 않습니다. "혼자 울기 좋은 곳" 이 로그에
     * 남을 이유가 없습니다.
     */
    /**
     * 여행에 매이지 않고 묻습니다.
     *
     * <p>보석함에서 쓰는 길입니다. 아직 어느 여행에 넣을지 안 정했을 때 —
     * "다음에 오사카 가면 갈 데" 를 모아 두는 자리 — 여행을 먼저 만들게
     * 하는 것은 순서가 뒤집힌 일입니다.
     *
     * <p>어디쯤인지는 담아 둔 곳들의 한가운데로 봅니다. 담아 둔 것에도 그
     * 사람이 어디를 다니는지가 담겨 있습니다.
     */
    @PostMapping("/recommend")
    public Map<String, Object> recommendLoose(@CurrentUser AuthPrincipal me,
                                              @RequestBody RecommendRequest req) {
        /* 날짜와 두 곳 사이를 함께 보냈으면 그대로 넘깁니다. 여기서 조용히
           버리면 "왜 그날 기준으로 안 보나", "왜 길 위에서 안 찾나" 를 알
           길이 없습니다 — 서비스가 거절합니다. */
        RecommendService.Result got = recommend.recommend(
                me, null, req.query(), req.dayId(),
                req.here() == null ? null : req.here().lat(),
                req.here() == null ? null : req.here().lng(),
                req.intent(), req.between());
        Map<String, Object> out = new java.util.HashMap<>();
        out.put("places", got.places());
        out.put("note", got.note());
        return out;
    }

    @PostMapping("/trips/{id}/recommend")
    public Map<String, Object> recommend(@CurrentUser AuthPrincipal me,
                                         @PathVariable String id,
                                         @RequestBody RecommendRequest req) {
        RecommendService.Result got = recommend.recommend(
                me, id, req.query(), req.dayId(),
                req.here() == null ? null : req.here().lat(),
                req.here() == null ? null : req.here().lng(),
                req.intent(), req.between());
        Map<String, Object> out = new java.util.HashMap<>();
        out.put("places", got.places());
        out.put("note", got.note());
        return out;
    }

    /**
     * @param intent  기기 안의 모델이 문장을 미리 쪼개 온 것. 웹에서는 늘
     *                비어 있습니다 — 거기에는 모델이 없습니다.
     * @param between 두 곳 <b>사이</b>에서 찾으라는 것. 번호만 받고 길은
     *                서버가 구합니다 — 몸통으로 받는 이유는 {@code here} 와
     *                같습니다. 어디를 다니는지는 접근 기록과 방문 기록에
     *                남길 값이 아닙니다
     */
    public record RecommendRequest(String query, String dayId, At here,
                                   RecommendService.Intent intent,
                                   RecommendService.Between between) {
        public record At(Double lat, Double lng) {
        }
    }

    @PatchMapping("/trips/{id}")
    public Map<String, Object> update(@CurrentUser AuthPrincipal me,
                                      @PathVariable String id,
                                      @RequestBody UpdateTripRequest req) {
        trips.update(me, id, req.title(), req.startIso(), req.theme(), req.emoji());
        return Map.of("ok", true);
    }

    @DeleteMapping("/trips/{id}")
    public Map<String, Object> delete(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        trips.delete(me, id);
        return Map.of("ok", true);
    }

    /**
     * 일정 화면이 쓰는 전부 — 여행·날짜·장소·내가 다녀온 곳.
     *
     * trip 을 생략하면 가장 먼저 만든 여행을 봅니다.
     */
    @GetMapping("/trip")
    public Map<String, Object> detail(@CurrentUser AuthPrincipal me,
                                      @RequestParam(name = "trip", required = false) String tripId) {
        TripQueryService.TripDetail d = query.detail(me, tripId);
        List<DayView> days = d.days().stream()
                .map(day -> TripDtos.dayView(day,
                        d.placesByDay().getOrDefault(day.getId(), List.of()), mapper))
                .toList();

        /*
          다니면서 볼 사진.

          <p>메뉴판, 예매 화면, 가는 길 지도. 장소 칸마다 모아서 보냅니다 —
          없는 곳이 대부분이라 있는 것만 실으면 오가는 것이 그만큼 줄어듭니다.

          <p>한동안 여기에 「그 자리에서 남긴 것」도 함께 왔습니다(도장·별점·
          한 줄·사진). 걷었습니다 — 갔다 왔는지는 본인이 알고, 남기는 것은
          장소를 먼저 골라야 한다는 것이 문제였습니다. 피드가 그 일을 합니다.
        */
        Map<String, List<String>> refs = new java.util.HashMap<>();
        for (var pp : d.photos()) {
            refs.computeIfAbsent(pp.getPlaceId(), k -> new ArrayList<>()).add(pp.getPhotoId());
        }

        List<Map<String, Object>> aids = new ArrayList<>();
        for (List<net.weeniebeenie.fit.trip.domain.Place> onDay : d.placesByDay().values()) {
            for (net.weeniebeenie.fit.trip.domain.Place p : onDay) {
                List<String> chosen = refs.getOrDefault(p.getId(), List.of());
                if (!chosen.isEmpty()) {
                    aids.add(Map.of("placeId", p.getId(), "photoIds", chosen));
                }
            }
        }

        return Map.of(
                "trip", TripView.of(d.trip()),
                "days", days,
                "refs", aids,
                /* 볼 수 있으면 고칠 수 있습니다. 「보기만」을 없앴습니다. */
                "canEdit", true,
                "owner", d.owner());
    }
}
