package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.group.application.GroupService;
import net.weeniebeenie.fit.group.domain.Group;
import net.weeniebeenie.fit.group.domain.GroupRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 여행 만들기·고치기·지우기.
 *
 * <p>여행을 만들면 날짜도 함께 깔아 둡니다. 빈 여행을 만들어 놓고 날짜를 하나씩
 * 더하게 하면 손이 많이 가서, 며칠짜리인지만 받아 한 번에 준비합니다.
 */
@Service
@RequiredArgsConstructor
public class TripService {

    private static final int MAX_NIGHTS = 30;

    private final TripRepository trips;
    private final DayRepository days;
    private final PlaceRepository places;
    /* 목록에 세울 첫 사진만 여기서 읽습니다 — 붙이고 떼는 일은 PhotoService 몫입니다. */
    private final PlacePhotoRepository placePhotos;
    private final TripAccessPolicy access;
    private final TripGoingRepository going;
    private final net.weeniebeenie.fit.account.domain.UserRepository users;
    private final GroupService groups;
    private final GroupRepository groupBook;
    private final AuditService audit;

    /**
     * 내가 볼 수 있는 여행 목록.
     *
     * <p>어느 모임의 것인지를 함께 냅니다. 화면이 「혼자」와 「모임」 두 칸으로
     * 갈라 보여 주는데, 모임 이름이 없으면 모임 칸에 여행 이름만 늘어서 어느
     * 모임의 것인지 알 수 없습니다. 모임 이름은 여행마다 묻지 않고 한 번에
     * 받아 짝지읍니다 — 여행 수만큼 질의가 붙을 자리입니다.
     */
    @Transactional(readOnly = true)
    public List<TripSummary> listFor(AuthPrincipal me) {
        List<Trip> visible = access.tripsOf(me.id()).stream()
                .sorted(java.util.Comparator.comparing(Trip::getCreatedAt))
                .toList();

        Map<String, String> groupNames = new java.util.HashMap<>();
        List<String> groupIds = visible.stream()
                .map(Trip::getGroupId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (!groupIds.isEmpty()) {
            groupBook.findAllById(groupIds).forEach(g -> groupNames.put(g.getId(), g.getName()));
        }

        Map<String, String> shots = firstPhotosOf(visible.stream().map(Trip::getId).toList());

        return visible.stream().map(trip -> {
            List<Day> dayList = days.findAllByTripIdOrderBySortAsc(trip.getId());
            return new TripSummary(
                    trip.getId(), trip.getTitle(), trip.getOwnerId(),
                    trip.getTheme(), trip.getEmoji(),
                    dayList.isEmpty() ? null : dayList.get(0).getIso(),
                    dayList.isEmpty() ? null : dayList.get(dayList.size() - 1).getIso(),
                    dayList.size(),
                    (int) places.countOfTrip(trip.getId()),
                    trip.getGroupId(),
                    trip.getGroupId() == null ? null : groupNames.get(trip.getGroupId()),
                    shots.get(trip.getId()));
        }).toList();
    }

    /**
     * 여행마다 목록에 세울 사진 한 장.
     *
     * <h3>어느 사진인가 — 장소에 챙겨 둔 것입니다</h3>
     *
     * <p>고를 수 있던 자리가 둘이었습니다.
     *
     * <ul>
     *   <li><b>피드</b>({@code feed.Post} 의 {@code tripId}) — 여행 앨범이 쓰는
     *       그것입니다. 사진은 그쪽이 더 「여행 사진」답지만, 그 사진은
     *       <b>사람의 것</b>이고 누가 볼 수 있는지는 올린 모임에 달려 있습니다
     *       ({@code FeedService.canRead}). 여행 목록에 그것을 세우면 같은 여행이
     *       사람마다 다른 그림으로 보이거나, 안 보여야 할 것이 보입니다.
     *   <li><b>장소에 챙겨 둔 사진</b>({@link net.weeniebeenie.fit.trip.domain.PlacePhoto})
     *       — 이것입니다. 「여행의 것입니다. 사람마다 따로 달지 않습니다」가 그
     *       표의 약속이라, 여행을 볼 수 있는 사람은 이미 그 사진을 다 봅니다.
     *       볼 권한을 따로 셀 것이 없습니다.
     * </ul>
     *
     * <p>메뉴판이나 예매 화면이 걸릴 수 있다는 것은 압니다 — 거기 쌓이는 것이
     * 반은 그런 것입니다. 그래도 둡니다. 내가 내 여행에 넣어 둔 사진이고
     * (남에게 나가는 자리가 아닙니다), 아니면 그 자리는 구글 Static Maps 로
     * 그린 선 한 장입니다. 선보다 못한 사진은 드물고, 선은 호출 한 번입니다.
     *
     * <p>한 장도 없는 여행은 지도가 그 자리를 맡습니다 — 없는 번호를 지어내지
     * 않습니다.
     *
     * @param tripIds 볼 수 있다고 이미 가려낸 여행들
     * @return 여행 번호 → 사진 번호. 사진이 없는 여행은 아예 안 들어 있습니다
     */
    private Map<String, String> firstPhotosOf(List<String> tripIds) {
        if (tripIds.isEmpty()) {
            return Map.of();
        }
        Map<String, String> out = new java.util.HashMap<>();
        for (Object[] row : placePhotos.firstPhotoOfTrips(tripIds)) {
            out.put((String) row[0], (String) row[1]);
        }
        return out;
    }

    /**
     * 다녀온 여행을 밑그림 삼아 새로 하나.
     *
     * <p>같은 데를 또 가는 일은 흔합니다. 매년 가는 곳, 이번엔 다른 사람과
     * 가는 곳. 그때마다 스무 곳을 다시 찾아 넣게 하면 그 자체가 일입니다.
     *
     * <p>날짜는 새로 받습니다. 지난 날짜를 그대로 물려받으면 만들자마자 이미
     * 다녀온 여행이 됩니다. 첫날만 정하면 나머지가 그 간격 그대로 따라옵니다 —
     * 2박 3일이었으면 새것도 2박 3일입니다.
     *
     * <p>가져오지 않는 것이 셋 있습니다. <b>동행자</b>는 부르지 않습니다. 지난
     * 여행을 함께한 사람이 이번에도 간다는 보장이 없고, 무엇보다 남을 말없이
     * 새 여행에 끌어들이는 일이 됩니다. <b>다녀온 표시</b>도 지웁니다 — 아직
     * 가지 않은 여행입니다. <b>깃발과 위치</b>는 그때 그 자리의 것이라 옮길
     * 뜻이 없습니다.
     */
    @Transactional
    public Trip duplicate(AuthPrincipal me, String tripId, String title, String startIso) {
        /* 볼 수 있으면 베낄 수 있습니다. 동행자로 들어가 함께 짠 여행을 내
           것으로 하나 떠 두는 것은 자연스러운 일입니다. */
        access.requireCanRead(tripId, me.id());
        Trip origin = trips.findById(tripId)
                .orElseThrow(() -> ApiException.notFound("그런 여행이 없어요."));

        String cleanTitle = title == null || title.isBlank()
                ? origin.getTitle() + " (사본)"
                : title.trim();
        if (cleanTitle.length() > 120) {
            throw ApiException.badRequest("여행 이름이 너무 길어요.");
        }
        LocalDate start = DayLabels.parse(startIso);

        /* 사본은 베낀 사람의 혼자 여행입니다. 모임까지 물려받으면 모임
           사람들 모두의 목록에 말없이 여행 하나가 더 생깁니다. */
        Trip made = trips.save(Trip.builder().title(cleanTitle).ownerId(me.id()).build());

        List<Day> originDays = days.findAllByTripIdOrderBySortAsc(tripId);
        for (int i = 0; i < originDays.size(); i++) {
            Day from = originDays.get(i);
            LocalDate date = start.plusDays(i);
            Day day = days.save(Day.builder()
                    .tripId(made.getId())
                    .sort(i)
                    .label(DayLabels.labelOf(i))
                    .shortName(from.getShortName())
                    .date(DayLabels.display(date))
                    .iso(date)
                    .theme(from.getTheme())
                    .color(from.getColor() == null ? DayLabels.colorOf(i) : from.getColor())
                    .budget(from.getBudget())
                    /* 비행기 편은 옮기지 않습니다. 날짜가 달라지면 그 편도
                       달라지는데, 남아 있으면 예약한 줄 알고 지나칩니다. */
                    .build());

            for (Place p : places.findAllByDayIdOrderBySortAsc(from.getId())) {
                places.save(Place.builder()
                        .dayId(day.getId())
                        .sort(p.getSort())
                        .name(p.getName())
                        .ja(p.getJa())
                        .en(p.getEn())
                        .lat(p.getLat())
                        .lng(p.getLng())
                        .cat(p.getCat())
                        .icon(p.getIcon())
                        .time(p.getTime())
                        .cost(p.getCost())
                        .costAmount(p.getCostAmount())
                        .costCurrency(p.getCostCurrency())
                        .note(p.getNote())
                        .url(p.getUrl())
                        .radius(p.getRadius())
                        .fit(p.isFit())
                        .move(p.getMove())
                        .placeId(p.getPlaceId())
                        .updatedBy(me.id())
                        .build());
            }
        }

        audit.log(me.id(), "trip.duplicate", made.getId(),
                Map.of("from", tripId, "title", cleanTitle, "startIso", startIso));
        return made;
    }

    /**
     * 여행 하나를 집습니다.
     *
     * id 를 생략하면 내가 속한 여행 중 가장 먼저 만들어진 것을 봅니다. 예전처럼
     * 전체에서 첫 여행을 집으면 남의 여행이 걸리므로 반드시 나를 기준으로
     * 찾아야 합니다.
     */
    @Transactional(readOnly = true)
    public Trip resolveFor(AuthPrincipal me, String tripId) {
        if (tripId != null && !tripId.isBlank()) {
            return trips.findById(tripId)
                    .orElseThrow(() -> ApiException.notFound("여행을 찾을 수 없어요."));
        }
        return access.tripsOf(me.id()).stream()
                .min(java.util.Comparator.comparing(Trip::getCreatedAt))
                .orElseThrow(() -> ApiException.notFound("아직 여행이 없어요."));
    }

    /**
     * 여행을 만듭니다.
     *
     * <p>{@code groupId} 를 주면 그 모임의 여행이 됩니다 — 모임 사람들 모두의
     * 목록에 함께 뜨고 모두가 고칠 수 있습니다. 안 주면 혼자 여행입니다.
     * 모임 사람이 아니면 404 입니다. 남의 모임에 여행을 꽂아 넣는 길을 열어 둘
     * 이유가 없습니다.
     */
    @Transactional
    public Trip create(AuthPrincipal me, String title, String startIso, int nights, String groupId) {
        String cleanTitle = title == null ? "" : title.trim();
        if (cleanTitle.isEmpty()) {
            throw ApiException.badRequest("여행 이름을 지어 주세요.");
        }
        LocalDate start = DayLabels.parse(startIso);
        int nightCount = Math.max(0, Math.min(MAX_NIGHTS, nights));

        String inGroup = groupId == null || groupId.isBlank() ? null : groupId;
        if (inGroup != null) {
            groups.requireMember(inGroup, me.id());
        }

        /*
          색을 하나 쥐여 줍니다.

          <p>안 정하고 두었습니다. 「기본값을 억지로 주면 정한 것과 안 정한
          것을 구별할 수 없다」가 그 이유였는데, 실제로는 <b>아무도 안
          정했습니다.</b> 색을 고르는 자리는 여행을 만든 뒤 설정 안에 있어서,
          만들고 바로 목록으로 돌아가는 사람은 거기까지 안 갑니다.

          <p>그래서 목록이 통째로 무채색이었습니다. 구별하라고 비워 둔 것이
          구별할 것이 하나도 없게 만든 셈입니다.

          <p>돌아가며 줍니다 — 난수로 뽑으면 연달아 만든 둘이 같은 색일 수
          있고, 그게 가장 헷갈리는 경우입니다. 내가 가진 여행 수를 세어
          그다음 색을 집으면 적어도 <b>이웃한 둘은 늘 다릅니다.</b>
        */
        String tint = DayLabels.colorOf((int) trips.countByOwnerId(me.id()));

        Trip trip = trips.save(Trip.builder()
                .title(cleanTitle)
                .ownerId(me.id())
                .groupId(inGroup)
                .build());
        trip.setTheme(tint);

        /* 0박이면 당일치기라 하루, 3박이면 나흘입니다. */
        for (int i = 0; i <= nightCount; i++) {
            LocalDate date = start.plusDays(i);
            days.save(Day.builder()
                    .tripId(trip.getId())
                    .sort(i)
                    .label(DayLabels.labelOf(i))
                    .date(DayLabels.display(date))
                    .iso(date)
                    .color(DayLabels.colorOf(i))
                    .build());
        }

        audit.log(me.id(), "trip.create", trip.getId(),
                Map.of("title", cleanTitle, "startIso", startIso, "nights", nightCount,
                        "group", String.valueOf(inGroup)));
        return trip;
    }

    /**
     * 여행을 고칩니다 — 이름·시작일·색·표식.
     *
     * <p>시작일을 옮기면 나머지 날짜도 같은 간격으로 따라 움직입니다. 하루만
     * 밀렸는데 날짜를 전부 다시 잡게 하면 번거롭기 때문입니다.
     *
     * <p><b>보낸 것만 바뀝니다.</b> {@code null} 인 칸은 손대지 않습니다.
     * 그래서 <b>비우는 것은 빈 글("")</b>입니다 — 색과 표식을 도로 무채색으로
     * 되돌리는 길이 있어야 합니다. 가계부·보석함과 같은 약속입니다.
     */
    @Transactional
    public void update(AuthPrincipal me, String tripId, String title, String startIso,
                       String theme, String emoji) {
        Trip trip = resolveFor(me, tripId);
        access.requireCanEdit(trip.getId(), me.id());

        if (title != null) {
            String cleanTitle = title.trim();
            if (cleanTitle.isEmpty()) {
                throw ApiException.badRequest("여행 이름이 비어 있어요.");
            }
            trip.setTitle(cleanTitle);
        }

        if (startIso != null && !startIso.isBlank()) {
            LocalDate start = DayLabels.parse(startIso);
            List<Day> dayList = days.findAllByTripIdOrderBySortAsc(trip.getId());
            for (int i = 0; i < dayList.size(); i++) {
                LocalDate moved = start.plusDays(i);
                dayList.get(i).setIso(moved);
                dayList.get(i).setDate(DayLabels.display(moved));
            }
        }
        if (theme != null) {
            trip.setTheme(DayLabels.pickColor(theme));
        }
        if (emoji != null) {
            /* 글자 수로 자르지 않습니다. 이모지 하나가 코드포인트 여럿으로
               이뤄지는 일이 흔해서(국기·가족·피부색), 가운데를 자르면 깨진
               조각이 남습니다. 너무 길면 통째로 물립니다. */
            String clean = emoji.trim();
            if (clean.length() > 16) {
                throw ApiException.badRequest("표식이 너무 길어요.");
            }
            trip.setEmoji(clean.isEmpty() ? null : clean);
        }

        audit.log(me.id(), "trip.update", trip.getId(),
                Map.of("title", String.valueOf(title), "startIso", String.valueOf(startIso)));
    }

    /**
     * 여행을 지웁니다. 날짜·장소·가계부·동행자가 함께 사라집니다.
     *
     * 만든 사람만 지울 수 있습니다. 동행자는 나가는 것으로 끝냅니다 —
     * 남의 여행을 통째로 없앨 수 있으면 안 됩니다.
     */
    @Transactional
    public void delete(AuthPrincipal me, String tripId) {
        Trip trip = access.requireOwner(tripId, me.id());
        trips.delete(trip);
        audit.log(me.id(), "trip.delete", trip.getId(), Map.of("title", trip.getTitle()));
    }

    /**
     * 이 여행의 사람들. 만든 사람이 맨 앞입니다.
     *
     * <p>이름을 붙여 냅니다 — 화면이 id 만 받으면 사람마다 또 물어야 합니다.
     */
    @Transactional(readOnly = true)
    public List<Person> peopleOf(AuthPrincipal me, String tripId) {
        Trip trip = access.mine(tripId, me.id());
        return access.peopleOf(trip).stream()
                .map(id -> users.findById(id)
                        .map(u -> new Person(u.getId(), u.getName(), u.getMark(), u.getPhotoId(),
                                u.getId().equals(trip.getOwnerId())))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /**
     * 이 여행을 같이 보는 사람 하나.
     *
     * <h3>얼굴은 사진 · 표식 · 이름 차례입니다</h3>
     *
     * <p>{@code photoId} 는 {@code mark} 를 <b>대신하는 값이 아니라 앞서는</b>
     * 값입니다({@code components/profile-face}). 둘을 같이 내려보냅니다 —
     * 표식은 사진을 안 올린 사람의 자리이고, 그것마저 없으면 이름에서 따온
     * 것이 섭니다. 하나만 실으면 사람들 판과 챙길 것의 맡은 사람 자리에서
     * 한쪽 사람들이 빈 동그라미가 됩니다.
     *
     * @param owner   이 여행을 만든 사람인지. 이름 옆에 표를 다는 데 씁니다.
     * @param mark    지도에서 이 사람을 가리키는 그림의 이름. 안 골랐으면 비어
     *                있습니다
     * @param photoId 올려 둔 얼굴 사진. 안 올렸으면 비어 있습니다. 사람을 다시
     *                묻지 않습니다 — 위에서 이미 찾아 둔 {@code User} 에서
     *                표식과 함께 꺼냅니다
     */
    public record Person(String id, String name, String mark, String photoId, boolean owner) {
    }

    /* ------------------------------------------------------- 안내판 */

    /** 안내판 한 장의 길이. 이보다 길면 안내판이 아니라 문서입니다. */
    private static final int NOTICE_MAX = 4000;

    /**
     * 여행 안내판을 고칩니다.
     *
     * <h3>멤버 누구나 고칩니다</h3>
     *
     * <p>도어락 번호를 아는 사람이 적고, 모이는 곳이 바뀌면 바꾼 사람이
     * 고칩니다. 만든 사람만 고치게 하면 그 사람에게 메시지를 보내 「이거
     * 좀 고쳐 줘」를 부탁하는 일이 생깁니다.
     *
     * <h3>합치지 않습니다</h3>
     *
     * <p>둘이 동시에 고치면 뒤 사람이 「다른 사람이 먼저 고쳤어요」를
     * 봅니다({@code Trip.version}). 글 한 장을 줄마다 합치려면 그 자체가
     * 편집기 하나입니다.
     *
     * <p>빈 글이면 안내판을 걷습니다.
     */
    @Transactional
    public Trip writeNotice(AuthPrincipal me, String tripId, String text, Long version) {
        Trip trip = access.mine(tripId, me.id());
        access.requireCanEdit(tripId, me.id());
        net.weeniebeenie.fit.shared.domain.Versioned.check(version, trip.getVersion());

        String clean = text == null || text.isBlank() ? null : text.strip();
        if (clean != null && clean.length() > NOTICE_MAX) {
            throw ApiException.badRequest("안내판은 " + NOTICE_MAX + "자까지예요.");
        }
        trip.setNotice(clean);
        trip.setNoticeBy(me.id());
        trip.setNoticeAt(java.time.Instant.now());
        /* 여기서 밀어 넣어 판을 올립니다. 끝날 때 올라가게 두면 돌려주는 판이
           하나 낡아서, 같은 사람이 이어서 고칠 때 제 글과 부딪힙니다. */
        trips.saveAndFlush(trip);

        /* 글은 기록에 남기지 않습니다 — 도어락 번호가 들어 있을 수 있습니다. */
        audit.log(me.id(), "trip.notice", tripId,
                Map.of("length", clean == null ? 0 : clean.length()));
        return trip;
    }

    /** 예산 상한. 한 여행에 10억 원이면 넉넉합니다 — 자릿수를 잘못 친 것을 막습니다. */
    private static final long BUDGET_MAX = 1_000_000_000L;

    /**
     * 여행 예산을 정합니다. 원화, 여행 하나에 하나.
     *
     * <p>멤버 누구나 고칩니다 — 안내판과 같은 까닭입니다. 판(version)을 안
     * 받습니다. 숫자 하나라 뒤에 적은 사람 것이 남아도 무엇이 사라졌는지가
     * 바로 보입니다.
     *
     * @param amount 원. null 이나 0 이면 예산을 걷습니다
     */
    @Transactional
    public Trip writeBudget(AuthPrincipal me, String tripId, Long amount) {
        Trip trip = access.mine(tripId, me.id());
        access.requireCanEdit(tripId, me.id());
        if (amount != null && (amount < 0 || amount > BUDGET_MAX)) {
            throw ApiException.badRequest("예산은 0원에서 10억 원 사이로 적어 주세요.");
        }
        trip.setBudget(amount == null || amount == 0 ? null : amount);
        trips.saveAndFlush(trip);
        audit.log(me.id(), "trip.budget", tripId,
                Map.of("amount", trip.getBudget() == null ? 0 : trip.getBudget()));
        return trip;
    }

    /**
     * 가고 싶은 곳 투표의 마지막 날을 정합니다. 비우면 마감이 없습니다.
     *
     * <p>멤버 누구나 정합니다(예산 · 안내판과 같은 규칙). 지난 날은 안 받습니다 —
     * 고르는 순간 닫혀 버리는 마감은 「닫기」 단추이지 마감이 아닙니다.
     */
    @Transactional
    public Trip writeVoteUntil(AuthPrincipal me, String tripId, String iso) {
        Trip trip = access.mine(tripId, me.id());
        access.requireCanEdit(tripId, me.id());
        java.time.LocalDate until = null;
        if (iso != null && !iso.isBlank()) {
            until = DayLabels.parse(iso);
            if (until.isBefore(java.time.LocalDate.now())) {
                throw ApiException.badRequest("마감은 오늘이나 그 뒤 날짜로 정해 주세요.");
            }
        }
        trip.setVoteUntil(until);
        trips.saveAndFlush(trip);
        audit.log(me.id(), "trip.vote-until", tripId,
                Map.of("until", until == null ? "" : until.toString()));
        return trip;
    }

    /* ------------------------------------------------------- 참석 응답 */

    /**
     * 누가 가고 누가 못 가나.
     *
     * <p>{@code peopleOf} 가 아니라 {@code everyoneOf} 를 씁니다 — 전자는
     * 이제 「가는 사람」이라 못 간다고 한 사람이 빠져 있습니다. 그 사람을
     * 빼고 보여 주면 <b>누가 못 간다고 했는지</b>를 알 수가 없습니다.
     */
    @Transactional(readOnly = true)
    public List<Going> goingOf(AuthPrincipal me, String tripId) {
        Trip trip = access.mine(tripId, me.id());

        Map<String, TripGoing> said = going.findAllByIdTripId(tripId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        g -> g.getId().getUserId(), g -> g));

        return access.everyoneOf(trip).stream()
                .map(id -> users.findById(id).map(u -> {
                    TripGoing g = said.get(id);
                    return new Going(
                            u.getId(), u.getName(), u.getMark(), u.getPhotoId(),
                            u.getId().equals(trip.getOwnerId()),
                            /* 답이 없으면 「아직 몰라요」입니다 — 여행을 만들 때
                               멤버 수만큼 줄을 미리 깔지 않습니다. */
                            g == null ? GoingAnswer.MAYBE : g.getAnswer(),
                            g == null ? null : g.getNote());
                }).orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /**
     * 간다 · 못 간다 · 아직 모른다.
     *
     * <h3>볼 수 있으면 답할 수 있습니다</h3>
     *
     * <p>고칠 수 있는 사람만으로 막지 않습니다. 모임 여행은 멤버 누구나
     * 고칠 수 있으므로 지금은 같은 말이지만, 뜻이 다릅니다 — <b>제 참석은
     * 제가 정합니다.</b> 남이 내 답을 바꿀 수 있으면 그것은 참석 응답이
     * 아니라 명단입니다.
     *
     * <p>그래서 남의 답은 못 바꿉니다. 어느 줄을 고칠지 받지 않고, 늘
     * 부른 사람 제 줄입니다.
     */
    @Transactional
    public void answerGoing(AuthPrincipal me, String tripId, GoingAnswer answer, String note) {
        access.requireCanRead(tripId, me.id());

        String clean = note == null || note.isBlank() ? null : note.trim();
        if (clean != null && clean.length() > 200) {
            throw ApiException.badRequest("한 줄은 200자까지예요.");
        }

        TripGoing row = going.findById(new TripGoingId(tripId, me.id()))
                .orElseGet(() -> new TripGoing(tripId, me.id(), answer, clean));
        row.setAnswer(answer == null ? GoingAnswer.MAYBE : answer);
        row.setNote(clean);
        row.setUpdatedAt(java.time.Instant.now());
        going.save(row);

        audit.log(me.id(), "trip.going", tripId, Map.of("answer", String.valueOf(answer)));
    }

    /**
     * 한 사람의 참석 응답.
     *
     * <h3>얼굴은 사진 · 표식 · 이름 차례입니다</h3>
     *
     * <p>내 여행 카드의 겹친 얼굴들이 이것을 씁니다. {@code photoId} 가
     * {@code mark} 를 <b>지우지 않습니다</b>({@code components/profile-face}) —
     * 표식은 사진을 안 올린 사람의 자리이고, 그것마저 없으면 이름에서 따온
     * 것이 섭니다. 둘이 함께 와야 섞여 선 얼굴들이 제대로 그려집니다.
     *
     * @param answer  줄이 없으면 {@link GoingAnswer#MAYBE} 입니다
     * @param note    「셋째 날만 못 가요」 같은 것. 모두에게 보입니다
     * @param mark    지도에서 이 사람을 가리키는 그림의 이름. 안 골랐으면 비어
     *                있습니다
     * @param photoId 올려 둔 얼굴 사진. 안 올렸으면 비어 있습니다. 사람을 다시
     *                묻지 않습니다 — 위에서 이미 찾아 둔 {@code User} 에서
     *                표식과 함께 꺼냅니다
     */
    public record Going(String id, String name, String mark, String photoId, boolean owner,
                        GoingAnswer answer, String note) {
    }

    /**
     * 혼자 만든 여행을 모임으로 옮기거나, 다시 혼자 것으로 뺍니다.
     *
     * <p>만든 사람만 합니다. 모임 사람 아무나 할 수 있게 하면 내 여행이 내가
     * 모르는 사이에 남들이 보는 것이 됩니다.
     *
     * <p>{@code groupId} 를 비우면 모임에서 뺍니다 — 그 뒤로는 만든 사람만
     * 봅니다. 기록은 지우지 않습니다.
     */
    @Transactional
    public void moveToGroup(AuthPrincipal me, String tripId, String groupId) {
        Trip trip = access.requireOwner(tripId, me.id());
        String to = groupId == null || groupId.isBlank() ? null : groupId;
        if (to != null) {
            groups.requireMember(to, me.id());
        }
        trip.setGroupId(to);
        audit.log(me.id(), "trip.group", tripId, Map.of("group", String.valueOf(to)));
    }

    /**
     * @param groupId   모임 여행이면 그 모임. 혼자 여행이면 비어 있습니다.
     * @param groupName 모임 이름. 화면이 「모임」 칸을 모임별로 묶는 데 씁니다.
     * @param firstPhotoId 목록에 세울 첫 사진. 한 장도 없으면 비어 있습니다
     *                     ({@link #firstPhotosOf}).
     */
    public record TripSummary(String id, String title, String ownerId,
                              String theme, String emoji,
                              LocalDate startIso, LocalDate endIso,
                              int dayCount, int placeCount,
                              String groupId, String groupName,
                              String firstPhotoId) {
    }
}
