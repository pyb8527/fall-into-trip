import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OurPhoto } from '@/components/our-photo';
import { Radius, Spacing } from '@/constants/theme';
import { Caption } from '@/ui';

/**
 * 한 자리에서 남긴 사진들.
 *
 * <h3>왜 옆으로 넘기는가</h3>
 *
 * <p>다섯 장을 세로로 쌓으면 한 장소가 화면 다섯 개를 먹습니다. 그 사이에
 * 낀 다음 장소는 스크롤로 한참 내려가야 나오고, 그러면 하루의 흐름이
 * 끊깁니다.
 *
 * <p>작게 줄여서 늘어놓는 길도 있었지만 그건 이미 해 봤습니다 — 56픽셀
 * 네모로는 무엇이 찍혔는지 알 수가 없어서 사진이 있으나 없으나 같았습니다.
 *
 * <p>그래서 크기는 그대로 두고 옆으로 넘깁니다. 한 번에 한 장이 제 크기로
 * 서고, 자리는 한 장만큼만 먹습니다.
 *
 * <h3>몇 장인지 먼저 알려 줍니다</h3>
 *
 * <p>옆으로 넘기는 것은 화면에 안 보입니다. 오른쪽 위에 "1/4" 가 없으면
 * 뒤에 석 장이 더 있는 줄을 아무도 모릅니다.
 */
export function PhotoStrip({
  ids,
  height,
  style,
}: {
  ids: string[] | null | undefined;
  height: number;
  style?: object;
}) {
  /* 한 장 너비가 곧 이 자리의 너비입니다. 자리마다 다르니(여행 상세는
     판 안, 여행기는 화면 폭) 재서 씁니다. 재기 전에는 안 그립니다 —
     0으로 한 번 그리면 넘긴 자리가 처음에 어긋납니다. */
  const [wide, setWide] = useState(0);
  const [at, setAt] = useState(0);

  const shots = (ids ?? []).filter(Boolean);
  if (shots.length === 0) {
    return null;
  }
  if (shots.length === 1) {
    return <OurPhoto id={shots[0]} height={height} style={style} />;
  }

  return (
    <View style={[{ height }, style]} onLayout={(e) => setWide(e.nativeEvent.layout.width)}>
      {wide > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          /* 손을 뗀 자리로 몇 번째인지 셉니다. 반 넘게 넘어갔으면 다음
             장으로 봅니다 — 반올림입니다. */
          onMomentumScrollEnd={(e) =>
            setAt(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, wide)))
          }>
          {shots.map((id) => (
            <OurPhoto key={id} id={id} width={wide} height={height} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.count} pointerEvents="none">
        <Caption tone="inverse">
          {Math.min(at + 1, shots.length)}/{shots.length}
        </Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  count: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    /* 사진 위에 얹습니다. 밝은 하늘 위에 흰 글씨를 놓으면 안 보여서
       바탕을 깝니다. 판의 색 하나로는 안 됩니다 — 아래가 사진이라
       비쳐야 하고, 그래서 반투명입니다. */
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
