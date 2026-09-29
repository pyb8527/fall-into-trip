import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { API_BASE } from '@/api/client';
import { OurPhoto } from '@/components/our-photo';
import { Radius, Spacing } from '@/constants/theme';
import { Caption, Icon } from '@/ui';

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
 *
 * <p>세는 것은 <b>구르는 동안</b> 합니다. 손을 뗀 뒤에 세면(momentum) 웹에서
 * 그 소식이 아예 안 옵니다 — 마우스 바퀴와 트랙패드에는 "던진 뒤 미끄러지는"
 * 것이 없기 때문입니다. 그래서 숫자가 1 에 멈춰 있었습니다.
 *
 * <h3>눌러서 크게 봅니다</h3>
 *
 * <p>220 은 무엇이 찍혔는지 알아보는 크기지 들여다보는 크기가 아닙니다.
 * 누르면 화면을 꽉 채워 <b>잘리지 않고</b> 뜹니다 — 목록에서는 잘라서
 * 줄을 맞추는 것이 맞지만, 크게 볼 때 잘리면 그건 다른 사진입니다.
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
     카드 안, 여행기는 화면 폭) 재서 씁니다. */
  const [wide, setWide] = useState(0);
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(false);

  const shots = (ids ?? []).filter(Boolean);
  if (shots.length === 0) {
    return null;
  }

  const count = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, wide));
    if (now !== at) {
      setAt(Math.min(Math.max(now, 0), shots.length - 1));
    }
  };

  return (
    <>
      {shots.length === 1 ? (
        <Pressable onPress={() => setOpen(true)} accessibilityLabel="사진 크게 보기">
          <OurPhoto id={shots[0]} height={height} style={style} />
        </Pressable>
      ) : (
        <View style={[{ height }, style]} onLayout={(e) => setWide(e.nativeEvent.layout.width)}>
          {/* 재기 전에는 한 장만 펴 둡니다. 0 으로 한 번 그리면 넘긴 자리가
              처음에 어긋나고, 아무것도 안 그리면 사진이 깜빡입니다. */}
          {wide > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={count}
              scrollEventThrottle={16}>
              {shots.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => setOpen(true)}
                  accessibilityLabel="사진 크게 보기">
                  <OurPhoto id={id} width={wide} height={height} />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <OurPhoto id={shots[0]} height={height} />
          )}

          <View style={styles.count} pointerEvents="none">
            <Caption tone="inverse">
              {at + 1}/{shots.length}
            </Caption>
          </View>
        </View>
      )}

      <PhotoViewer
        shots={shots}
        from={shots.length === 1 ? 0 : at}
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * 크게 보기.
 *
 * <p>검은 바탕 위에 잘리지 않은 사진 하나입니다. 여러 장이면 여기서도
 * 옆으로 넘어갑니다 — 크게 보려고 열었는데 한 장만 보이면 나머지를 보려고
 * 닫았다 열기를 되풀이하게 됩니다.
 *
 * <p>바탕을 눌러도 닫힙니다. 안드로이드의 뒤로 가기도 받습니다
 * (onRequestClose) — 이것이 없으면 뒤로 가기가 판이 아니라 <b>앱</b>을
 * 닫습니다.
 */
function PhotoViewer({
  shots,
  from,
  visible,
  onClose,
}: {
  shots: string[];
  from: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(from);
  const rail = useRef<ScrollView>(null);

  if (!visible) {
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
          onScroll={(e) =>
            setAt(
              Math.min(
                Math.max(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)), 0),
                shots.length - 1,
              ),
            )
          }
          scrollEventThrottle={16}>
          {shots.map((id) => (
            <Image
              key={id}
              source={{ uri: `${API_BASE}/api/photos/${id}` }}
              style={{ width, height }}
              /* 안 자릅니다. 크게 보려고 연 것인데 가장자리가 잘려 있으면
                 그건 다른 사진입니다. */
              contentFit="contain"
              transition={120}
              accessibilityLabel="남긴 사진"
            />
          ))}
        </ScrollView>

        {shots.length > 1 ? (
          <View style={styles.viewerCount} pointerEvents="none">
            <Caption tone="inverse">
              {at + 1}/{shots.length}
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
  dark: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
  },
  viewerCount: {
    position: 'absolute',
    bottom: Spacing.xl,
    alignSelf: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
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
