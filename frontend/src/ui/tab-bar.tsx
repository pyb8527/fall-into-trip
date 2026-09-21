import { usePathname, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, TabDock, Tap, Type, Weight } from '@/constants/theme';
import { Icon, type IconName, Press } from '@/ui';

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
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      {onBack ? (
        <Press onPress={onBack} accessibilityLabel="나가기" style={styles.back}>
          <Icon name="chevron-left" size={20} />
        </Press>
      ) : null}

      <View style={styles.bar}>
        {items.map((item) => (
          <Press
            key={item.key}
            onPress={item.onPress}
            accessibilityLabel={item.label}
            accessibilityState={{ selected: !!item.active }}
            scale={0.94}
            style={styles.tab}>
            <View>
              <Icon name={item.icon} size={21} tone={item.active ? 'default' : 'muted'} />
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
 * <p>가계부가 여기 있는 것은 <b>여행을 고르는 것부터</b>가 가계부를 여는
 * 일의 절반이기 때문입니다. 누르면 여행 목록이 뜨고, 고르면 곧장 그 여행의
 * 가계부로 갑니다.
 */
export function AppTabs() {
  const router = useRouter();
  const here = usePathname();

  return (
    <TabBar
      items={[
        {
          key: 'home',
          label: '홈',
          icon: 'home',
          active: here === '/home' || here === '/',
          onPress: () => router.push('/(app)/home'),
        },
        {
          key: 'trips',
          label: '내 여행',
          icon: 'calendar',
          active: here.startsWith('/trips'),
          onPress: () => router.push('/(app)/trips'),
        },
        {
          key: 'saved',
          label: '보석함',
          icon: 'bookmark',
          active: here.startsWith('/saved'),
          onPress: () => router.push('/(app)/saved'),
        },
        {
          key: 'community',
          label: '둘러보기',
          icon: 'compass',
          active: here.startsWith('/community'),
          onPress: () => router.push('/community'),
        },
        {
          key: 'money',
          label: '가계부',
          icon: 'credit-card',
          active: here.startsWith('/money'),
          /* 여행 목록을 빌려 쓰고 있었습니다. 그래서 가계부를 눌렀는데
             주소가 /trips 가 되고, 띠는 그것을 보고 「내 여행」에 불을
             켰습니다. 가계부만의 목록을 둡니다. */
          onPress: () => router.push('/(app)/money'),
        },
      ]}
    />
  );
}

/** 여행 안에서 오갈 수 있는 곳들. 어느 화면에 있든 같은 순서로 섭니다. */
export type TripTabKey = 'plan' | 'travel' | 'vote' | 'money' | 'card';

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
 * @param onTrip 오늘이 이 여행의 날 중 하나인지. 맞으면 「여행 중」에 점을
 *               찍습니다
 */
export function TripTabs({
  tripId,
  active,
  onTrip = false,
  onBack,
}: {
  tripId: string;
  active: TripTabKey;
  onTrip?: boolean;
  /** 나가는 길. 안 주면 일정 화면으로 돌아갑니다. */
  onBack?: () => void;
}) {
  const router = useRouter();

  const go = (path: string) => () => {
    if (active === 'plan' && path === '/trip/[id]') {
      return;
    }
    /* replace 입니다. 갈래끼리 오가는 것은 <b>같은 층에서 자리를 옮기는
       일</b>이라, push 로 쌓으면 뒤로가기를 다섯 번 눌러야 여행 밖으로
       나갑니다. */
    router.replace({ pathname: path as never, params: { id: tripId } as never });
  };

  return (
    <TabBar
      onBack={onBack ?? (() => router.replace({ pathname: '/trip/[id]', params: { id: tripId } }))}
      items={[
        {
          key: 'plan',
          label: '일정',
          icon: 'calendar',
          active: active === 'plan',
          onPress: active === 'plan' ? () => {} : go('/trip/[id]'),
        },
        {
          key: 'travel',
          label: '여행 중',
          icon: 'flag',
          active: active === 'travel',
          dot: onTrip && active !== 'travel',
          onPress: active === 'travel' ? () => {} : go('/travel/[id]'),
        },
        {
          key: 'vote',
          label: '가고 싶은 곳',
          icon: 'thumbs-up',
          active: active === 'vote',
          onPress: active === 'vote' ? () => {} : go('/vote/[id]'),
        },
        {
          key: 'money',
          label: '가계부',
          icon: 'credit-card',
          active: active === 'money',
          onPress: active === 'money' ? () => {} : go('/money/[id]'),
        },
        {
          key: 'card',
          label: '요약',
          icon: 'book-open',
          active: active === 'card',
          onPress: active === 'card' ? () => {} : go('/card/[id]'),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  /*
    띠가 앉는 자리.

    <h3>뒤로 지도가 비쳤습니다</h3>

    <p>일정 화면은 지도가 바탕이라, 떠 있는 띠 뒤로 <b>지도가 그대로
    보였습니다.</b> 흰 판 위에서는 떠 있는 것으로 읽히던 모양이 지도 위에서는
    지도에 얹힌 조각으로 보입니다.

    <p>띠가 앉는 자리에 바탕색을 깝니다. 화면 아래 한 자락이 지도가 아니라
    <b>앱의 바닥</b>이라는 것이 보여야, 띠가 그 위에 놓인 것으로 읽힙니다.
  */
  dock: {
    backgroundColor: Colors.background,
    /* 비우라고 알려 준 높이와 실제 높이가 같아야 합니다. 안 맞으면 어떤
       화면은 띠 뒤로 한 줄이 들어가고 어떤 화면은 쓸데없이 떠 있습니다. */
    minHeight: TabDock,
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
  */
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
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
    fontSize: 11,
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
  back: {
    width: Tap.min,
    height: Tap.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
