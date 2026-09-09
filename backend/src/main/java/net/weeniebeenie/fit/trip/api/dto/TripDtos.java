package net.weeniebeenie.fit.trip.api.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import net.weeniebeenie.fit.trip.application.TripService;
import net.weeniebeenie.fit.trip.domain.Day;
import net.weeniebeenie.fit.trip.domain.Place;
import net.weeniebeenie.fit.trip.domain.Trip;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * 화면에 내려보낼 모양.
 *
 * 엔티티를 그대로 내보내지 않습니다. DB 구조가 바뀔 때마다 프론트가 흔들리고,
 * 내보내면 안 되는 값이 딸려 나가기 쉽습니다.
 */
public final class TripDtos {

    private TripDtos() {
    }

    /* ------------------------------------------------------------ 요청 */

    /**
     * 여행을 밑그림 삼아 새로 하나.
     *
     * <p>이름은 비워도 됩니다 — 그러면 원래 이름 뒤에 "(사본)" 을 붙입니다.
     * 날짜는 반드시 받습니다. 지난 날짜를 물려받으면 만들자마자 다녀온
     * 여행이 되기 때문입니다.
     */
    public record DuplicateTripRequest(
            @Size(max = 120, message = "여행 이름이 너무 깁니다.")
            String title,

            @NotBlank(message = "언제 떠날지 정해 주세요.")
            String startIso) {
    }

    public record CreateTripRequest(
            @NotBlank(message = "여행 이름을 지어 주세요.")
            @Size(max = 120, message = "여행 이름이 너무 깁니다.")
            String title,

            @NotBlank(message = "시작일을 넣어 주세요.")
            String startIso,

            @Min(value = 0, message = "숙박일은 0 이상이어야 합니다.")
            @Max(value = 30, message = "숙박일이 너무 깁니다.")
            Integer nights) {

        public int nightsOrZero() {
            return nights == null ? 0 : nights;
        }
    }

    public record UpdateTripRequest(String title, String startIso) {
    }

    public record CreateDayRequest(String tripId, String iso, String label, String shortName) {
    }

    public record UpdateDayRequest(String label, String shortName, String iso, String theme,
                                   String color, String budget, String flight,
                                   Long version) {
    }

    public record ReorderRequest(
            @NotBlank(message = "날짜를 지정해 주세요.") String dayId,
            List<String> placeIds) {
    }

    /* ------------------------------------------------------------ 응답 */

    /**
     * @param folderId 이 사람이 넣어 둔 폴더. 안 넣었으면 비어 있습니다.
     */
    public record TripSummaryView(String id, String title, String ownerId, String folderId,
                                  LocalDate startIso, LocalDate endIso,
                                  int dayCount, int placeCount) {

        public static TripSummaryView of(TripService.TripSummary s, String folderId) {
            return new TripSummaryView(s.id(), s.title(), s.ownerId(), folderId,
                    s.startIso(), s.endIso(), s.dayCount(), s.placeCount());
        }
    }

    public record TripView(String id, String title, String ownerId, Instant createdAt) {

        public static TripView of(Trip t) {
            return new TripView(t.getId(), t.getTitle(), t.getOwnerId(), t.getCreatedAt());
        }
    }

    public record DayView(String id, int sort, String label, String shortName, String date,
                          LocalDate iso, String theme, String color, String budget,
                          Object flight, long version, List<PlaceView> places) {
    }

    public record PlaceView(String id, int sort, String name, String ja, String en,
                            double lat, double lng, String cat, String time, String cost,
                            String note, String url, Integer radius, boolean fit,
                            Object move, String placeId, String icon,
                            Instant updatedAt, String updatedBy, long version) {
    }

    /* JSON 으로 저장된 칸은 문자열이 아니라 객체로 내보냅니다. 프론트가 다시
       파싱하게 두면 어디선가 한 번은 빠뜨립니다. */
    public static DayView dayView(Day d, List<Place> places, ObjectMapper mapper) {
        return new DayView(d.getId(), d.getSort(), d.getLabel(), d.getShortName(), d.getDate(),
                d.getIso(), d.getTheme(), d.getColor(), d.getBudget(),
                json(d.getFlight(), mapper), d.getVersion(),
                places.stream().map(p -> placeView(p, mapper)).toList());
    }

    public static PlaceView placeView(Place p, ObjectMapper mapper) {
        return new PlaceView(p.getId(), p.getSort(), p.getName(), p.getJa(), p.getEn(),
                p.getLat(), p.getLng(), p.getCat(), p.getTime(), p.getCost(), p.getNote(),
                p.getUrl(), p.getRadius(), p.isFit(), json(p.getMove(), mapper),
                p.getPlaceId(), p.getIcon(),
                p.getUpdatedAt(), p.getUpdatedBy(), p.getVersion());
    }

    private static Object json(String raw, ObjectMapper mapper) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return mapper.readValue(raw, Object.class);
        } catch (Exception e) {
            return null;
        }
    }
}
