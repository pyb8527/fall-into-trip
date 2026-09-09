package net.weeniebeenie.fit.trip.api;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.account.infrastructure.security.CurrentUser;
import net.weeniebeenie.fit.trip.application.FolderService;
import net.weeniebeenie.fit.trip.domain.TripFolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 여행을 묶어 두는 폴더.
 *
 * <p>폴더는 여행이 아니라 보는 사람의 것이라, 남의 폴더는 있는지도 알 수
 * 없습니다.
 */
@RestController
@RequiredArgsConstructor
public class FolderController {

    private final FolderService folders;

    @GetMapping("/api/folders")
    public Map<String, Object> list(@CurrentUser AuthPrincipal me) {
        return Map.of("folders", folders.countsOf(me));
    }

    @PostMapping("/api/folders")
    public Map<String, Object> create(@CurrentUser AuthPrincipal me,
                                      @RequestBody NameRequest req) {
        TripFolder folder = folders.create(me, req == null ? null : req.name());
        return Map.of("folder", Map.of("id", folder.getId(), "name", folder.getName()));
    }

    @PatchMapping("/api/folders/{folderId}")
    public Map<String, Object> rename(@CurrentUser AuthPrincipal me,
                                      @PathVariable String folderId,
                                      @RequestBody NameRequest req) {
        TripFolder folder = folders.rename(me, folderId, req == null ? null : req.name());
        return Map.of("folder", Map.of("id", folder.getId(), "name", folder.getName()));
    }

    /** 안에 든 여행은 지우지 않습니다. 넣어 둔 표시만 풀립니다. */
    @DeleteMapping("/api/folders/{folderId}")
    public Map<String, Object> remove(@CurrentUser AuthPrincipal me, @PathVariable String folderId) {
        folders.remove(me, folderId);
        return Map.of("ok", true);
    }

    /**
     * 여행을 폴더에 넣거나 뺍니다.
     *
     * @param req folderId 를 비우면 폴더에서 빼는 것으로 봅니다.
     */
    @PutMapping("/api/trips/{tripId}/folder")
    public Map<String, Object> place(@CurrentUser AuthPrincipal me,
                                     @PathVariable String tripId,
                                     @RequestBody(required = false) PlaceRequest req) {
        folders.place(me, tripId, req == null ? null : req.folderId());
        return Map.of("ok", true);
    }

    public record NameRequest(String name) {
    }

    public record PlaceRequest(String folderId) {
    }
}
