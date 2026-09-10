import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import { API_BASE } from '@/api/client';
import { Colors, Radius } from '@/constants/theme';

/**
 * 올라온 일정의 동선 한 장.
 *
 * <p>서버가 구글에서 받아 우리 주소로 내보냅니다. 브라우저에 키가 나가지
 * 않고, 목록에 살아 있는 지도를 여럿 얹지 않아도 됩니다.
 *
 * <p>키를 안 넣어 두었거나 좌표가 하나도 없는 일정이면 못 받아 옵니다.
 * 그때 자리를 그대로 두면 회색 상자만 덩그러니 남으므로 아예 비웁니다.
 *
 * <p>같은 것이 목록·상세·문 세 군데에 각각 복사되어 있었습니다. 한 곳을
 * 고치면 나머지 둘이 남는 모양이라 여기로 모았습니다.
 */
export function PostMap({
  postId,
  title,
  height,
}: {
  postId: string;
  /** 그림을 못 보는 사람에게 읽어 줄 이름. */
  title: string;
  height: number;
}) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return null;
  }
  return (
    <Image
      source={{ uri: `${API_BASE}/api/posts/${postId}/map` }}
      style={[styles.thumb, { height }]}
      resizeMode="cover"
      accessibilityLabel={`${title} 동선`}
      onError={() => setBroken(true)}
    />
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: '100%',
    borderRadius: Radius.none,
    backgroundColor: Colors.fill,
  },
});
