import { StyleSheet } from 'react-native';

import type { Move } from '@/api/types';
import { Colors, Spacing } from '@/constants/theme';
import { openRoute, type Spot } from '@/lib/directions';
import { Caption, Icon, Press } from '@/ui';

/**
 * 장소와 장소 사이에 서는 한 줄 — 「구글 지도로 길찾기 ↗」.
 *
 * <p>이 자리에는 구글이 셈한 「걸어서 12분 · 대중교통 8분 · 택시 6분」 칩이
 * 있었습니다. 숫자가 실제와 자주 안 맞아 걷어냈습니다(까닭은 lib/directions).
 * 대신 두 곳을 구글 지도에 그대로 넘깁니다 — 길 위에서 사람이 어차피 켜는 것이
 * 그 앱입니다.
 *
 * <p>조용하게 둡니다. 장소마다 하나씩 서므로 단추처럼 굵으면 일정보다 이 줄이
 * 먼저 읽힙니다.
 *
 * <p>둘 중 하나라도 자리를 모르면(좌표가 없거나 0,0) 아무것도 안 그립니다 —
 * 엉뚱한 바다에서 출발하는 길을 여는 것보다 없는 편이 낫습니다.
 */
export function RouteLink({
  from,
  to,
  move,
  label = '구글 지도로 길찾기',
  onFail,
}: {
  from: Spot;
  to: Spot;
  /** 출발하는 곳에 적어 둔 이동. 수단과 역을 여기서 읽습니다. */
  move?: Move | null;
  label?: string;
  /** 구글 지도도 브라우저도 못 열었을 때. 화면이 알려 줍니다. */
  onFail: () => void;
}) {
  if (!known(from) || !known(to)) {
    return null;
  }
  return (
    <Press
      onPress={async () => {
        if (!(await openRoute(from, to, move))) {
          onFail();
        }
      }}
      scale={1}
      pressedStyle={styles.pressed}
      accessibilityRole="link"
      accessibilityLabel={`${from.name}에서 ${to.name}까지 ${label}`}
      style={styles.line}>
      <Caption tone="secondary">{label}</Caption>
      <Icon name="external-link" size={12} tone="secondary" />
    </Press>
  );
}

function known(at: Spot) {
  return Number.isFinite(at.lat) && Number.isFinite(at.lng) && !(at.lat === 0 && at.lng === 0);
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s1,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.s1,
    paddingHorizontal: Spacing.s2,
    borderRadius: 8,
  },
  pressed: {
    backgroundColor: Colors.fill,
  },
});
