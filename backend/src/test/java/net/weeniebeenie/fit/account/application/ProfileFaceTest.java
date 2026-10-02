package net.weeniebeenie.fit.account.application;

import net.weeniebeenie.fit.account.domain.Role;
import net.weeniebeenie.fit.account.domain.User;
import net.weeniebeenie.fit.account.domain.UserRepository;
import net.weeniebeenie.fit.account.infrastructure.security.AuthPrincipal;
import net.weeniebeenie.fit.feed.domain.PostRepository;
import net.weeniebeenie.fit.group.domain.GroupMemberRepository;
import net.weeniebeenie.fit.group.domain.GroupRepository;
import net.weeniebeenie.fit.photo.application.PhotoService;
import net.weeniebeenie.fit.photo.domain.Photo;
import net.weeniebeenie.fit.photo.domain.PhotoRepository;
import net.weeniebeenie.fit.shared.error.ApiException;
import net.weeniebeenie.fit.tip.domain.PlaceTipRepository;
import net.weeniebeenie.fit.trip.domain.DayRepository;
import net.weeniebeenie.fit.trip.domain.TripRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 프로필 얼굴 사진 — <b>남의 사진을 끼울 수 있나</b>와 <b>몫이 쌓이나</b>.
 *
 * <h3>남의 번호를 박아 넣을 수 있으면 안 됩니다</h3>
 *
 * <p>얼굴 사진은 번호 한 줄로 가리킵니다. 그 번호가 내 것인지 안 보면, 남이
 * 올린 가족 사진이 <b>내 프로필에 섭니다.</b> 올린 사람은 그 일이 일어난 것을
 * 모르고, 알아도 되돌릴 자리가 없습니다. 번호는 열여섯 글자 난수라 찍어서
 * 맞히기 어렵지만, 어렵다는 것이 막았다는 뜻은 아닙니다.
 *
 * <h3>없는 것과 남의 것이 같은 말이어야 합니다</h3>
 *
 * <p>「남의 사진이에요」는 <b>있다는 말</b>입니다. 번호를 하나씩 넣어 보면
 * 어느 것이 실제로 올라간 사진인지 가려낼 수 있고, 그것이 곧 남이 사진을 몇
 * 장 올려 두었는지 세는 길이 됩니다. {@code FeedService.minePhotos} 가 쓰는
 * 「그런 사진이 없어요.」 한 마디로 둘을 덮습니다.
 *
 * <p>눈으로는 안 갈립니다. 둘 다 화면에 빨간 줄 하나로 보입니다.
 *
 * <h3>바꾼 횟수만큼 쌓이면 안 됩니다</h3>
 *
 * <p>얼굴 사진도 사람당 1000장을 함께 먹습니다. 얼굴은 <b>바꾸는</b> 것이라
 * 옛 장을 안 지우면 스무 번 바꾼 사람이 스무 장을 먹습니다. 바꿔 끼운 뒤에
 * <b>옛 장</b>을 지우는지, 그리고 방금 끼운 새 장을 지우지는 않는지를 봅니다 —
 * 그 둘을 헷갈리면 올린 사진이 그 자리에서 사라집니다.
 */
@ExtendWith(MockitoExtension.class)
class ProfileFaceTest {

    private static final String ME = "u-me";
    private static final String THEM = "u-them";

    @Mock private UserRepository users;
    @Mock private TripRepository trips;
    @Mock private PostRepository posts;
    @Mock private PlaceTipRepository tips;
    @Mock private GroupMemberRepository members;
    @Mock private GroupRepository groupBook;
    @Mock private DayRepository days;
    @Mock private PhotoRepository photos;
    @Mock private PhotoService photoBook;

    @InjectMocks private ProfileService profiles;

    private static final AuthPrincipal I_AM =
            new AuthPrincipal(ME, "me@local.test", "나", Role.MEMBER);

    private User me() {
        User user = User.builder()
                .email("me@local.test")
                .name("나")
                .passwordHash("x")
                .role(Role.MEMBER)
                .build();
        /* 레포지토리가 내 번호로 찾아 줄 사람입니다. of() 도 같은 것을 씁니다. */
        when(users.findById(ME)).thenReturn(Optional.of(user));
        return user;
    }

    private Photo photoOf(String ownerId) {
        return Photo.builder().ownerId(ownerId).bytes(1).width(1).height(1).build();
    }

