package net.weeniebeenie.fit.tip.application;

import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.support.audit.AuditService;
import net.weeniebeenie.fit.tip.domain.PlaceTip;
import net.weeniebeenie.fit.tip.domain.PlaceTipRepository;
import net.weeniebeenie.fit.tip.domain.PlaceTipViewRepository;
import net.weeniebeenie.fit.tip.domain.TipReportRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 남긴 별점과 한 줄 고치기 — 자격과 처음 쓴 때.
 *
 * <h3>지울 수 있는 사람이 고칠 수 있는 사람보다 넓습니다</h3>
 *
 * <p>{@code remove} 는 운영자도 할 수 있습니다. {@code edit} 은 <b>남긴 사람
 * 하나</b>입니다 — 문제되는 글에 운영자가 할 수 있는 일은 감추는 것이고, 말을
 * 바꿔 두면 신고한 사람이 본 글과 확인하는 사람이 보는 글이 달라집니다.
 *
 * <p>두 메서드가 나란히 서 있어서 지우기 쪽 조건({@code me.role() != ADMIN})을
 * 그대로 베껴 오는 것이 가장 자연스러운 손놀림입니다. 그러면 운영 화면이
 * 남의 리뷰를 다듬어 쓰는 자리가 됩니다.
 *
 * <h3>처음 쓴 때는 안 건드립니다</h3>
 *
 * <p>{@code createdAt} 에 두 가지가 매여 있습니다 — 이레 기한
 * ({@code TipService.FRESH})과 줄 순서. 고칠 때마다 새로 찍으면 같은 한 줄을
 * 다시 저장하는 것만으로 장소 맨 위에 영원히 세워 둘 수 있고, 그것은
 * {@code MAX_PER_DAY} 로 막아 둔 도배와 같은 일입니다. 이 시험이 그 자리를
 * 지킵니다 — 「고쳤으면 새로 쓴 것으로 치자」는 한 줄짜리 고침이고, 그것이
 * 열어 주는 문은 한 줄로 안 보입니다.
 */
@ExtendWith(MockitoExtension.class)
class TipEditTest {

    private static final String ME = "u-me";
    private static final String THEM = "u-them";

    private static final String TEXT = "지금 대기 40분";

    @Mock private PlaceTipRepository tips;
    @Mock private PlaceTipViewRepository views;
    @Mock private TipReportRepository reports;
    @Mock private UserRepository users;
    @Mock private AuditService audit;

    @InjectMocks private TipService service;

    private AuthPrincipal who(String id, Role role) {
        return new AuthPrincipal(id, id + "@example.com", id, role);
    }

    private PlaceTip tipBy(String userId, Integer stars) {
        return PlaceTip.builder()
                .placeId("ChIJ-ichiran")
                .userId(userId)
                .text(TEXT)
                .stars(stars)
                .build();
    }

