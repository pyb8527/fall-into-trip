package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.domain.Coordinates;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 자유시간에 서로를 찾는 것들 — 임시 핀과 실시간 위치.
 *
 * <p>사람이 지금 어디 있는지는 이 서비스에서 가장 민감한 값입니다. 그래서
 * 다음을 규칙으로 둡니다.
 *
 * <ul>
 *   <li><b>여행마다, 사람마다 켭니다.</b> 계정 전체를 여는 스위치는 없습니다.</li>
 *   <li><b>스스로 꺼집니다.</b> 켠 것을 잊어도 몇 시간 뒤 안 보입니다.</li>
 *   <li><b>동행자만 봅니다.</b> 게시판이나 링크로는 절대 나가지 않습니다.</li>
 *   <li><b>자취를 안 남깁니다.</b> 한 사람당 한 줄을 덮어씁니다. 줄을 쌓으면
 *       그것은 다닌 길이 되고, 그건 우리가 들고 있을 값이 아닙니다.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class LiveService {

    /**
     * 위치를 켠 뒤 스스로 꺼지기까지.
     *
     * <p>자리를 보낼 때마다 다시 셉니다. 쓰는 동안에는 이어지고, 앱을 닫으면
     * 그때부터 이만큼 뒤에 사라집니다.
     */
    private static final Duration SHARE_WINDOW = Duration.ofHours(4);

    /** 임시 핀이 남아 있는 시간. 자유시간 한 번쯤입니다. */
    private static final Duration PIN_WINDOW = Duration.ofHours(6);

    /** 한 사람이 한 번에 꽂아 둘 수 있는 핀. 지도를 덮지 않을 만큼입니다. */
    private static final int MAX_PINS = 5;

    private final TripPinRepository pins;
    private final TripLocationRepository locations;
    private final TripMemberRepository members;
    private final UserRepository users;
    private final TripAccessPolicy access;

    /* --------------------------------------------------------- 임시 핀 */

    @Transactional
    public List<Pin> pinsOf(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());
        /* 기한이 지난 것은 볼 때 함께 치웁니다. 안 보이기만 하고 쌓아 두면
           결국 자취가 됩니다. */
        pins.sweep(tripId, Instant.now());

        List<Pin> out = new ArrayList<>();
        for (TripPin pin : pins.findAllByTripIdAndExpiresAtAfterOrderByCreatedAtDesc(tripId, Instant.now())) {
            out.add(new Pin(pin.getId(), pin.getLat(), pin.getLng(), pin.getLabel(),
                    nameOf(pin.getUserId()), pin.getUserId().equals(me.id()),
                    pin.getCreatedAt(), pin.getExpiresAt()));
        }
        return out;
    }

    @Transactional
    public TripPin drop(AuthPrincipal me, String tripId, Double lat, Double lng, String label) {
        access.requireCanRead(tripId, me.id());
        Coordinates at = Coordinates.of(lat, lng);

        pins.sweep(tripId, Instant.now());
        if (pins.countByTripIdAndUserIdAndExpiresAtAfter(tripId, me.id(), Instant.now()) >= MAX_PINS) {
            throw ApiException.badRequest("한 번에 " + MAX_PINS + "개까지 꽂을 수 있습니다.");
        }

        return pins.save(TripPin.builder()
                .tripId(tripId)
                .userId(me.id())
                .lat(at.lat())
                .lng(at.lng())
                .label(label == null || label.isBlank() ? null : label.trim())
                .expiresAt(Instant.now().plus(PIN_WINDOW))
                .build());
    }

    @Transactional
    public void pull(AuthPrincipal me, String pinId) {
        TripPin pin = pins.findById(pinId)
                .orElseThrow(() -> ApiException.notFound("핀을 찾을 수 없습니다."));
        if (!pin.getUserId().equals(me.id())) {
            throw ApiException.forbidden("내가 꽂은 것만 뺄 수 있습니다.");
        }
        pins.delete(pin);
    }

    /* ------------------------------------------------------- 실시간 위치 */

    /**
     * 지금 자리를 알립니다.
     *
     * <p>보낼 때마다 기한을 다시 셉니다. 쓰는 동안에는 이어지고, 앱을 닫으면
     * 그때부터 정해진 시간 뒤에 사라집니다.
     *
     * <p>한 사람당 한 줄을 덮어씁니다. 지나온 자리는 남지 않습니다.
     */
    @Transactional
    public void share(AuthPrincipal me, String tripId, Double lat, Double lng, Double accuracy) {
        access.requireCanRead(tripId, me.id());
        Coordinates at = Coordinates.of(lat, lng);

        TripLocation row = locations.findById(new TripLocation.Key(tripId, me.id()))
                .orElseGet(() -> new TripLocation(tripId, me.id()));
        row.moveTo(at.lat(), at.lng(), accuracy, Instant.now().plus(SHARE_WINDOW));
        locations.save(row);
    }

    /** 그만둡니다. 줄을 지웁니다 — 꺼 두고 남겨 둘 이유가 없습니다. */
    @Transactional
    public void stop(AuthPrincipal me, String tripId) {
        locations.deleteByTripIdAndUserId(tripId, me.id());
    }

    /**
     * 지금 켜 둔 동행자들.
     *
     * <p>내 자리는 돌려주지 않습니다. 내가 어디 있는지는 내 기기가 이미 알고,
     * 서버를 거쳐 되돌아오면 한 박자 늦은 자리가 보입니다.
     */
    @Transactional
    public List<Where> whereEveryone(AuthPrincipal me, String tripId) {
        access.requireCanRead(tripId, me.id());
        locations.sweep(tripId, Instant.now());

        List<Where> out = new ArrayList<>();
        for (TripLocation row : locations.findAllByTripIdAndExpiresAtAfter(tripId, Instant.now())) {
            if (row.getUserId().equals(me.id())) {
                continue;
            }
            out.add(new Where(row.getUserId(), nameOf(row.getUserId()),
                    row.getLat(), row.getLng(), row.getAccuracy(), row.getUpdatedAt()));
        }
        return out;
    }

    /** 내가 지금 켜 두었는지. 켜 놓고 잊는 일이 없게 화면이 물어봅니다. */
    @Transactional(readOnly = true)
    public boolean sharing(AuthPrincipal me, String tripId) {
        return locations.findById(new TripLocation.Key(tripId, me.id()))
                .filter(row -> row.getExpiresAt().isAfter(Instant.now()))
                .isPresent();
    }

    private String nameOf(String userId) {
        return users.findById(userId).map(User::getName).orElse("알 수 없음");
    }

    public record Pin(String id, double lat, double lng, String label,
                      String authorName, boolean mine, Instant createdAt, Instant expiresAt) {
    }

    public record Where(String userId, String name, double lat, double lng,
                        Double accuracy, Instant updatedAt) {
    }
}
