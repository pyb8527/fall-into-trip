import { usePathname, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Colors,
  Elevation,
  Radius,
  Spacing,
  TabDock,
  Tap,
  Type,
  Weight,
} from '@/constants/theme';
import { Icon, type IconName, Press } from '@/ui';
import { WANT } from '@/constants/words';

/**
 * 화면 아래에 늘 붙어 있는 띠.
 *
 * <h3>왜 아래인가</h3>
 *
 * <p>할 수 있는 일들을 <b>첫 화면 한가운데</b>에 카드로 늘어놓고 있었습니다.
 * 그래서 보석함에 가려면 어느 화면에 있든 먼저 홈으로 돌아와야 했고, 홈은
 * 그 카드들 때문에 정작 여행 목록을 아래로 밀어냈습니다.
 *
 * <p>아래로 내립니다. 어느 화면에서든 한 번에 닿고, 폰을 한 손으로 쥐었을
 * 때 엄지가 가는 자리입니다. 홈은 메뉴판 노릇을 그만두고 내용만 답니다.
 *
 * <h3>두 층으로 씁니다</h3>
 *
 * <p>바깥에서는 앱 전체의 갈래({@link AppTabs})가 서고, 여행 하나에 들어가면
 * <b>그 여행에서 하는 일들</b>로 바뀝니다. 들어간 곳의 도구가 손에 잡히는
 * 것이 맞고, 그러지 않으면 여행 안에서 쓰는 것들이 다시 화면 어딘가로
 * 흩어집니다.
 *
 * <p>여행 쪽에는 왼쪽에 나가는 길을 답니다. 갈래가 통째로 바뀌었으므로
 * 어디서 빠져나가는지가 보여야 합니다.
 */
export type TabItem = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  /* 지금 이 화면인지. 안 주면 눌린 적 없는 것으로 봅니다. */
  active?: boolean;
  /** 볼 것이 있다는 점. 숫자는 안 적습니다 — 열기 전에 셀 일이 아닙니다. */
  dot?: boolean;
};

export function TabBar({ items, onBack }: { items: TabItem[]; onBack?: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      /* 띠 바깥은 그대로 눌립니다. 안 그러면 띠를 감싼 빈 자리가 화면 아래
         전체를 덮어, 그 뒤에 있는 것을 못 누릅니다. */
      pointerEvents="box-none"
      style={[
        styles.dock,
        /*
          높이를 못박습니다.

          <p>minHeight 로 두면 <b>안에 든 것이 더 크면 띠가 그만큼 자랍니다.</b>
          그런데 판(DragSheet)은 TabDock 이라는 숫자만 믿고 그만큼 떠 있습니다.
          둘이 어긋나면 판 아래와 띠 위 사이에 틈이 생기고, 그 틈으로 지도가
          비칩니다.

          <p>높이를 정해 두면 어긋날 수가 없습니다. 안에 든 것이 TabDock 보다
          커지면 잘리는데, 그때는 TabDock 을 다시 재는 것이 맞습니다 —
          모르는 채로 틈이 벌어지는 것보다 낫습니다.
        */
        {
          height: TabDock + Math.max(insets.bottom, Spacing.sm),
          paddingBottom: Math.max(insets.bottom, Spacing.sm),
        },
      ]}>
      {onBack ? (
        /* 띠와 같은 재질입니다. 하나만 꽉 막힌 흰 동그라미면 둘이 다른
           층에 있는 것처럼 보입니다. */
        <Press onPress={onBack} accessibilityLabel="나가기" style={styles.back}>
          <Icon name="chevron-left" size={26} />
        </Press>
      ) : null}

      <View style={styles.bar}>
        {items.map((item) => (
          <Press
            key={item.key}
            /*
              지금 이 화면이면 아무 일도 안 합니다.

              <p>칸마다 스스로 막게 두었더니 여행 쪽만 막고 바깥 갈래는
              안 막혔습니다. 그래서 「홈」에서 홈을 다시 누르면 같은 화면이
              한 겹 더 쌓이고, 뒤로가기가 한 번 헛돌았습니다 — 눌렀는데
              아무 일도 안 일어나는 것으로 보입니다.

              <p>여기서 한 번 막으면 칸을 더 만들어도 같이 지켜집니다.
            */
            onPress={item.active ? () => {} : item.onPress}
            accessibilityLabel={item.label}
            accessibilityState={{ selected: !!item.active }}
            scale={0.94}
            style={styles.tab}>
            <View>
              <Icon name={item.icon} size={27} tone={item.active ? 'default' : 'muted'} />
              {item.dot ? <View style={styles.dot} /> : null}
            </View>
            {/*
              글자를 답니다. 그림만 두면 책갈피가 보석함인지 저장인지,
              나침반이 둘러보기인지 지도인지 눌러 봐야 압니다 — 이 앱의
              갈래는 그림 하나로 뜻이 서는 것들이 아닙니다.
            */}
            <Text style={[styles.label, item.active ? styles.labelOn : null]} numberOfLines={1}>
              {item.label}
            </Text>
          </Press>
        ))}
      </View>
    </View>
  );
}

