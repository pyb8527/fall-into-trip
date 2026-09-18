import { StyleSheet, Text, View } from 'react-native';

import type { Maybe } from '@/api/types';
import { Colors, Radius, Type } from '@/constants/theme';

/**
 * 목록에서 여행 하나를 가리키는 표식.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>여행 넷이 나란히 서면 전부 같은 흰 줄이라, <b>이름을 읽어야만</b> 어느
 * 것인지 압니다. 매년 가는 곳이면 이름까지 비슷합니다("오사카", "오사카 2").
 * 색과 그림은 이름을 읽기 전에 눈에 걸립니다.
 *
 * <h3>안 정했으면 아무것도 안 그립니다</h3>
 *
 * <p>비어 있어도 자리를 잡아 두는 방법도 있지만, 그러면 정한 줄과 안 정한
 * 줄이 어긋난 채로 줄지어 섭니다. 아예 안 그리면 지금까지와 똑같은 목록이고,
 * 정한 것만 눈에 걸립니다.
 *
 * <p>색만 정했으면 동그란 색, 그림만 정했으면 회색 바탕에 그림, 둘 다면
 * 그 색 바탕에 그림입니다. 흰 그림자 없이도 이모지는 어떤 색 위에서나
 * 읽힙니다 — 제 색을 가진 그림이라서입니다.
 */
export function TripMark({ theme, emoji }: { theme: Maybe<string>; emoji: Maybe<string> }) {
  if (!theme && !emoji) {
    return null;
  }
  return (
    <View
      style={[styles.tile, theme ? { backgroundColor: theme } : null]}
      /* 읽어 주는 기기에는 안 읽힙니다. 바로 옆에 여행 이름이 있어서,
         "파란 비행기" 를 먼저 읽으면 이름에 닿기까지 한 번 더 걸립니다. */
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /* 갈래 표식(Mark)과 같은 크기입니다. 한 목록에 둘이 같이 설 일은 없지만,
     화면을 옮겨 다닐 때 같은 자리에 같은 크기가 서야 눈이 안 흔들립니다. */
  tile: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  emoji: {
    ...Type.bodySmall,
  },
});
