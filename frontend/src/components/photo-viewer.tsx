import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { Caption, Icon } from '@/ui';

/**
 * 사진 크게 보기.
 *
 * <h3>한 벌만 둡니다</h3>
 *
 * <p>사진이 뜨는 자리가 여럿입니다 — 우리가 받아 둔 것(OurPhoto), 구글이
 * 가진 것(PlacePhoto), 여러 장을 옆으로 넘기는 띠(PhotoStrip). 자리마다
 * 크게 보는 판을 따로 만들면 닫는 단추 자리도 넘기는 방식도 조금씩
 * 달라지고, 누르는 사람은 <b>같은 일을 하는데 매번 다르게</b> 하게 됩니다.
 *
 * <p>그래서 주소만 받습니다. 어디서 온 사진인지는 부르는 쪽이 알고, 여기는
 * 그것을 크게 보여 주는 일만 합니다.
 *
 * <h3>안 자릅니다</h3>
 *
 * <p>목록에서는 잘라서 줄을 맞추는 것이 맞지만, 크게 볼 때 가장자리가 잘려
 * 있으면 그건 다른 사진입니다.
 *
 * <h3>닫는 길을 셋 둡니다</h3>
 *
 * <p>바탕 누르기, 오른쪽 위 ✕, 그리고 기기의 뒤로 가기(onRequestClose).
 * 마지막 것이 없으면 안드로이드에서 뒤로 가기가 판이 아니라 <b>앱</b>을
 * 닫습니다.
 */
export function PhotoViewer({
  uris,
  from = 0,
  visible,
  onClose,
  by,
}: {
  /** 보여 줄 사진들의 주소. 우리 것이든 구글 것이든 여기서는 같습니다. */
  uris: string[];
  /** 몇 번째부터 열지. 띠에서 넘겨 보던 장으로 엽니다. */
  from?: number;
  visible: boolean;
  onClose: () => void;
  /** 찍은 사람. 구글 사진은 밝혀야 합니다(구글 약관). */
  by?: string | null;
}) {
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(from);
  const rail = useRef<ScrollView>(null);

  if (!visible || uris.length === 0) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dark}>
        {/* 바탕을 눌러 닫습니다. 사진 뒤에 깔아 두어, 사진 위를 누르는 것과
            바탕을 누르는 것이 안 다툽니다. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />

        <ScrollView
          ref={rail}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          /*
            보고 있던 장으로 열립니다.

            <p>contentOffset 으로 시작 자리를 주는 길도 있는데 그건 iOS 에서만
            먹습니다 — 안드로이드와 웹에서는 무시되어 늘 첫 장이 열립니다.
            자리를 잡은 뒤에 직접 밀어 줍니다.
          */
          onLayout={() => rail.current?.scrollTo({ x: from * width, animated: false })}
          /*
            세는 것은 구르는 동안 합니다. 손을 뗀 뒤에 세면(momentum) 웹에서
            그 소식이 아예 안 옵니다 — 마우스 바퀴와 트랙패드에는 "던진 뒤
            미끄러지는" 것이 없기 때문입니다.
          */
          onScroll={(e) =>
            setAt(
              Math.min(
                Math.max(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)), 0),
                uris.length - 1,
              ),
            )
          }
          scrollEventThrottle={16}>
          {uris.map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={{ uri }}
              style={{ width, height }}
              contentFit="contain"
              transition={120}
              accessibilityLabel="사진"
            />
          ))}
        </ScrollView>

        {by ? (
          <View style={styles.by} pointerEvents="none">
            <Caption tone="inverse">{by}</Caption>
          </View>
        ) : null}

        {uris.length > 1 ? (
          <View style={styles.count} pointerEvents="none">
            <Caption tone="inverse">
              {at + 1}/{uris.length}
            </Caption>
          </View>
        ) : null}

        <Pressable style={styles.close} onPress={onClose} accessibilityLabel="닫기">
          <Icon name="x" size={24} tone="inverse" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dark: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
  },
  count: {
    position: 'absolute',
    bottom: Spacing.xl,
    alignSelf: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  by: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.md,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  close: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.md,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