    @Test
    @DisplayName("남의 사진 번호는 끼워지지 않는다")
    void theirPhotoIsRefused() {
        User user = me();
        Photo theirs = photoOf(THEM);
        when(photos.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        ApiException thrown = assertThrows(ApiException.class,
                () -> profiles.edit(I_AM, null, null, theirs.getId()));

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
        /* 얼굴은 안 바뀌어야 합니다 — 거절하면서 끼워 두면 거절한 뜻이 없습니다. */
        assertNull(user.getPhotoId());
        verify(photoBook, never()).drop(any(), anyString());
    }

    @Test
    @DisplayName("없는 번호와 남의 번호가 같은 말로 거절된다")
    void missingAndNotMineReadTheSame() {
        me();
        Photo theirs = photoOf(THEM);
        when(photos.findById(theirs.getId())).thenReturn(Optional.of(theirs));
        when(photos.findById("p-nosuch")).thenReturn(Optional.empty());

        ApiException notMine = assertThrows(ApiException.class,
                () -> profiles.edit(I_AM, null, null, theirs.getId()));
        ApiException missing = assertThrows(ApiException.class,
                () -> profiles.edit(I_AM, null, null, "p-nosuch"));

        /*
          상태와 말이 모두 같아야 합니다. 하나라도 다르면 번호를 넣어 보는
          것으로 「있는데 남의 것」을 가려낼 수 있습니다.
        */
        assertEquals(missing.getStatus(), notMine.getStatus());
        assertEquals(missing.getMessage(), notMine.getMessage());
        assertEquals("그런 사진이 없어요.", notMine.getMessage());
    }

    @Test
    @DisplayName("내 사진은 끼워지고, 옛 장은 지워진다")
    void mineIsSetAndTheOldOneDropped() {
        User user = me();
        Photo was = photoOf(ME);
        Photo now = photoOf(ME);
        user.setPhotoId(was.getId());
        when(photos.findById(now.getId())).thenReturn(Optional.of(now));
        when(photos.findById(was.getId())).thenReturn(Optional.of(was));

        profiles.edit(I_AM, null, null, now.getId());

        assertEquals(now.getId(), user.getPhotoId());
        /* 지워지는 것은 <b>옛</b> 장입니다. 새 장을 지우면 방금 올린 사진이
           그 자리에서 사라집니다. */
        verify(photoBook).drop(I_AM, was.getId());
        verify(photoBook, never()).drop(I_AM, now.getId());
    }

    @Test
    @DisplayName("같은 번호를 다시 보내면 그 사진을 지우지 않는다")
    void resavingTheSameFaceKeepsIt() {
        User user = me();
        Photo same = photoOf(ME);
        user.setPhotoId(same.getId());
        when(photos.findById(same.getId())).thenReturn(Optional.of(same));

        /* 이름만 고치려고 판을 다시 저장하면 얼굴 번호가 그대로 함께 옵니다. */
        profiles.edit(I_AM, "새 이름", null, same.getId());

        assertEquals(same.getId(), user.getPhotoId());
        assertEquals("새 이름", user.getName());
        verify(photoBook, never()).drop(any(), anyString());
    }

    @Test
    @DisplayName("빈 글이면 얼굴을 빼고 그 장을 지운다")
    void blankTakesTheFaceOff() {
        User user = me();
        Photo was = photoOf(ME);
        user.setPhotoId(was.getId());
        when(photos.findById(was.getId())).thenReturn(Optional.of(was));

        profiles.edit(I_AM, null, null, "");

        assertNull(user.getPhotoId());
        verify(photoBook).drop(I_AM, was.getId());
    }

    @Test
    @DisplayName("안 보내면 얼굴을 건드리지 않는다")
    void absentLeavesTheFaceAlone() {
        User user = me();
        Photo was = photoOf(ME);
        user.setPhotoId(was.getId());

        /* 얼굴 칸이 없던 때의 부름입니다 — 그때와 똑같이 돌아야 합니다. */
        profiles.edit(I_AM, null, "먹으러 다니는 여행러", null);

        assertEquals(was.getId(), user.getPhotoId());
        assertEquals("먹으러 다니는 여행러", user.getBio());
        verify(photoBook, never()).drop(any(), anyString());
    }
}
