package net.weeniebeenie.fit.group.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.group.application.GroupCards;
import net.weeniebeenie.fit.group.application.GroupService;
import net.weeniebeenie.fit.group.domain.Group;
import net.weeniebeenie.fit.trip.domain.Trip;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 모임.
 *
 * <p>사람이 사는 자리입니다. 여행은 그 안에서 생깁니다.
 */
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groups;
    private final GroupCards cards;
    private final net.weeniebeenie.fit.account.domain.UserRepository users;

    @PostMapping
    public Map<String, Object> create(@CurrentUser AuthPrincipal me,
                                      @RequestBody CreateRequest req) {
        Group made = groups.create(me, req.name(), req.about(), req.emoji());
        return Map.of("group", view(made, 1, 0));
    }

    public record CreateRequest(String name, String about, String emoji) {
    }

    /**
     * 내가 속한 모임들.
     *
     * <p>사람 수와 여행 수를 함께 냅니다. 목록에서 그 둘이 없으면 모임 이름만
     * 늘어서 어느 것이 살아 있는 모임인지 안 보입니다.
     */
    @GetMapping
    public Map<String, Object> mine(@CurrentUser AuthPrincipal me) {
        List<Group> list = groups.mine(me);
        /*
          카드에 얹을 것 — 앞 몇 사람의 얼굴, 최근 활동 한 줄, 최근 사진.

          <p>목록이 「이름 · 인원 · 여행 수」 한 줄씩이라 모임이 둘이면 화면이
          비었습니다. 넘기는 번호는 <b>내가 든 모임</b>뿐입니다 — 안 든 모임의
          활동은 읽지도 않습니다(GroupCards).
        */
        java.time.Instant seenAt = users.findById(me.id())
                .map(net.weeniebeenie.fit.account.domain.User::getNewsSeenAt).orElse(null);
        Map<String, GroupCards.Card> cards = this.cards.of(
                list.stream().map(Group::getId).toList(), me.id(), seenAt);

        List<Map<String, Object>> out = list.stream()
                .map(g -> {
                    Map<String, Object> v = view(g,
                            groups.peopleOf(me, g.getId()).size(),
                            groups.tripsOf(me, g.getId()).size());
                    GroupCards.Card c = cards.get(g.getId());
                    if (c != null) {
                        v.put("faces", c.faces());
                        v.put("activity", c.activity());
                        v.put("photoIds", c.photoIds());
                        v.put("fresh", c.fresh());
                    }
                    return v;
                })
                .toList();
        return Map.of("groups", out);
    }

    @GetMapping("/{id}")
    public Map<String, Object> read(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        Group group = groups.read(me, id);
        List<Trip> trips = groups.tripsOf(me, id);
        List<GroupService.Mate> mates = groups.peopleOf(me, id);

        return Map.of(
                "group", view(group, mates.size(), trips.size()),
                "members", mates,
                "trips", trips.stream()
                        .map(t -> Map.of("id", t.getId(), "title", t.getTitle()))
                        .toList());
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@CurrentUser AuthPrincipal me,
                                      @PathVariable String id,
                                      @RequestBody UpdateRequest req) {
        Group got = groups.update(me, id, req.name(), req.about(), req.emoji(), req.coverPhotoId());
        return Map.of("group", view(got,
                groups.peopleOf(me, id).size(),
                groups.tripsOf(me, id).size()));
    }

    public record UpdateRequest(String name, String about, String emoji, String coverPhotoId) {
    }

    /**
     * 모임을 지웁니다.
     *
     * <p>여행은 안 지웁니다 — 만든 사람의 혼자 여행으로 남습니다. 화면이 그
     * 말을 먼저 해 줘야 합니다.
     */
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        groups.delete(me, id);
        return Map.of("ok", true);
    }

    @DeleteMapping("/{id}/members/me")
    public Map<String, Object> leave(@CurrentUser AuthPrincipal me, @PathVariable String id) {
        groups.leave(me, id);
        return Map.of("ok", true);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me,
                                      @PathVariable String id,
                                      @PathVariable String userId) {
        groups.remove(me, id, userId);
        return Map.of("ok", true);
    }

    @PatchMapping("/{id}/owner")
    public Map<String, Object> handOver(@CurrentUser AuthPrincipal me,
                                        @PathVariable String id,
                                        @RequestBody OwnerRequest req) {
        groups.handOver(me, id, req.userId());
        return Map.of("ok", true);
    }

    public record OwnerRequest(String userId) {
    }

    private static Map<String, Object> view(Group g, int memberCount, int tripCount) {
        java.util.Map<String, Object> out = new java.util.HashMap<>();
        out.put("id", g.getId());
        out.put("name", g.getName());
        out.put("about", g.getAbout());
        out.put("emoji", g.getEmoji());
        out.put("coverPhotoId", g.getCoverPhotoId());
        out.put("ownerId", g.getOwnerId());
        out.put("memberCount", memberCount);
        out.put("tripCount", tripCount);
        return out;
    }
}