/**
 * 앱 전체의 갈래.
 *
 * <p>다섯입니다. 여섯을 넘기면 좁은 폰에서 글자가 잘리고, 넷이면 아래가
 * 휑합니다.
 *
 * <p>모임이 여기 있는 것은 <b>사람을 부르는 길이 모임 하나</b>이기
 * 때문입니다. 여행에 사람을 따로 부르는 길을 없앴으니, 같이 짤 사람을
 * 찾는 사람이 들어갈 자리가 띠에 있어야 합니다.
 */
export function AppTabs() {
  const router = useRouter();
  const here = usePathname();

  /*
    갈래를 옮기는 것은 쌓는 일이 아닙니다.

    <p>push 로 쌓고 있었습니다. 그래서 홈 → 내 여행 → 보석함 → 둘러보기로
    돌아다닌 뒤 뒤로가기를 누르면 지나온 갈래를 거꾸로 되밟아야 했고, 네 번을
    눌러야 갈래 밖으로 나갔습니다. 여행 안의 갈래(TripTabs)는 처음부터
    replace 였으니, 같은 몸짓이 <b>바깥과 속에서 다르게</b> 굴었습니다.

    <p>안 쌓습니다. 한 번 누르면 갈래 밖으로 나가고, 폰 어플에서 아래 띠가
    하는 일과 같아집니다.
  */
  const go = (path: string) => () => router.replace(path as never);

  return (
    <TabBar
      items={[
        {
          key: 'home',
          label: '홈',
          icon: 'home',
          active: here === '/home' || here === '/',
          onPress: go('/(app)/home'),
        },
        {
          key: 'trips',
          label: '내 여행',
          icon: 'calendar',
          active: here.startsWith('/trips'),
          onPress: go('/(app)/trips'),
        },
        {
          key: 'groups',
          label: '모임',
          icon: 'users',
          active: here.startsWith('/groups'),
          onPress: go('/(app)/groups'),
        },
        {
          key: 'saved',
          label: '보석함',
          icon: 'bookmark',
          active: here.startsWith('/saved'),
          onPress: go('/(app)/saved'),
        },
        {
          key: 'community',
          label: '둘러보기',
          icon: 'compass',
          active: here.startsWith('/community'),
          onPress: go('/community'),
        },
      ]}
    />
  );
}

/** 여행 안에서 오갈 수 있는 곳들. 어느 화면에 있든 같은 순서로 섭니다. */
export type TripTabKey = 'plan' | 'vote' | 'money' | 'card';

