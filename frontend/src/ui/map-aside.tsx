import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Colors, Gutter, Spacing } from '@/constants/theme';
import { DragSheet, type DragSheetHandle } from '@/ui';
import { SidePanelWidth, useWide } from '@/ui/layout';

/**
 * 지도 옆에 서는 것.
 *
 * <h3>끄는 판은 자리가 없을 때 쓰는 것입니다</h3>
 *
 * <p>일정과 여행기 상세는 지도를 화면 전체에 깔고 그 위로 판을 끌어올립니다
 * (DragSheet). 폰에서는 이것이 맞습니다 — 지도도 일정도 각각 화면 하나를
 * 원하는데 화면이 하나뿐이라, 어느 쪽을 볼지 그때그때 손으로 정합니다.
 *
 * <p>넓은 화면에서는 둘을 나란히 둘 자리가 있습니다. 그런데도 판을
 * 끌어올리게 두면, 일정을 읽으려고 1280 짜리 창에서 판을 위로 끌었다가
 * 지도를 보려고 다시 내리는 일이 남습니다 — 할 일이 없는데 손이 한 번 더
 * 가는 것입니다. 게다가 마우스로 판을 끄는 손짓은 아무도 먼저 짐작하지
 * 못합니다.
 *
 * <p>왼쪽에 패널로 세웁니다. 420 폭에 머리가 위에 붙고 그 아래가 굴러갑니다.
 * 지도는 그 오른쪽 전부입니다.
 *
 * <h3>부르는 쪽은 바꿀 것이 없습니다</h3>
 *
 * <p>판에 주던 것을 그대로 받습니다. 끌기에만 쓰이는 것(snaps · lift ·
 * revealAtLow)은 넓은 화면에서 조용히 버립니다 — 화면마다 "넓으면 이것,
 * 좁으면 저것" 을 적게 하면 같은 판단이 화면 수만큼 흩어집니다.
 *
 * <p>지도에서 핀을 눌렀을 때 그 줄로 굴리는 일({@link DragSheetHandle})도
 * 그대로 합니다. 판이든 패널이든 "그 줄을 보여 달라" 는 말은 같습니다.
 */
type MapAsideProps = {
  children: React.ReactNode;
  /** 맨 위에 늘 보이는 줄. 넓은 화면에서는 패널 위에 붙어 안 굴러갑니다. */
  peek?: React.ReactNode;
  /** 지금 몇 픽셀을 덮고 있는지. 넓은 화면에서는 덮는 것이 없으므로 0 입니다. */
  onHeightChange?: (px: number) => void;
  /* -------- 아래 셋은 끄는 판에만 뜻이 있습니다. */
  snaps?: number[];
  initial?: number;
  revealAtLow?: number;
  lift?: number;
};

export const MapAside = forwardRef<DragSheetHandle, MapAsideProps>(function MapAside(
  { children, peek, onHeightChange, snaps, initial, revealAtLow, lift },
  ref,
) {
  const wide = useWide();

  if (wide) {
    return (
      <SidePanel ref={ref} peek={peek} onHeightChange={onHeightChange}>
        {children}
      </SidePanel>
    );
  }

  return (
    <DragSheet
      ref={ref}
      peek={peek}
      onHeightChange={onHeightChange}
      snaps={snaps}
      initial={initial}
      revealAtLow={revealAtLow}
      lift={lift}>
      {children}
    </DragSheet>
  );
});

const SidePanel = forwardRef<
  DragSheetHandle,
  {
    children: React.ReactNode;
    peek?: React.ReactNode;
    onHeightChange?: (px: number) => void;
  }
>(function SidePanel({ children, peek, onHeightChange }, ref) {
  const scroller = useRef<ScrollView>(null);
  /* 줄이 목록의 어디쯤에 있는지는 이 자리를 기준으로 잽니다 — 끄는 판이
     쓰는 방법과 같습니다. */
  const content = useRef<View>(null);

  /*
    덮는 것이 없다고 지도에게 말합니다.

    <p>지도는 "판이 덮은 만큼" 을 비켜 담습니다. 창을 넓혀 패널로 바뀐
    순간에는 그 값이 <b>판이 마지막으로 덮고 있던 높이</b>로 남아 있어서,
    지도가 있지도 않은 판을 피해 핀을 위쪽으로 몰아 담습니다.
  */
  useEffect(() => {
    onHeightChange?.(0);
  }, [onHeightChange]);

  useImperativeHandle(
    ref,
    () => ({
      reveal(node: unknown) {
        const target = node as {
          measureLayout?: (
            relativeTo: unknown,
            onSuccess: (x: number, y: number) => void,
            onFail?: () => void,
          ) => void;
        } | null;
        if (!target?.measureLayout || !content.current) {
          return;
        }
        target.measureLayout(
          content.current,
          (_x, y) => {
            scroller.current?.scrollTo({ y: Math.max(0, y - Spacing.s3), animated: true });
          },
          () => {},
        );
      },
    }),
    [],
  );

  return (
    <View style={styles.panel}>
      {/* 머리는 안 굴러갑니다. 여행 이름과 날짜 칩은 일정을 훑는 내내 보여야
          하는 것이라, 같이 흘려보내면 몇째 날을 보고 있는지 알 수 없습니다. */}
      {peek ? <View style={styles.head}>{peek}</View> : null}

      <ScrollView
        ref={scroller}
        style={styles.body}
        contentContainerStyle={styles.bodyInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View ref={content} style={styles.stack}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  /*
    왼쪽 패널.

    <p>떠 있습니다(absolute). 흐름 안에 세우면 지도와 패널의 순서가 JSX 에
    적힌 순서에 달리고, 지도가 먼저 적혀 있어서 패널이 오른쪽에 섭니다 —
    화면들의 JSX 를 통째로 뒤집는 일이 됩니다. 떠 있는 것은 적힌 순서와
    상관없이 제 자리에 섭니다. 대신 지도가 그만큼 왼쪽을 비웁니다
    (각 화면의 mapPane).
  */
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SidePanelWidth,
    backgroundColor: Colors.surface,
    /* 지도와 맞닿는 자리라 선이 필요합니다. 둘 다 끝까지 차 있어서,
       선이 없으면 흰 패널과 지도의 밝은 부분이 한 덩어리로 보입니다. */
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    zIndex: 2,
  },
  head: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.s5,
    paddingBottom: Spacing.s3,
    gap: Spacing.s2,
  },
  body: {
    flex: 1,
  },
  bodyInner: {
    paddingHorizontal: Gutter,
    /* 맨 아래 여유. 마지막 줄이 창 바닥에 딱 붙어 끝나면 더 있는지
       없는지가 안 보입니다. */
    paddingBottom: Spacing.s16,
  },
  /* 안에 든 것들 사이. 끄는 판이 쓰던 값과 같습니다 — 같은 내용이 자리만
     옮긴 것이라, 사이가 달라지면 옮긴 티가 납니다. */
  stack: {
    gap: Spacing.s4,
  },
});
