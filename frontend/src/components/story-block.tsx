import { StyleSheet, View } from 'react-native';

import type { Story } from '@/api/types';
import { PhotoStrip } from '@/components/photo-strip';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Body, Caption, Row } from '@/ui';

/**
 * 여행기에 같이 실린 글 한 편.
 *
 * <h3>왜 일정 사이에 서는가</h3>
 *
 * <p>일정은 「어디를 갔나」이고 이것은 「어땠나」입니다. 뒤에 모아 두면 읽는
 * 사람이 일정을 다 지나간 뒤에야 사진을 보게 되고, 그러면 그 사진이 어느
 * 날의 것인지 다시 거슬러 올라가야 합니다.
 *
 * <h3>날이 안 적힌 것은 뒤에 섭니다</h3>
 *
 * <p>돌아와서 올린 글입니다. 억지로 어느 날에 붙이면 그날 있지도 않은 일이
 * 그날 밑에 적힙니다.
 */
export function StoryBlock({ story }: { story: Story }) {
  const shots = story.photos ?? [];
  return (
    <View style={styles.block}>
      <Row gap={Spacing.xs}>
        <Caption strong>{story.author}</Caption>
        <Caption tone="muted">{story.at.slice(0, 10)}</Caption>
      </Row>

      {shots.length > 0 ? <PhotoStrip ids={shots} height={260} /> : null}

      {story.text ? <Body small>{story.text}</Body> : null}

      {story.tags.length > 0 ? (
        <Row gap={Spacing.xs} style={styles.wrap}>
          {story.tags.map((t) => (
            <Caption key={t} tone="accent">
              #{t}
            </Caption>
          ))}
        </Row>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /*
    일정 줄과 다른 바탕을 둡니다.

    <p>같은 흰 판에 이어 두면 장소 하나를 길게 적어 둔 것처럼 읽힙니다. 이쪽은
    장소가 아니라 그날 있었던 일이라, 눈에 한 번 걸려야 합니다.
  */
  block: {
    backgroundColor: Colors.fill,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