/**
 * 여행 하나의 갈래.
 *
 * <h3>왜 여행마다 띠가 바뀌는가</h3>
 *
 * <p>여행에 들어오면 그 안에서 오가는 것이 대부분입니다. 바깥 갈래(홈·보석함…)
 * 를 그대로 두면 정작 자주 쓰는 것들이 다시 화면 어딘가로 흩어집니다.
 *
 * <h3>다섯 화면이 같은 띠를 나눠 씁니다</h3>
 *
 * <p>일정에만 달아 두었더니 「여행 중」으로 넘어가는 순간 띠가 사라져서,
 * 거기서 가계부로 가려면 뒤로 → 일정 → 가계부를 밟아야 했습니다. 갈래라고
 * 해 놓고 한 화면에서만 갈래인 셈이었습니다.
 *
 * <p>여기 한 벌만 두고 다섯이 같이 씁니다. 화면이 하나 늘어도 고칠 데는
 * 여기뿐입니다.
 *
 * @param active 지금 이 화면. 그 칸은 눌러도 아무 일이 없습니다 — 같은 곳을
 *               다시 쌓으면 뒤로가기가 한 번 헛돕니다
 */
export function TripTabs({
  tripId,
  active,
  onBack,
}: {
  tripId: string;
  active: TripTabKey;
  /** 나가는 길. 안 주면 일정 화면으로 돌아갑니다. */
  onBack?: () => void;
}) {
  const router = useRouter();

  /* replace 입니다. 갈래끼리 오가는 것은 <b>같은 층에서 자리를 옮기는
     일</b>이라, push 로 쌓으면 뒤로가기를 다섯 번 눌러야 여행 밖으로
     나갑니다. 지금 화면을 다시 누르는 것은 띠가 막습니다(TabBar). */
  const go = (path: string) => () =>
    router.replace({ pathname: path as never, params: { id: tripId } as never });

  return (
    <TabBar
      onBack={onBack ?? (() => router.replace({ pathname: '/trip/[id]', params: { id: tripId } }))}
      items={[
        {
          key: 'plan',
          label: '일정',
          icon: 'calendar',
          active: active === 'plan',
          onPress: go('/trip/[id]'),
        },
        {
          key: 'vote',
          label: WANT,
          icon: 'thumbs-up',
          active: active === 'vote',
          onPress: go('/vote/[id]'),
        },
        {
          key: 'money',
          label: '가계부',
          icon: 'credit-card',
          active: active === 'money',
          onPress: go('/money/[id]'),
        },
        {
          key: 'card',
          label: '요약',
          icon: 'book-open',
          active: active === 'card',
          onPress: go('/card/[id]'),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  /*
    띠가 앉는 자리.

    <h3>바탕색을 깔았다가 걷었습니다</h3>

    <p>일정 화면은 지도가 바탕이라 떠 있는 띠 뒤로 지도가 그대로 보였습니다.
    지도에 얹힌 조각처럼 보여서, 띠가 앉는 자리에 회색 바탕을 깔았습니다.

    <p>그런데 그것은 <b>화면 아래 한 자락을 통째로 회색으로 막는</b> 일이라,
    어느 화면에서든 내용이 그 선에서 끊겼습니다. 띄운 알약 하나를 살리려고
    82픽셀을 버린 셈입니다.

    <p>자리는 그대로 두고 색만 걷습니다. 위에 있던 내용이 띠 뒤로 그대로
    이어지고, 띠는 그 위에 떠 있습니다. 지도 위에서도 떨어져 보이게 하는 일은
    바탕색이 아니라 <b>알약 스스로</b>가 맡습니다 — 반투명한 흰 판, 머리카락
    한 올 테두리, 그리고 그림자.

    <p>자리를 없애지는 않습니다. 높이가 0 이 되면 판(DragSheet)이 믿고 있는
    TabDock 과 어긋나고, 굴러가는 화면의 마지막 줄이 띠 뒤로 들어가 아무리
    굴려도 안 보입니다.
  */
  dock: {
    backgroundColor: 'transparent',
    /*
      웹에서는 fixed 입니다.

      <p>absolute 는 <b>부모</b>의 바닥에 붙습니다. 부모가 화면과 꼭 같은
      높이일 때만 그것이 화면 바닥이고, 폰 브라우저에서는 주소창이 오르내리며
      그 전제가 깨집니다 — 띠가 바닥에서 한 자락 떠 있었습니다.

      <p>fixed 는 지금 보이는 화면에 붙습니다. 부모가 얼마나 크든 상관없이
      늘 맨 아래입니다. 앱에는 fixed 가 없으므로 그쪽은 absolute 그대로입니다.
    */
    position: 'absolute',
    ...Platform.select({ web: { position: 'fixed' as 'absolute' }, default: {} }),
    /*
      판(dragSheet)보다 한 칸 위입니다.

      <p>둘이 같은 층이었습니다. 판이 띠 높이만큼 떠 있어서 서로 안 겹쳤기
      때문인데, 지금은 판이 바닥까지 내려와 띠 뒤로 지나갑니다 — 띠 뒤에
      지도가 아니라 일정이 보이게 하려고 그렇게 했습니다.

      <p>겹치면 띠가 이겨야 합니다. 안 그러면 판의 마지막 줄이 띠를 덮어
      갈래를 누를 수가 없습니다.
    */
    zIndex: 3,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  /*
    떠 있는 띠.

    <p>화면 끝까지 붙인 네모가 아니라 둥근 알약으로 띄웁니다. 이 앱은
    회색 바닥에 흰 판을 얹어 층을 만드는데, 아래를 흰 띠로 꽉 채우면
    바닥과 띠가 한 덩어리가 되어 층이 무너집니다.

    <h3>비쳐 보입니다</h3>

    <p>아래에 회색 바탕을 깔지 않으므로, 떠 있다는 것을 알약이 혼자
    말해야 합니다. 셋이 함께 그 일을 합니다.

    <p>첫째, 속이 조금 비칩니다. 꽉 막힌 흰 판은 <b>그 자리에 원래 있던
    것</b>처럼 보이고, 아주 투명하면 글자가 뒤엣것과 겹쳐 안 읽힙니다.
    0.86은 뒤가 비치는 것이 보이면서 글자는 또렷한 자리입니다.

    <p>둘째, 웹에서는 뒤엣것을 흐립니다(backdropFilter). 흐리지 않으면
    지도의 글씨와 띠의 글씨가 나란히 읽혀 어느 쪽이 위인지 헷갈립니다.
    앱에는 이 성질이 없지만, 폰에서 보는 것도 결국 웹입니다(껍데기).

    <p>셋째, 그림자. 이 앱에서 그림자를 쓰는 몇 안 되는 자리인데, 바탕색을
    걷은 지금은 그림자가 유일하게 「위에 있다」를 말합니다.
  */
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    ...Elevation.float,
    ...Platform.select({
      web: { backdropFilter: 'saturate(180%) blur(18px)' } as object,
      default: {},
    }),
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  label: {
    ...Type.caption,
    /* 캡션(15)보다 한 눈금 작게. 다섯 칸이 나란히 서는 자리라 "가고 싶은 곳"
       같은 긴 이름이 잘리지 않아야 합니다. 줄 높이도 같이 줄입니다 —
       캡션의 것을 그대로 쓰면 글자 위아래로 빈자리가 남아 띠만 두꺼워집니다. */
    fontSize: 14,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  /* 켜진 것은 색이 아니라 굵기로 말합니다. 다섯 중 하나에만 색을 칠하면
     그 색이 이 화면에서 가장 진한 것이 되어, 정작 내용이 밀립니다. */
  labelOn: {
    color: Colors.text,
    fontWeight: Weight.bold,
  },
  dot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  /* 나가는 길. 띠 바깥에 따로 둡니다 — 갈래 중 하나가 아니라 이 갈래
     전체에서 빠져나가는 것이라, 같은 줄 안에 두면 여섯 번째 갈래로
     읽힙니다. */
  /* 띠와 같은 재질입니다. 하나만 꽉 막힌 흰 동그라미면 둘이 다른 층에
     있는 것처럼 보입니다. */
  back: {
    width: Tap.min,
    height: Tap.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    ...Elevation.float,
    ...Platform.select({
      web: { backdropFilter: 'saturate(180%) blur(18px)' } as object,
      default: {},
    }),
  },
});
