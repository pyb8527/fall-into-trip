import { StyleSheet, Text, View } from 'react-native';

import type { Story } from '@/api/types';
import { PhotoStrip } from '@/components/photo-strip';
import { Colors, Radius, Spacing, Type, Weight } from '@/constants/theme';
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
      <Row gap={Spacing.s2}>
        <Caption strong>{story.author}</Caption>
        <Caption tone="muted">{story.at.slice(0, 10)}</Caption>
      </Row>

      {shots.length > 0 ? <PhotoStrip ids={shots} height={260} /> : null}

      {story.text ? <Body small>{story.text}</Body> : null}

      {/*
        꼬리표.

        <p>{@code tone="accent"} 로 적고 있었습니다. 그런데 이 앱에서 글자의
        accent 는 <b>검정</b>이라, "#온천" 이 본문과 똑같은 검정 글씨였습니다 —
        누를 수 있는 것처럼 보이면서 누를 수도 없었습니다.
        <p>글자색을 바꾸는 대신 작은 면에 담습니다. 누르는 것이 아니라
        <b>붙어 있는 것</b>이라는 말을 모양이 합니다.
      */}
      {story.tags.length > 0 ? (
        <Row gap={Spacing.s2} style={styles.wrap}>
          {story.tags.map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagLabel}>#{t}</Text>
            </View>
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
    borderRadius: Radius.r3,
    padding: Spacing.s4,
    gap: Spacing.s2,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  /*
    못 누르는 꼬리표.

    <p>칩과 생김새를 가릅니다. 칩은 눌러서 고르는 것이라 키가 34이고 둥글고
    테두리가 있습니다. 이쪽은 글에 붙어 있는 이름표라 작고 각지고 바탕만
    있습니다.

    <p>공용 {@code Tag} 를 안 씁니다. 그쪽은 회색 면인데 이 글덩이가 이미
    회색 바탕({@code block}) 위에 서 있어, 그대로 쓰면 꼬리표가 바탕에
    묻혀 사라집니다. 여기서만 흰 면으로 뒤집습니다.
  */
  tag: {
    height: 22,
    borderRadius: Radius.r1,
    paddingHorizontal: 6,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagLabel: {
    ...Type.micro,
    fontSize: 12,
    fontWeight: Weight.medium,
    color: Colors.textSecondary,
  },
});
