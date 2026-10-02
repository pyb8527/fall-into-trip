import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { API_BASE } from '@/api/client';
import { Colors, Radius } from '@/constants/theme';

/**
 * 사람이나 모임의 얼굴 한 칸.
 *
 * <h3>사진과 표식이 같은 자리에 섭니다</h3>
 *
 * <p>얼굴은 지금까지 이모지 하나였습니다(사람은 {@code user-marks} 의 동물,
 * 모임은 골라 둔 표식). 사진을 받게 되면 <b>둘이 섞여 서는 자리</b>가 생깁니다 —
 * 어떤 사람은 사진, 어떤 사람은 토끼, 아무것도 안 고른 사람은 빈 칸입니다.
 *
 * <p>그 가름을 화면마다 적어 두면 세 갈래가 자리마다 조금씩 다르게 생깁니다.
 * 마이페이지의 얼굴은 64이고 모임 목록의 것은 40인데, 테두리와 바탕이
 * 한쪽만 다른 날이 옵니다. 한 칸으로 묶습니다.
 *
 * <h3>자르지 않고 덮어 그립니다</h3>
 *
 * <p>{@code cover} 입니다. 긴 사진이 와도 네모 칸을 꽉 채우고 넘치는 쪽이
 * 잘립니다 — 늘여서 찌그러뜨리는 것보다 낫고, 무엇보다 <b>올릴 때 네모로
 * 자르지 못한 사진</b>도 이 자리에서는 네모로 보입니다(브라우저에는 자르는
 * 판이 없습니다 — {@code lib/pick-square.web.ts}).
 *
 * <h3>왜 {@link OurPhoto} 를 안 쓰나</h3>
 *
 * <p>그쪽은 <b>남긴 사진</b>을 세우는 칸입니다. 네모가 아니라 가로로 긴
 * 자리를 맡고, 둥근 모서리가 r3 이며, 「남긴 사진」이라는 이름표를 답니다.
 * 얼굴은 동그라미이고 이름표도 달라야 합니다 — 화면 읽어 주는 기계에게
 * 「남긴 사진」이라고 말하면 그것이 사람의 얼굴인지 알 수가 없습니다.
 */
export function ProfileFace({
  /** 올려 둔 얼굴 사진. 없으면 아래 표식이 섭니다. */
  photoId,
  /**
   * 사진이 없을 때 그릴 이모지 한 글자.
   *
   * <p>사람은 {@code markOf(user.mark)}, 모임은 골라 둔 표식입니다. 어느
   * 쪽인지는 부르는 쪽이 압니다 — 여기서 가리려면 이 칸이 두 저장소를
   * 다 알아야 합니다.
   */
  mark,
  /** 둘 다 없을 때 세울 것. 로고나 이름 첫 글자. */
  fallback,
  size = 64,
  /** 화면 읽어 주는 기계에게. 「지영의 얼굴」처럼 누구인지까지 말합니다. */
  label,
}: {
  photoId?: string | null;
  mark?: string | null;
  fallback?: React.ReactNode;
  size?: number;
  label: string;
}) {
  return (
    <View
      style={[styles.face, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}>
      {photoId ? (
        <Image
          source={{ uri: `${API_BASE}/api/photos/${photoId}` }}
          style={styles.photo}
          contentFit="cover"
          transition={180}
        />
      ) : mark ? (
        /* 이모지는 칸의 절반쯤이 보기 좋습니다. 꽉 채우면 글꼴이 제 높이를
           가져서 아래로 처집니다. */
        <Text style={[styles.mark, { fontSize: Math.round(size * 0.47) }]}>{mark}</Text>
      ) : (
        fallback
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    borderRadius: Radius.full,
    /* 받아 오는 동안 비어 있는 자리. 흰 바탕에 흰 자리를 두면 사진이 뜰 때
       화면이 덜컥합니다. */
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
    /* 사진이 동그라미 밖으로 안 나가게. */
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  mark: {
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
});
