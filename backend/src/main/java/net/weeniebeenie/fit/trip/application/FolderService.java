package net.weeniebeenie.fit.trip.application;

import lombok.RequiredArgsConstructor;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.trip.domain.TripFolder;
import net.weeniebeenie.fit.trip.domain.TripFolderItem;
import net.weeniebeenie.fit.trip.domain.TripFolderItemRepository;
import net.weeniebeenie.fit.trip.domain.TripFolderRepository;
import net.weeniebeenie.fit.trip.domain.TripMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 여행을 묶어 두는 폴더.
 *
 * <p>폴더는 여행이 아니라 <b>보는 사람</b>의 것입니다. "제주 갈 때마다" 처럼
 * 자기만 아는 묶음이 있고, 같이 간 사람도 자기 식대로 정리합니다.
 */
@Service
@RequiredArgsConstructor
public class FolderService {

    /**
     * 한 사람이 만들 수 있는 폴더의 수.
     *
     * <p>폴더가 화면 하나를 넘어가면 정리하려고 만든 것이 오히려 찾기를
     * 어렵게 합니다.
     */
    private static final int MAX_FOLDERS = 20;

    private final TripFolderRepository folders;
    private final TripFolderItemRepository items;
    private final TripMemberRepository members;

    @Transactional(readOnly = true)
    public List<TripFolder> listOf(AuthPrincipal me) {
        return folders.findAllByUserIdOrderBySortAscCreatedAtAsc(me.id());
    }

    /** 여행 id → 폴더 id. 목록 화면이 한 번에 묶어 보여 주려고 씁니다. */
    @Transactional(readOnly = true)
    public Map<String, String> placementOf(AuthPrincipal me) {
        Map<String, String> out = new HashMap<>();
        for (TripFolderItem item : items.findAllByUserId(me.id())) {
            out.put(item.getTripId(), item.getFolderId());
        }
        return out;
    }

    @Transactional
    public TripFolder create(AuthPrincipal me, String name) {
        String clean = clean(name);
        if (folders.countByUserId(me.id()) >= MAX_FOLDERS) {
            throw ApiException.badRequest("폴더는 " + MAX_FOLDERS + "개까지 만들 수 있습니다.");
        }
        folders.findByUserIdAndName(me.id(), clean).ifPresent(f -> {
            throw ApiException.badRequest("같은 이름의 폴더가 이미 있습니다.");
        });
        return folders.save(TripFolder.builder()
                .userId(me.id())
                .name(clean)
                .sort((int) folders.countByUserId(me.id()))
                .build());
    }

    @Transactional
    public TripFolder rename(AuthPrincipal me, String folderId, String name) {
        TripFolder folder = mine(me, folderId);
        String clean = clean(name);
        folders.findByUserIdAndName(me.id(), clean).ifPresent(other -> {
            if (!other.getId().equals(folderId)) {
                throw ApiException.badRequest("같은 이름의 폴더가 이미 있습니다.");
            }
        });
        folder.setName(clean);
        return folder;
    }

    /**
     * 폴더를 지웁니다.
     *
     * <p>안에 든 여행은 지우지 않습니다. 폴더는 정리하는 방식일 뿐이라, 묶음을
     * 없앤다고 여행까지 사라지면 무서워서 못 씁니다. 넣어 둔 표시만 풀립니다.
     */
    @Transactional
    public void remove(AuthPrincipal me, String folderId) {
        folders.delete(mine(me, folderId));
    }

    /**
     * 여행을 폴더에 넣거나 뺍니다.
     *
     * @param folderId 비우면 폴더에서 빼는 것으로 봅니다.
     */
    @Transactional
    public void place(AuthPrincipal me, String tripId, String folderId) {
        /* 내가 볼 수 있는 여행만 정리할 수 있습니다. 남의 여행 id 를 넣어
           내 폴더에 담아 두는 길을 열어 둘 이유가 없습니다. */
        if (members.findByIdTripIdAndIdUserId(tripId, me.id()).isEmpty()) {
            throw ApiException.notFound("여행을 찾을 수 없습니다.");
        }

        if (folderId == null || folderId.isBlank()) {
            items.deleteByUserIdAndTripId(me.id(), tripId);
            return;
        }
        mine(me, folderId);
        items.save(new TripFolderItem(me.id(), tripId, folderId));
    }

    /** 폴더마다 몇 개 들었는지. 빈 폴더인지 아닌지가 보여야 지울지 정합니다. */
    @Transactional(readOnly = true)
    public List<Counted> countsOf(AuthPrincipal me) {
        List<Counted> out = new ArrayList<>();
        for (TripFolder folder : listOf(me)) {
            out.add(new Counted(folder.getId(), folder.getName(),
                    (int) items.countByFolderId(folder.getId())));
        }
        return out;
    }

    private TripFolder mine(AuthPrincipal me, String folderId) {
        TripFolder folder = folders.findById(folderId)
                .orElseThrow(() -> ApiException.notFound("폴더를 찾을 수 없습니다."));
        if (!folder.getUserId().equals(me.id())) {
            /* 남의 폴더가 있다는 것 자체를 알릴 이유가 없습니다. */
            throw ApiException.notFound("폴더를 찾을 수 없습니다.");
        }
        return folder;
    }

    private static String clean(String name) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("폴더 이름을 넣어 주세요.");
        }
        if (clean.length() > 40) {
            throw ApiException.badRequest("폴더 이름이 너무 깁니다.");
        }
        return clean;
    }

    public record Counted(String id, String name, int tripCount) {
    }
}
