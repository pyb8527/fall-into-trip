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
 * <h3>색을 꽉 채우지 않습니다</h3>
 *
 * <p>여행 색을 바탕에 가득 칠했습니다. 목록에 넷이 서면 <b>진한 색 네모가
 * 넷</b>이라, 그 줄에서 가장 센 것이 이름도 날짜도 아닌 색 덩어리였습니다.
 * 색은 어느 여행인지를 가리는 이름표일 뿐인데 말입니다.
 *
 * <p>같은 색을 12%만 깝니다. 넷이 나란히 서도 서로 다른 것은 그대로
 * 읽히고, 줄에서 제일 센 것은 다시 여행 이름입니다.
 *
 * <h3>안 정했으면 자리만 비워 둡니다</h3>
 *
 * <p>처음에는 아예 안 그렸습니다. 정한 것만 눈에 걸리게 하려던 것인데,
 * 실제로 목록에 세워 보니 <b>거꾸로였습니다</b> — 표식 없는 줄만 이름이
 * 왼쪽으로 밀려서, 정한 줄과 안 정한 줄이 어긋난 채로 줄지어 섰습니다.
 *
 * <p>자리는 잡되 아무것도 안 그립니다. 줄은 가지런하고, 색과 그림이 있는
 * 것만 눈에 걸립니다.
 */
export function TripMark({ theme, emoji }: { theme: Maybe<string>; emoji: Maybe<string> }) {
  if (!theme && !emoji) {
    /* 빈 자리. 줄을 맞추는 것 말고 하는 일이 없습니다. */
    return <View style={styles.blank} />;
  }
  return (
    <View
      style={[styles.tile, theme ? { backgroundColor: wash(theme) } : null]}
      /* 읽어 주는 기기에는 안 읽힙니다. 바로 옆에 여행 이름이 있어서,
         "파란 비행기" 를 먼저 읽으면 이름에 닿기까지 한 번 더 걸립니다. */
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : theme ? (
        /*
          그림 없이 색만 고른 여행.

          <p>12% 로 깔면 그것만으로는 거의 흰 네모입니다 — 무슨 색을 골랐는지
          알 수 없습니다. 가운데에 제 색 그대로의 동그라미 하나를 둡니다.
          칠한 넓이가 작아서 줄을 집어삼키지 않고, 색은 분명히 보입니다.
        */
        <View style={[styles.dot, { backgroundColor: theme }]} />
      ) : null}
    </View>
  );
}

/**
 * 같은 색을 12% 만.
 *
 * <p>색은 늘 {@code #RRGGBB} 입니다 — 서버가 날짜 색 여덟 가지만 받습니다.
 * 그래서 투명도를 붙이는 데 {@code #RRGGBBAA} 를 쓸 수 있습니다. 안드로이드
 * 와 웹 둘 다 여덟 자리를 읽습니다.
 */
function wash(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}1F` : color;
}

const styles = StyleSheet.create({
  /*
    갈래 표식(Mark)보다 한 단 큽니다.

    <p>Mark 는 장소 하나의 갈래를 가리키는 동그라미(40)이고, 이것은 여행
    하나를 가리킵니다. 여행 목록의 한 줄은 88 이라 그 안에서 40 은 작습니다.
  */
  tile: {
    width: 48,
    height: 48,
    borderRadius: Radius.r3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  emoji: {
    /* 그림은 글자가 아니라 그림입니다. 줄의 제목(16)보다 커야 표식으로
       읽히고, 작으면 이름 앞에 붙은 글자 하나처럼 보입니다. */
    ...Type.title3,
    fontSize: 24,
    lineHeight: 28,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: Radius.full,
  },
  blank: {
    width: 48,
    height: 48,
  },
});
