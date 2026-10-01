import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import { API_BASE } from '@/api/client';
import { Colors, Radius } from '@/constants/theme';

/**
 * 한 자리를 그린 지도 그림.
 *
 * <h3>왜 살아 있는 지도를 안 쓰는가</h3>
 *
 * <p>장소 상세 판에 상호작용 지도를 띄우고 있었습니다. 그런데 거기 지도는
 * 누를 것도 이을 것도 없었습니다 — {@code onSelect} 가 빈 함수였고
 * {@code link} 가 꺼져 있었습니다. 어디쯤인지만 보여 주면 되는 자리입니다.
 *
 * <p>Maps JavaScript 는 <b>지도가 뜰 때마다</b> 셉니다. 혼자 쓰는데도 하루
 * 할당량의 20%가 나갔고, 그중 상당수가 이 판이었습니다. 게다가 지도 로딩은
 * 우리가 캐시할 수 없습니다 — 판을 열 때마다 새로 한 장입니다.
 *
 * <p>그림은 서버가 받아서 내보내고 여섯 시간 들고 있습니다
 * (StaticMapService). 같은 장소를 다시 열면 구글에 아예 안 나갑니다.
 *
 * <h3>못 받아 오면 자리를 비웁니다</h3>
 *
 * <p>키가 없거나 할당량이 바닥났으면 그림이 안 옵니다. 회색 상자만 덩그러니
 * 남기느니 아예 빼는 편이 낫습니다 — {@link PostMap} 과 같은 규칙입니다.
 */
export function SpotMap({
  lat,
  lng,
  name,
  height,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** 그림을 못 보는 사람에게 읽어 줄 이름. */
  name: string;
  height: number;
}) {
  const [broken, setBroken] = useState(false);

  if (broken || lat == null || lng == null) {
    return null;
  }

  return (
    <Image
      source={{ uri: `${API_BASE}/api/maps/spot?lat=${lat}&lng=${lng}` }}
      style={[styles.thumb, { height }]}
      resizeMode="cover"
      accessibilityLabel={`${name} 위치`}
      onError={() => setBroken(true)}
    />
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: '100%',
    borderRadius: Radius.md,
    backgroundColor: Colors.fill,
  },
});