    @Test
    @DisplayName("남이 남긴 것은 못 고친다")
    void othersAreNotEditable() {
        PlaceTip theirs = tipBy(THEM, 2);
        when(tips.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.MEMBER), theirs.getId(), "별로였어요", 1));

        assertEquals(HttpStatus.FORBIDDEN, thrown.getStatus());
        assertEquals("내가 남긴 것만 고칠 수 있어요.", thrown.getMessage());
        /* 거절하면서 먼저 써 두면 거절한 뜻이 없습니다. 별도 그대로입니다 —
           별 하나가 바뀌면 그 장소의 평균이 바뀝니다. */
        assertEquals(TEXT, theirs.getText());
        assertEquals(2, theirs.getStars());
        assertNull(theirs.getEditedAt());
        verify(audit, never()).log(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("운영자도 못 고친다 — 할 수 있는 일은 감추는 것")
    void adminCannotEdit() {
        PlaceTip theirs = tipBy(THEM, 1);
        when(tips.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.ADMIN), theirs.getId(), "다듬어 둠", 3));

        assertEquals(HttpStatus.FORBIDDEN, thrown.getStatus());
        assertEquals(TEXT, theirs.getText());
        assertEquals(1, theirs.getStars());
    }

    @Test
    @DisplayName("내 것은 고쳐지고, 처음 쓴 때는 그대로 남는다")
    void mineIsEditableAndKeepsCreatedAt() {
        PlaceTip mine = tipBy(ME, 3);
        java.time.Instant written = mine.getCreatedAt();
        when(tips.findById(mine.getId())).thenReturn(Optional.of(mine));

        PlaceTip edited = service.edit(who(ME, Role.MEMBER), mine.getId(), "  지금 대기 10분  ", 5);

        assertEquals("지금 대기 10분", edited.getText());
        assertEquals(5, edited.getStars());
        assertNotNull(edited.getEditedAt());
        /* 처음 쓴 때를 새로 찍으면 같은 한 줄을 다시 저장하는 것만으로 장소
           맨 위에 영원히 세워 둘 수 있습니다. */
        assertEquals(written, edited.getCreatedAt());
        assertFalse(edited.getCreatedAt().isAfter(edited.getEditedAt()));
        verify(audit).log(ME, "tip.edit", mine.getId());
    }

    @Test
    @DisplayName("별만 떼어 낼 수 있다 — 잘못 누른 별 하나를 거두는 길")
    void starsCanBeTakenBack() {
        PlaceTip mine = tipBy(ME, 1);
        when(tips.findById(mine.getId())).thenReturn(Optional.of(mine));

        PlaceTip edited = service.edit(who(ME, Role.MEMBER), mine.getId(), TEXT, null);

        /* 비어 있으면 「안 준 것」입니다 — 0 이 아닙니다. 평균에서도
           빠집니다(PlaceTipRepository.starsOf 가 stars IS NOT NULL 만 셉니다). */
        assertNull(edited.getStars());
        assertEquals(TEXT, edited.getText());
    }

    @Test
    @DisplayName("별도 글도 없으면 거절한다 — 그것은 지우는 일입니다")
    void emptyBothIsRejected() {
        PlaceTip mine = tipBy(ME, 4);
        when(tips.findById(mine.getId())).thenReturn(Optional.of(mine));

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.MEMBER), mine.getId(), "  ", null));

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
        assertEquals("별점을 주거나 한 줄을 남겨 주세요.", thrown.getMessage());
        assertEquals(4, mine.getStars());
    }

    @Test
    @DisplayName("별은 1에서 5 밖으로 못 나간다")
    void starsStayInRange() {
        PlaceTip mine = tipBy(ME, 3);
        when(tips.findById(mine.getId())).thenReturn(Optional.of(mine));

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.MEMBER), mine.getId(), TEXT, 6));

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
        assertEquals(3, mine.getStars());
    }

    @Test
    @DisplayName("없는 것에는 404")
    void missingIsNotFound() {
        when(tips.findById("t-ghost")).thenReturn(Optional.empty());

        ApiException thrown = assertThrows(ApiException.class,
                () -> service.edit(who(ME, Role.MEMBER), "t-ghost", TEXT, 3));

        assertEquals(HttpStatus.NOT_FOUND, thrown.getStatus());
    }

    @Test
    @DisplayName("고치는 것은 하루 세 번에 안 걸린다")
    void editIsNotRateLimited() {
        PlaceTip mine = tipBy(ME, 3);
        when(tips.findById(mine.getId())).thenReturn(Optional.of(mine));

        service.edit(who(ME, Role.MEMBER), mine.getId(), "지금 대기 10분", 3);

        /* 거기서 막으면 세 번을 채운 사람이 제 오타를 다음 날까지 못
           고칩니다. 고치는 것은 수를 늘리지 않습니다. */
        verify(tips, never()).countByUserIdAndPlaceIdAndCreatedAtAfter(
                anyString(), anyString(), org.mockito.ArgumentMatchers.any());
    }
}
