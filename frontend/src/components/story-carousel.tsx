import { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { Story } from '@/api/types';
import { StoryBlock } from '@/components/story-block';
import { Colors, Spacing } from '@/constants/theme';

/**
 * 한 장소 밑에 걸린 피드 글들 — 여러 편이면 옆으로 넘깁니다.
 *
 * <h3>왜 옆으로 넘기는가</h3>
 *
 * <p>{@link PhotoStrip} 과 같은 뜻입니다 — 세 편을 세로로 쌓으면 그 장소
 * 하나가 화면 몇 개를 먹고, 다음 장소는 그만큼 멀어집니다. 한 번에 한 편이
 * 제 크기로 서고, 자리는 한 편만큼만 먹습니다.
 *
 * <h3>사진과 다른 점 — 높이가 글마다 다릅니다</h3>
 *
 * <p>사진은 미리 높이를 정해 두고 그 안에 채웁니다. 글은 사진 장수도
 * 다르고 글자 길이도 달라 <b>미리 정할 높이가 없습니다</b>. 그래서 한
 * 번은 각 카드를 재 보고, 그중 가장 큰 높이로 판을 맞춥니다 — 재기
 * 전에는 첫 카드 하나만 그려 둡니다.
 *
 * <p>작은 카드가 큰 카드 자리에 맞춰지면서 아래가 비는 것은 받아들입니다.
 * 카드마다 판이 출렁이는 것보다는 낫습니다.
 *
 * <h3>"1/N" 대신 점</h3>
 *
 * <p>사진 띠는 사진 위에 수를 얹습니다. 이 카드는 흰 바탕 글이라 그 위에
 * 뱃지를 얹으면 글을 가립니다. 카드 아래 점으로 몇째 편인지만 보입니다.
 */
export function StoryCarousel({ stories }: { stories: Story[] }) {
  const [wide, setWide] = useState(0);
  const [tall, setTall] = useState(0);
  const [at, setAt] = useState(0);
  const heights = useRef<number[]>([]);

  if (stories.length === 0) {
    return null;
  }
  if (stories.length === 1) {
    return <StoryBlock story={stories[0]} />;
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, wide));
    if (now !== at) {
      setAt(Math.min(Math.max(now, 0), stories.length - 1));
    }
  };

  /* 카드마다 재서 가장 큰 것으로 판 높이를 맞춥니다. 전부 한 번에 그려지므로
     (가로로 미는 것일 뿐, 숨은 카드도 다 그려져 있습니다) 거의 한 번에
     끝납니다. */
  const measured = (i: number, h: number) => {
    heights.current[i] = h;
    const max = Math.max(...heights.current.filter((v): v is number => !!v));
    if (max !== tall) {
      setTall(max);
    }
  };

  return (
    <View>
      <View onLayout={(e) => setWide(e.nativeEvent.layout.width)}>
        {wide > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}>
            {stories.map((s, i) => (
              <View
                key={i}
                style={{ width: wide, minHeight: tall || undefined }}
                onLayout={(e) => measured(i, e.nativeEvent.layout.height)}>
                <StoryBlock story={s} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <StoryBlock story={stories[0]} />
        )}
      </View>
      <View style={styles.dots}>
        {stories.map((_, i) => (
          <View key={i} style={[styles.dot, i === at ? styles.dotOn : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.s1,
    marginTop: Spacing.s1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotOn: {
    backgroundColor: Colors.accent,
  },
});
