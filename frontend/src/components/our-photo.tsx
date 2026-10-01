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
    borderRadius: Radius.r3,
    overflow: 'hidden',
    /* 받아 오는 동안 비어 있는 자리. 흰 바탕에 흰 자리를 두면 그림이 뜰 때
       화면이 덜컥합니다. */
    backgroundColor: Colors.fill,
    /*
      테두리 한 겹.

      <p>흰 카드 위에 밝은 사진을 놓으면 어디까지가 사진인지 안 보입니다 —
      하늘이나 눈밭이 찍힌 장은 종이에 녹아 버려서, 사진이 있는지조차
      모르고 지나갑니다.

      <p>선은 가장 얇은 것으로 둡니다. 굵게 두르면 사진이 액자에 갇혀
      보이고, 목록에 여러 장이 서면 선이 먼저 눈에 들어옵니다.
    */
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
});
