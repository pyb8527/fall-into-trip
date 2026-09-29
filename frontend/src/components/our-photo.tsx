import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { API_BASE } from '@/api/client';
import { Colors, Radius } from '@/constants/theme';

/**
 * 우리가 받아 둔 사진 한 장.
 *
 * <h3>구글 사진과 다릅니다</h3>
 *
 * <p>{@link PlacePhoto} 는 구글이 가진 그림이라 주소를 그때그때 풀어야 합니다.
 * 이쪽은 우리 서버에 있는 것이라 번호가 곧 주소입니다 — 물어볼 것이 없습니다.
 *
 * <h3>토큰을 안 붙입니다</h3>
 *
 * <p>그림을 받아 오는 것은 우리 코드가 아니라 브라우저라 토큰을 붙일 자리가
 * 없습니다. 그래서 사진 보기는 로그인 없이 열어 두었습니다(SecurityConfig).
 * 번호는 아홉 바이트 난수라 찍어서 맞힐 수 있는 값이 아닙니다.
 */
export function OurPhoto({
  id,
  width,
  height,
  style,
}: {
  id: string | null | undefined;
  width?: number;
  height: number;
  style?: object;
}) {
  if (!id) {
    return null;
  }
  return (
    <View style={[styles.frame, { height, width: width ?? '100%' }, style]}>
      <Image
        source={{ uri: `${API_BASE}/api/photos/${id}` }}
        style={styles.photo}
        contentFit="cover"
        transition={180}
        accessibilityLabel="남긴 사진"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    /* 받아 오는 동안 비어 있는 자리. 흰 바탕에 흰 자리를 두면 그림이 뜰 때
       화면이 덜컥합니다. */
    backgroundColor: Colors.fill,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
});
