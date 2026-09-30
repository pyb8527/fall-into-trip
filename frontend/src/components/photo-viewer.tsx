import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
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
 * <h3>단추를 사진 위에 얹지 않습니다</h3>
 *
 * <p>닫는 단추를 사진 위 오른쪽 모서리에 동그라미로 띄워 두었습니다. 그런데
 * 사진은 무엇이 찍혔을지 모르는 것이라, 그 자리가 흰 하늘이면 <b>단추가
 * 통째로 사라집니다.</b> 반투명 바탕을 깔아도 밝은 사진 위에서는 옅은 회색
 * 얼룩으로만 보입니다.
 *
 * <p>위아래에 띠를 둡니다. 띠는 사진 밖이라 무엇이 찍혔든 상관이 없고,
 * 닫는 단추와 몇 번째인지가 늘 같은 자리에 섭니다. 사진은 그만큼 좁아지는데,
 * 어차피 안 자르고 맞추므로 대개 위아래에 남던 검은 자리입니다.
 *
 * <h3>기기의 뒤로가기가 판을 닫습니다</h3>
 *
 * <p>안 그러면 뒤로가기가 <b>판이 아니라 화면</b>을 물립니다 — 사진을 닫으려
 * 눌렀는데 보고 있던 여행기에서 튕겨 나갑니다.
 *
 * <p>웹에서는 판을 열 때 기록에 한 칸을 넣어 둡니다. 그러면 뒤로가기가 그
 * 칸을 먼저 걷고, 화면은 제자리에 남습니다. 화면에서 ✕ 로 닫을 때는 넣어 둔
 * 칸을 우리가 걷습니다 — 안 걷으면 앞으로 가기가 판을 다시 엽니다.
 *
 * <p>앱(웹뷰)도 이 기록을 그대로 씁니다. 순수 앱에서는 Modal 의
 * onRequestClose 가 같은 일을 합니다.
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(from);
  const rail = useRef<ScrollView>(null);

  /* 닫는 함수가 매 렌더마다 새로 오므로, 아래 효과가 그것 때문에 다시
     돌지 않게 붙들어 둡니다 — 다시 돌면 기록 칸이 계속 쌓입니다. */
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    window.history.pushState({ fitViewer: true }, '');
    const popped = () => close.current();
    window.addEventListener('popstate', popped);
    return () => {
      window.removeEventListener('popstate', popped);
      /*
        우리가 넣어 둔 칸이 아직 남아 있으면(=✕ 나 바탕을 눌러 닫은 경우)
        걷습니다. 뒤로가기로 닫혔을 때는 이미 걷힌 뒤라 여기서 또 물리면
        화면이 한 칸 더 뒤로 갑니다.
      */
      if ((window.history.state as { fitViewer?: boolean } | null)?.fitViewer) {
        window.history.back();
      }
    };
  }, [visible]);

  if (!visible || uris.length === 0) {
    return null;
  }

  /* 띠가 먹는 높이. 사진은 그 사이를 씁니다 — 띠 아래로 사진이 들어가면
     닫는 단추가 다시 사진 위에 얹힌 것과 같아집니다. */
  const barTop = 52 + insets.top;
  const barBottom = (by ? 44 : 0) + Math.max(insets.bottom, Spacing.md);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dark}>
        {/* 위 띠. 닫는 단추와 몇 번째인지가 늘 같은 자리에 섭니다. */}
        <View style={[styles.top, { height: barTop, paddingTop: insets.top }]}>
          <Pressable style={styles.close} onPress={onClose} accessibilityLabel="닫기">
            <Icon name="x" size={26} tone="inverse" />
          </Pressable>
          {uris.length > 1 ? (
            <Caption tone="inverse">
              {at + 1} / {uris.length}
            </Caption>
          ) : null}
        </View>

        {/*
          사진.

          <p>바탕을 눌러도 닫히게 두었었는데, 넘기려고 쓸어내다 손가락이
          멈추면 그것이 누름으로 읽혀 판이 닫혔습니다. 닫는 길은 위의 ✕ 와
          기기의 뒤로가기, 둘로 충분합니다.
        */}
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
              style={{ width, height: Math.max(1, height - barTop - barBottom) }}
              contentFit="contain"
              transition={120}
              accessibilityLabel="사진"
            />
          ))}
        </ScrollView>

        {/* 아래 띠. 찍은 사람이 있을 때만 섭니다 — 구글 사진은 밝혀야 합니다. */}
        {by ? (
          <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
            <Caption tone="inverse">{by}</Caption>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dark: {
    flex: 1,
    /* 완전한 검정입니다. 사진을 볼 때 주위가 밝으면 눈이 그쪽에 맞춰져
       사진의 어두운 부분이 안 보입니다. */
    backgroundColor: '#000000',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
});
