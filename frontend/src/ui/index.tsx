import Ionicons from '@expo/vector-icons/Ionicons';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContentWidth, useBreakpoint, useWide } from './layout';

import {
  Colors,
  BandHeight,
  Gutter,
  Elevation,
  MaxContentWidth,
  Motion,
  Palette,
  Radius,
  ScreenGap,
  Spacing,
  TabDock,
  Tap,
  Type,
  Weight,
} from '@/constants/theme';

/**
 * 화면 어디서나 쓰는 조각들.
 *
 * <p>손에 쥔 폰을 먼저 생각하고 만들었습니다.
 *
 * <ul>
 *   <li>누르는 것은 무엇이든 44 아래로 내려가지 않습니다. 작아 보이는
 *       버튼도 hitSlop 으로 실제 넓이를 채웁니다.</li>
 *   <li>화면의 주 동작은 아래에 붙입니다. 한 손으로 쥐면 엄지가 닿는 곳은
 *       아래쪽이고, 위 모서리는 거의 닿지 않습니다.</li>
 *   <li>노치와 홈 인디케이터를 피해 여백을 잡습니다.</li>
 *   <li>입력칸 글자는 17 입니다. 16 아래면 iOS 사파리가 누를 때 화면을
 *       확대해 버립니다.</li>
 * </ul>
 */

/* ---------------------------------------------------------------- 움직임 */

/**
 * 누르면 살짝 눌리는 것.
 *
 * <p>색만 바뀌는 것으로는 눌렸는지 잘 모릅니다. 특히 어두운 화면에서는 밝기
 * 차이가 작아 더 그렇습니다. 손끝 아래에서 실제로 조금 작아지면, 화면을
 * 보지 않아도 닿았다는 것을 압니다.
 *
 * <p>reanimated 를 쓰지 않았습니다. 이 저장소에는 babel 설정 파일이 없어
 * 그 라이브러리가 요구하는 플러그인이 걸려 있지 않습니다. 켜려면 설정을 새로
 * 만들고 앱을 다시 빌드해야 하는데, 크기를 조금 줄이는 일에 그럴 것까지는
 * 없습니다. RN 이 기본으로 가진 Animated 로 충분합니다.
 */
const Squeezable = Animated.createAnimatedComponent(Pressable);

/**
 * 움직임을 줄이겠다고 해 둔 사람인지.
 *
 * <h3>왜 보는가</h3>
 *
 * <p>크기가 줄었다 늘고 아래에서 떠오르는 움직임은, 어지럼증이 있는 사람에게
 * <b>속이 울렁거리는 일</b>입니다. 그래서 iOS·안드로이드·웹 모두 「움직임
 * 줄이기」 설정을 두고 있습니다. 우리는 그것을 <b>한 번도 보지 않고</b>
 * 눌릴 때마다 줄이고 나타날 때마다 띄웠습니다.
 *
 * <p>끄는 것은 움직임뿐입니다. 눌렸다는 것은 색이 말하고, 나타난 것은 그냥
 * 거기 있습니다 — 움직임이 없어도 모자란 것이 없어야 켠 사람이 손해를 안
 * 봅니다.
 *
 * <h3>한 번만 묻지 않습니다</h3>
 *
 * <p>설정은 앱을 켜 둔 동안에도 바뀝니다. 처음 한 번만 물어 두면, 설정에서
 * 켜고 돌아온 사람에게는 <b>앱을 다시 켤 때까지</b> 안 먹습니다.
 */
function useCalm() {
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) {
        setCalm(on);
      }
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setCalm);
    return () => {
      alive = false;
      /* 웹에서 {@code matchMedia} 가 없으면 react-native-web 이 <b>아무것도
         돌려주지 않습니다.</b> 그대로 {@code .remove()} 를 부르면 화면을
         떠날 때마다 터집니다 — 웹을 미리 그려 내보내는 자리가 그렇습니다. */
      sub?.remove();
    };
  }, []);

  return calm;
}

export function Press({
  children,
  onPress,
  disabled,
  scale = 0.98,
  style,
  hoverStyle,
  pressedStyle,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * 얼마나 작아질지. 큰 판일수록 덜 줄어야 어색하지 않습니다.
   *
   * <p>계획서가 정한 것은 두 값입니다 — 큰 버튼·카드 0.98, 작은 버튼 0.96.
   * 전에 쓰던 0.88~0.94 는 손끝 아래에서 <b>물건이 쑥 꺼지는</b> 것처럼
   * 보였습니다.
   */
  scale?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link' | 'radio';
  accessibilityState?: { selected?: boolean; disabled?: boolean; busy?: boolean };
  hitSlop?: number;
  /**
   * 마우스를 얹었을 때.
   *
   * <p>손가락에는 「얹음」이 없어서 여태 없었습니다. 그런데 넓은 화면에는
   * 마우스가 있고, 마우스를 쓰는 사람은 <b>누르기 전에 얹어 보고</b> 무엇이
   * 눌리는지 가늠합니다. 아무 반응이 없으면 눌리는 것인지 그냥 글인지
   * 눌러 봐야 압니다.
   */
  hoverStyle?: StyleProp<ViewStyle>;
  /**
   * 눌려 있는 동안 얹는 모습. 대개 바탕색 한 겹입니다.
   *
   * <p>크기가 안 변하는 것({@code scale={1}})에 필요합니다 — 목록 줄처럼
   * 배경이 없는 자리에서 크기까지 그대로면 <b>눌렸는지 아닌지 아무 표시가
   * 없습니다.</b> 손끝 아래에서 무엇이 받아졌는지 모르면 한 번 더 누릅니다.
   */
  pressedStyle?: StyleProp<ViewStyle>;
}) {
  const value = useRef(new Animated.Value(1)).current;
  const calm = useCalm();
  const [down, setDown] = useState(false);
  const [over, setOver] = useState(false);

  const to = (next: number, duration: number) =>
    Animated.timing(value, {
      toValue: next,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  /*
    누르는 것 자체를 움직입니다.

    안쪽에 층을 하나 더 두고 그것만 움직이면, 넓이·높이를 정하는 스타일이
    껍데기가 아니라 그 안쪽에 걸립니다. 그러면 바깥 껍데기는 내용만큼만
    커져서, 화면 폭을 꽉 채워야 할 단추가 글자 크기로 쪼그라듭니다.
    껍데기와 움직이는 것을 하나로 둡니다.
  */
  return (
    <Squeezable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      /* 누를 때는 바로 붙고, 뗄 때는 조금 느긋하게 돌아옵니다. 둘이 같으면
         튕기는 것처럼 보입니다. */
      onPressIn={() => {
        to(calm ? 1 : scale, Motion.tap);
        if (pressedStyle) {
          setDown(true);
        }
      }}
      onPressOut={() => {
        to(1, Motion.base);
        if (pressedStyle) {
          setDown(false);
        }
      }}
      /* 손가락만 있는 기기에서는 이 둘이 영영 안 불립니다. 달아 두어도
         값이 안 듭니다. */
      onHoverIn={hoverStyle ? () => setOver(true) : undefined}
      onHoverOut={hoverStyle ? () => setOver(false) : undefined}
      style={[
        style,
        over && !down ? hoverStyle : null,
        down ? pressedStyle : null,
        { transform: [{ scale: value }] },
      ]}>
      {children}
    </Squeezable>
  );
}

/**
 * 나타날 때 아래에서 살짝 떠오르는 것.
 *
 * <p>목록이 한 번에 툭 나타나면 화면이 갈아 끼워진 것처럼 보입니다. 순서대로
 * 조금씩 늦게 떠오르면 눈이 위에서 아래로 따라 내려갑니다.
 *
 * @param order 몇 번째인지. 앞에서부터 조금씩 늦게 시작합니다.
 */
export function Rise({
  children,
  order = 0,
  style,
}: {
  children: React.ReactNode;
  order?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const calm = useCalm();
  /* 움직임을 줄이겠다고 해 둔 사람에게는 처음부터 다 보인 채로 둡니다.
     1 로 시작하면 아래 timing 이 돌아도 바뀌는 것이 없습니다. */
  const value = useRef(new Animated.Value(calm ? 1 : 0)).current;

  useEffect(() => {
    if (calm) {
      value.setValue(1);
      return;
    }
    /* 늦추는 것도 한도를 둡니다. 스무 번째 줄까지 차례를 기다리게 하면
       마지막 것이 나타날 때쯤엔 이미 굴려서 지나간 뒤입니다. */
    const delay = Math.min(order, 6) * 45;
    Animated.timing(value, {
      toValue: 1,
      duration: Motion.base,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, order, calm]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ 뼈대 */

/** 화면 바깥에서 스크롤을 움직여야 할 때 쓰는 손잡이. */
export type ScreenHandle = {
  /** 맨 위로. 목록에서 무언가를 골라 위쪽 지도를 보여 줘야 할 때 씁니다. */
  scrollToTop: () => void;
};

type ScreenProps = {
  children: React.ReactNode;
  /**
   * 스크롤과 함께 움직이지 않고 위에 붙어 있는 자리.
   *
   * 지도처럼 "아래 목록을 훑는 내내 계속 보여야 하는 것" 을 둡니다. 같이
   * 흘려보내면 목록에서 무언가를 고를 때마다 위로 되감아야 합니다.
   */
  header?: React.ReactNode;
  /** 화면의 주 동작. 아래에 고정해 엄지가 닿는 자리에 둡니다. */
  footer?: React.ReactNode;
  /**
   * 방금 한 일을 알리고 물러설 길을 주는 띠. {@link Snack} 을 둡니다.
   *
   * <p>목록 안에 끼우면 안 됩니다. 되돌릴 것은 대개 <b>방금 사라진 줄</b>
   * 이라, 그 자리에 띠를 놓으면 목록이 밀리면서 무엇이 사라졌는지가 더
   * 헷갈립니다. 목록 위에 띄웁니다.
   */
  snack?: React.ReactNode;
  /**
   * 아래에 붙는 갈래 띠. {@code <AppTabs />} 를 둡니다.
   *
   * <p>갈래 안에 있는 화면만 켭니다. 여행 하나에 들어간 뒤에는 그 여행의
   * 띠가 대신 서므로 여기서는 안 켭니다 — 띠가 둘이면 어느 것이 지금
   * 어디인지를 말하는지 알 수 없습니다.
   *
   * <p>여기서 만들지 않고 <b>받습니다.</b> 만들려면 이 파일이 띠를 부르고
   * 띠가 이 파일의 Icon·Press 를 부르는 고리가 생깁니다. 머리 아픈 고리를
   * 두느니 header·footer 와 같은 방식으로 받는 편이 낫습니다.
   *
   * <p>켜면 굴러가는 내용 아래를 그만큼 비웁니다. 안 그러면 마지막 줄이
   * 띠 뒤로 들어가 영영 안 보입니다.
   */
  tabs?: React.ReactNode;
  scroll?: boolean;
  /** 위에 막대(헤더)가 없는 화면이면 켭니다. 노치를 피해 여백을 넣습니다. */
  safeTop?: boolean;
  /**
   * 화면의 바탕 꼴 — 계획서 §3-1.
   *
   * <h3>간격이 띠와 겹쳐 있었습니다</h3>
   *
   * <p>덩어리 사이를 늘 12 띄우고 있었습니다. 카드를 늘어놓는 목록에서는
   * 그게 맞는데, <b>구역을 띠로 가르는 화면</b>에서는 띠 위아래로 12 가 더
   * 붙어 8짜리 띠가 32 자리를 먹었습니다 — 띠가 구역을 가르는 선이 아니라
   * 텅 빈 구간으로 보였습니다.
   *
   * <ul>
   *   <li>{@code plain} 흰 바탕에 덩어리 사이 12. 기본</li>
   *   <li>{@code banded} 띠가 가르는 화면. 사이를 안 띄웁니다</li>
   *   <li>{@code gray} 회색 바탕 위 카드. 넓은 화면의 대시보드에서만</li>
   * </ul>
   */
  variant?: 'plain' | 'banded' | 'gray';
};

/**
 * 자판이 올라와 있는가.
 *
 * <p>화면 맨 아래에는 홈 인디케이터를 피하려고 안전영역만큼 여백을 둡니다.
 * 자판이 올라오면 그 자리를 자판이 차지하므로, 여백을 그대로 두면 자판과
 * 버튼 사이가 뜬금없이 벌어집니다. 올라와 있는 동안만 여백을 걷습니다.
 */
function useKeyboardUp() {
  const [up, setUp] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setUp(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return up;
}

export const Screen = forwardRef<ScreenHandle, ScreenProps>(function Screen(
  {
    children,
    header,
    footer,
    snack,
    tabs,
    scroll = true,
    safeTop = false,
    variant = 'plain',
  },
  ref,
) {
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();
  const scroller = useRef<ScrollView>(null);
  const wide = useWide();

  /*
    본문이 넓어질 수 있는 한도.

    <p>스타일에 {@code maxWidth} 를 박아 두면 창이 아무리 넓어도 한 값입니다.
    680 으로 두면 1280짜리 창에서 양옆 300씩이 비고, 960 으로 두면 폰에서
    아무 일도 안 하다가 <b>태블릿에서 글줄이 너무 길어집니다.</b> 단계마다
    다른 값을 봐야 합니다.
  */
  const room = ContentWidth[useBreakpoint()];

  /*
    갈래 띠가 실제로 먹는 높이.

    <p>띠 몸통(TabDock)에 <b>안전영역까지</b> 더해야 바닥에서 띠 꼭대기까지의
    높이가 됩니다. 이것을 안 세고 TabDock 만 비워 두었더니, 아래 단추와 띠
    사이가 여덟 픽셀밖에 안 남아 둘이 붙어 보였습니다.
  */
  /*
    넓은 화면에서는 아래를 먹는 것이 없습니다.

    <p>갈래가 아래 띠가 아니라 <b>왼쪽 기둥</b>으로 서기 때문입니다. 그런데도
    아래를 그만큼 비우면 화면 끝에 64 + 안전영역이 남고, 바닥에 고정된 바가
    바닥에서 떠 있습니다.
  */
  const dock = tabs && !keyboardUp && !wide ? TabDock + Math.max(insets.bottom, Spacing.sm) : 0;

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: () => scroller.current?.scrollTo({ y: 0, animated: true }),
    }),
    [],
  );

  const body = (
    <View
      style={[
        styles.screenInner,
        variant === 'banded' ? styles.screenInnerBanded : null,
        { maxWidth: room },
      ]}>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, variant === 'gray' ? styles.screenGray : null]}
      /* 자판이 가리는 만큼 아래에서 밀어 올립니다.

         안드로이드는 예전에 창 자체가 줄어들어 손댈 일이 없었지만,
         Expo 54 부터 화면 끝까지 그리는 방식이 기본이라 이제 줄지 않습니다.
         두 쪽 다 직접 밀어야 합니다. */
      behavior="padding">
      {header ? (
        <View style={[styles.header, { paddingTop: (safeTop ? insets.top : 0) + Spacing.sm }]}>
          <View style={[styles.headerInner, { maxWidth: room }]}>{header}</View>
        </View>
      ) : null}

      {scroll ? (
        <ScrollView
          ref={scroller}
          contentContainerStyle={[
            styles.scrollBody,
            {
              /*
                맨 위 빈자리 — <b>없습니다.</b>

                <p>xxl(28) 이었다가 md(12) 로 줄였는데, 계획서가 정한 것은
                0 입니다. 위에는 이미 상단바가 서 있고, 그 아래 첫 줄은 대개
                띠나 큰 제목입니다 — 제 여백을 가진 것들 위에 또 띄우면
                화면을 열 때마다 <b>빈자리부터</b> 봅니다.
              */
              paddingTop: header ? 0 : safeTop ? insets.top : 0,
              /* 아래 버튼이 있으면 그 높이만큼, 없으면 홈 인디케이터 위로
                 64 를 비웁니다(계획서 §3-1). 48 이었는데, 마지막 줄이 화면
                 맨 끝에 닿아 있으면 더 굴릴 것이 있는지 없는지 모릅니다.
                 갈래 띠까지 있으면 그만큼 더 — 마지막 줄이 띠 뒤로 들어가면
                 아무리 굴려도 안 보입니다. */
              paddingBottom: (footer ? Spacing.s5 : insets.bottom + Spacing.s16) + dock,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.staticBody, { paddingTop: safeTop ? insets.top : 0 }]}>
          {body}
        </View>
      )}

      {/* 아래 단추가 있으면 그 위로 비켜 앉습니다 — 되돌리기를 누르려다
          엉뚱한 것을 누르면 되돌릴 수 있다는 말이 무색해집니다. */}
      {snack ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.snackSlot,
            { bottom: (keyboardUp ? 0 : insets.bottom) + (footer ? 84 : Spacing.lg) },
          ]}>
          {snack}
        </View>
      ) : null}

      {footer ? (
        <View
          style={[
            styles.footer,
            {
              /* 띠가 있으면 띠 <b>전체</b> 높이만큼 띄우고 그 위에 한 칸 더
                 둡니다. 붙어 있으면 단추와 띠가 한 덩어리로 읽힙니다. */
              paddingBottom: dock
                ? dock + Spacing.md
                : (keyboardUp ? 0 : insets.bottom) + Spacing.md,
            },
          ]}>
          <View style={[styles.footerInner, { maxWidth: room }]}>
            <OnFloor.Provider value>{footer}</OnFloor.Provider>
          </View>
        </View>
      ) : null}

      {/*
        갈래 띠. <b>단추보다 뒤에 그립니다.</b>

        <p>앞에 뒀더니 「내 여행」처럼 아래 단추가 있는 화면에서 띠가 통째로
        안 보였습니다. 단추 판은 흐름 안에 서고 제 바탕색을 가지는데, 띠는
        떠 있는 것이라 나중에 그린 쪽이 위에 옵니다 — 단추 판이 띠를 덮고
        있었습니다.

        <p>자판이 올라와 있으면 걷습니다. 글을 치는 동안 띠가 자판 위에
        얹혀 있으면 그것대로 자리를 먹습니다.
      */}
      {tabs && !keyboardUp ? tabs : null}
    </KeyboardAvoidingView>
  );
});

/**
 * 판. 관련 있는 것들을 하나로 묶습니다.
 *
 * <h3>두 가지입니다</h3>
 *
 * <p>기본은 <b>물건 카드</b>입니다 — 눌러서 들어가는 것(여행, 장소, 글).
 * 흰 바탕에 옅은 그림자로 떠 있습니다.
 *
 * <p>{@code tone="fill"} 은 <b>면 카드</b>입니다 — 주소·전화 같은 정보
 * 상자, 안내문, 합계. 회색 면에 그림자도 테두리도 없습니다. 눌리는 것이
 * 아니므로 떠 있을 이유가 없습니다.
 *
 * <p>전에는 면 카드가 없어서 화면마다 {@code backgroundColor: Colors.fill}
 * 상자를 손으로 만들고 있었습니다. 그래서 모서리가 8·12·16 으로 제각각이고
 * 안쪽 여백도 12·14·16 이 섞였습니다.
 */
export function Card({
  children,
  style,
  tone = 'raised',
  ...rest
}: ViewProps & { tone?: 'raised' | 'fill' }) {
  const [over, setOver] = useState(false);

  return (
    <View
      /*
        마우스를 얹으면 한 단 더 뜹니다.

        <p>넓은 화면에서는 눌리는 카드와 그냥 묶음인 카드가 생김새로 똑같습니다.
        손가락은 눌러 보는 수밖에 없지만 마우스는 얹어 볼 수 있으니, 얹었을 때
        떠오르는 것으로 「이것은 눌러서 들어가는 것」을 말합니다.

        <p>면 카드({@code tone="fill"})는 눌리는 것이 아니라 가만히 있습니다.
      */
      onPointerEnter={tone === 'fill' ? undefined : () => setOver(true)}
      onPointerLeave={tone === 'fill' ? undefined : () => setOver(false)}
      style={[
        styles.card,
        tone === 'fill' ? styles.cardFill : null,
        over ? Elevation.float : null,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

/**
 * 눌러서 들어가는 줄.
 *
 * <p>줄 전체가 눌리는 자리입니다. {@code right} 는 <b>표시만</b> 두는 곳이라
 * 누르는 것을 넣지 않습니다 — 누르는 자리 안에 누르는 자리를 넣으면 어디를
 * 누르는 것인지 알 수 없습니다.
 *
 * <p>줄에서 바로 해야 하는 곁다리가 있으면 {@code action} 입니다.
 */
export function ListRow({
  title,
  subtitle,
  left,
  right,
  action,
  last,
  danger,
  onPress,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 제목 앞에 서는 것. 갈래를 나타내는 {@link Mark} 가 대개 옵니다. */
  left?: React.ReactNode;
  right?: React.ReactNode;
  /**
   * 줄에서 바로 하는 곁다리. 대개 점 세 개입니다.
   *
   * <h3>판 밖에 두면 판이 짧아 보입니다</h3>
   *
   * <p>화면마다 {@code <Row><ListRow/><IconButton/></Row>} 로 옆에 붙이고
   * 있었습니다. 그런데 {@link ListRow} 자체가 흰 판이라, 옆에 붙인 단추는
   * <b>판 밖</b>에 섭니다 — 단추가 붙은 줄만 판이 그만큼 짧아져서, 목록의
   * 오른쪽 끝이 들쭉날쭉했습니다.
   *
   * <p>여기로 넘기면 판 안에 섭니다. 누르는 자리와는 갈라 두므로 점 세 개를
   * 눌러도 줄이 열리지 않습니다.
   */
  action?: React.ReactNode;
  /**
   * 목록의 마지막 줄인지.
   *
   * <p>마지막에는 선을 안 긋습니다. 목록이 끝났는데 선이 하나 더 있으면
   * 아래에 뭔가 더 있는 줄 압니다.
   */
  last?: boolean;
  /**
   * 되돌릴 수 없는 줄 — 「지우기」, 「나가기」.
   *
   * <p>제목과 앞 그림이 빨강으로 섭니다. 시트 안에 여느 줄들과 섞여 있을 때
   * 글자만 읽고 누르면 <b>지울 생각이 없던 것이 지워집니다.</b> 누르기 전에
   * 색으로 먼저 알아야 합니다.
   */
  danger?: boolean;
  /**
   * 눌렀을 때 하는 일. <b>없으면 안 눌립니다.</b>
   *
   * <p>전에는 반드시 받았습니다. 그래서 <b>누를 데가 없는 줄</b> — 값만
   * 적는 줄, 좌표가 없어 열 수 없는 장소, 순위 번호 — 은 이 부품을 못 쓰고
   * 화면마다 같은 모양을 손으로 다시 그렸습니다. 그렇게 그린 줄들은 아래
   * 선과 여백이 조금씩 어긋나서, 한 목록 안에서 줄 높이가 들쭉날쭉했습니다.
   *
   * <p>안 주면 선과 여백만 같은 <b>안 눌리는 줄</b>이 됩니다. 눌리지 않는
   * 것에 눌리는 꼴을 입히지 않으려고 읽어 주는 기기에도 단추라고 말하지
   * 않습니다.
   */
  onPress?: () => void;
}) {
  const inside = (
    <>
      {left}
      <View style={styles.listRowText}>
        <Text
          style={[styles.listRowTitle, danger ? styles.listRowTitleDanger : null]}
          numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </>
  );

  /*
    선은 줄 안에 떠 있는 한 겹입니다.

    <p>전에는 {@code borderBottom} 으로 그었습니다. 테두리는 그것을 가진
    상자의 <b>폭 전체</b>를 지나가므로, 앞에 그림이 선 줄에서도 선이 화면
    왼쪽 끝에서 시작했습니다 — 그러면 선이 「이 줄의 아래쪽」이 아니라
    「구역을 가르는 띠」처럼 보입니다.

    <p>글이 시작하는 자리에서부터 긋습니다. 앞에 그림이 있으면 그 그림
    너비와 사이 간격만큼 비켜서, 그림이 줄들을 왼쪽에서 이끄는 것으로
    읽힙니다.
  */
  const line = last ? null : (
    <View style={[styles.listRowLine, left ? styles.listRowLineInset : null]} />
  );

  /* 누를 데가 없는 줄. 선과 여백만 같습니다. */
  if (!onPress) {
    return (
      <View style={[styles.listRow, subtitle ? styles.listRowTwo : null]}>
        {inside}
        {action}
        {line}
      </View>
    );
  }

  if (!action) {
    return (
      <Press
        onPress={onPress}
        /* 크기를 안 줄입니다. 배경이 없는 줄에서 크기가 변하면 글자만
           들썩이는 것으로 보입니다 — 눌린 것은 바탕색이 말합니다. */
        scale={1}
        pressedStyle={styles.listRowDown}
        style={[styles.listRow, subtitle ? styles.listRowTwo : null]}>
        {inside}
        {line}
      </Press>
    );
  }

  /* 곁다리가 있는 줄은 선을 겉껍데기가 답니다. 누르는 자리 안에 두면 곁다리
     밑만 선이 끊겨서 줄이 중간에 잘린 것처럼 보입니다. */
  return (
    <View style={[styles.listRowHeld, subtitle ? styles.listRowTwo : null]}>
      <Press onPress={onPress} scale={1} pressedStyle={styles.listRowDown} style={styles.listRowTap}>
        {inside}
      </Press>
      {action}
      {line}
    </View>
  );
}

export function Row({ children, style, gap = Spacing.sm, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View style={[styles.row, { gap }, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * 왼쪽에 말하는 것, 오른쪽에 하는 것.
 *
 * <h3>왜 따로 두는가</h3>
 *
 * <p>화면마다 손으로 만들고 있었습니다 — {@code head}, {@code sheetHead},
 * {@code headTop}, {@code cardHead}, {@code sectionHead}, {@code groupHead},
 * {@code dayHeader}, {@code metaRow}, {@code totalRow}… 이름이 열셋인데 속은
 * 전부 같은 것이었고, 스물두 자리에 흩어져 있었습니다.
 *
 * <p>이름이 열셋이면 무엇을 하나 고칠 때 열세 군데를 찾아야 합니다. 제목과
 * 단추 사이를 한 눈금 넓히는 것 같은 일도 그렇습니다.
 *
 * <h3>맞춤은 세로만 고릅니다</h3>
 *
 * <p>가로로 양끝에 붙이는 것은 늘 같습니다. 세로는 자리마다 다릅니다 —
 * 글자끼리 나란히 놓을 때는 밑줄(baseline), 단추가 끼면 가운데(center),
 * 오른쪽이 여러 줄이면 위(start). 이 셋뿐입니다.
 */
export function Split({
  children,
  align = 'center',
  gap = Spacing.sm,
  style,
  ...rest
}: ViewProps & {
  /** 세로로 무엇에 맞출지. 글자끼리면 baseline, 단추가 끼면 center. */
  align?: 'center' | 'baseline' | 'start';
  gap?: number;
}) {
  return (
    <View
      style={[
        styles.split,
        { gap, alignItems: align === 'start' ? 'flex-start' : align },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

/**
 * 남는 자리를 다 먹는 칸.
 *
 * <p>{@link Split} 의 왼쪽에 대개 이것이 옵니다. 이름을 길게 적어 두고
 * 오른쪽 단추는 제 크기만 쓰게 하려면 왼쪽이 늘어나야 합니다. 이것도
 * {@code grow}·{@code half}·{@code name}·{@code who}·{@code identity} 처럼
 * 화면마다 다른 이름으로 같은 것을 적고 있었습니다.
 */
export function Grow({ children, style, gap, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View style={[styles.grow, gap === undefined ? null : { gap }, style]} {...rest}>
      {children}
    </View>
  );
}

/** 카드 안에서 내용을 가르는 얇은 선. */
export function Divider() {
  return <View style={styles.divider} />;
}

/**
 * 구역 머리 — 제목 한 줄, 오른쪽에 곁다리 하나.
 *
 * <h3>화면마다 제각각이었습니다</h3>
 *
 * <p>구역 제목을 화면이 저마다 만들어 쓰고 있었습니다. 어떤 데는
 * {@link Section} 의 흰 판 안에, 어떤 데는 {@link Title} 하나로, 어떤 데는
 * 화면 안에 손으로 만든 머리 묶음으로. 그래서 글자 크기도 위아래 여백도
 * 「더보기」가 붙는 자리도 다 달랐고, 화면을 옮겨 다니면 <b>같은 앱이
 * 아닌 것처럼</b> 보였습니다.
 *
 * <p>하나로 모읍니다. 바닥이 흰색이 된 뒤로 구역을 가르는 것은 띠와
 * <b>이 머리</b>뿐이라, 이것이 흔들리면 화면이 「도화지에 아무거나 올려
 * 둔 것」이 됩니다.
 *
 * <h3>위가 넓고 아래가 좁습니다</h3>
 *
 * <p>제목은 <b>아래 것의 이름</b>입니다. 위아래 여백이 같으면 제목이 제
 * 구역보다 위쪽 빈자리에 더 붙어 보여서, 어느 묶음의 이름인지 한 번 더
 * 봐야 합니다.
 *
 * <h3>띠 바로 아래면 위 여백을 걷습니다</h3>
 *
 * <p>띠와 이 머리가 붙어 있는 자리가 가장 흔한데, 그때 <b>빈자리가 56픽셀</b>
 * 이었습니다 — 띠 자신의 위아래 여백 12 둘, 화면이 덩어리 사이에 두는 12,
 * 그리고 이 머리의 위 여백 32 가 모두 더해졌습니다. 8픽셀 띠 하나를 두려고
 * 56을 비운 셈입니다.
 *
 * <p>그래서 「구역이 갈렸다」가 <b>띠가 아니라 빈자리</b>로 읽혔습니다. 띠는
 * 그 넓은 흰 바닥 가운데에 놓인 희미한 줄 하나였고, 화면은 어디가 한 묶음인지
 * 말하지 않는 도화지가 됐습니다.
 *
 * @param action 「더보기」처럼 이 구역에서 바로 하는 일. 없으면 안 섭니다
 * @param note   제목 아래 한 줄. 이 구역이 무엇인지 설명할 때만
 * @param tight  바로 위가 띠일 때. 위 여백을 띠에게 맡깁니다
 */
export function SectionHeader({
  title,
  action,
  note,
  tight = false,
}: {
  title: string;
  action?: React.ReactNode;
  note?: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <View style={[styles.sectionHeader, tight ? styles.sectionHeaderTight : null]}>
      <View style={styles.sectionHeaderTop}>
        <Text style={styles.sectionHeaderTitle} numberOfLines={1}>
          {title}
        </Text>
        {action}
      </View>
      {note ? <Text style={styles.sectionHeaderNote}>{note}</Text> : null}
    </View>
  );
}

/**
 * 구역을 가르는 회색 띠.
 *
 * <h3>선 대신 띠입니다</h3>
 *
 * <p>전에는 구역마다 흰 카드를 하나씩 두고 회색 바닥이 그 사이로 비치게
 * 했습니다. 그러면 <b>모든 것이 카드</b>가 되어야 해서, 글 한 줄을 놓으려
 * 해도 상자를 만들어야 했습니다. 상자가 늘면 화면이 사각형의 더미가 됩니다.
 *
 * <p>바닥을 흰색으로 돌리고 구역 사이에 8픽셀 띠를 깝니다. 카드는 <b>눌러서
 * 들어가는 물건</b>(여행·장소·글)에만 남습니다.
 *
 * <p>화면 좌우 여백 밖으로 밀어 내 끝까지 닿게 합니다. 여백 안에 머물면
 * 띠가 아니라 가운데 떠 있는 회색 막대가 됩니다.
 */
export function Band() {
  return <View style={styles.band} />;
}

/* ------------------------------------------------------------------ 글씨 */

/**
 * 글자와 아이콘의 색.
 *
 * inverse 는 색으로 채운 자리 위에 얹는 것입니다. 다녀온 핀 속의 표시처럼
 * 바탕이 진할 때 씁니다.
 */
type Tone =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'danger'
  | 'success'
  | 'accent'
  /** 지금·오늘·여기. 강조(라임)와 색상환 반대편이라 나란히 놓아도 안 죽습니다. */
  | 'hot'
  | 'warning'
  | 'brand'
  /**
   * 꺼진 갈래 — 아래 띠와 기둥의 안 고른 칸.
   *
   * <p>{@code muted} 를 쓰고 있었습니다. 그 값이 메타 글자색이라 한 단
   * 진해지면서, <b>라벨만 흐려지고 아이콘은 진한 채로</b> 남았습니다 — 한
   * 칸 안에서 글자와 그림이 다른 세기로 서면 꺼진 것으로도 켜진 것으로도
   * 안 읽힙니다.
   */
  | 'off'
  | 'inverse';

const toneColor: Record<Tone, string> = {
  default: Colors.text,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  danger: Colors.danger,
  success: Colors.success,
  /*
    글자와 아이콘의 "강조" 는 여전히 검정입니다.

    이 이름은 화면 마흔 군데에서 <b>가장 강한 것</b>이라는 뜻으로 쓰입니다 —
    사용자 이름, 메뉴 그림, 적어 둔 시각, 숙소 표시. 강조색을 코랄로 들이면서
    이것까지 코랄로 돌렸더니 한 화면에 코랄이 열 군데씩 생겼고, 그러면
    정작 눌러야 할 것이 안 보입니다.

    색을 쓰는 자리는 키트가 직접 정합니다 — 주 단추, 고른 칩, 체크, 고른 줄,
    지금 쓰고 있는 칸. 그것 말고는 검정입니다.
   */
  accent: Colors.text,
  /** 코랄을 글자로 써야 하는 드문 자리. 옅은 물 위에 얹을 때만. */
  brand: Colors.accentInk,
  hot: Colors.hot,
  warning: Colors.warning,
  off: Colors.iconOff,
  /* 색으로 채운 자리 위에 얹는 것. 우리 강조색은 모두 밝아서, 그 위에는
     어두운 글자가 올라가야 읽힙니다. */
  inverse: Colors.onDay,
};

const toneSoft: Record<Tone, string> = {
  default: Colors.fill,
  secondary: Colors.fill,
  muted: Colors.fill,
  danger: Colors.dangerSoft,
  success: Colors.successSoft,
  accent: Colors.accentSoft,
  hot: Colors.hotSoft,
  warning: Colors.warningSoft,
  brand: Colors.accentSoft,
  off: Colors.fill,
  /* 바탕이 이미 진한 자리에 쓰므로 무른 배경은 두지 않습니다. */
  inverse: 'transparent',
};

/**
 * 여기가 <b>바닥에 고정된 자리</b>인지.
 *
 * <h3>왜 문맥으로 아는가</h3>
 *
 * <p>색을 가득 칠하는 단추는 화면에 하나면 됩니다. 그 하나는 늘 바닥에
 * 붙어 있는 것입니다 — "12곳 일정에 넣기", "쓴 돈 적기" 처럼 이 화면에
 * 들어온 목적 그 자체인 것들입니다. 카드 안에 있는 단추는 그것이 아닙니다.
 *
 * <p>그 규칙을 호출부마다 적게 하면 열다섯 군데에 같은 판단이 흩어지고,
 * 언젠가 한 곳이 어긋납니다. 바닥이 스스로 "여기는 바닥" 이라고 알리고
 * 단추가 그것을 읽습니다.
 */
const OnFloor = createContext(false);



/** 화면의 제목. 한 화면에 하나만. */
export function Title({ children, tone }: { children: React.ReactNode; tone?: Tone }) {
  return <Text style={[styles.title, tone ? { color: toneColor[tone] } : null]}>{children}</Text>;
}

/** 카드나 묶음의 제목. */
export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Body({
  children,
  tone = 'default',
  strong,
  small,
  numberOfLines,
  selectable,
  style,
}: {
  children: React.ReactNode;
  tone?: Tone;
  strong?: boolean;
  small?: boolean;
  numberOfLines?: number;
  /** 주소처럼 사람이 긁어 가야 하는 글. */
  selectable?: boolean;
  /** 색을 계산해서 넣어야 할 때만. 여백은 감싸는 쪽에서 잡습니다. */
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        small ? styles.bodySmall : styles.body,
        strong && styles.strong,
        { color: toneColor[tone] },
        style,
      ]}
      numberOfLines={numberOfLines} selectable={selectable}>
      {children}
    </Text>
  );
}

export function Caption({
  children,
  tone = 'muted',
  strong,
  numberOfLines,
}: {
  children: React.ReactNode;
  tone?: Tone;
  strong?: boolean;
  numberOfLines?: number;
}) {
  return (
    <Text
      style={[styles.caption, strong && styles.strong, { color: toneColor[tone] }]}
      numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ 입력 */

export function Field({
  label,
  hint,
  error,
  style,
  multiline,
  onFocus,
  onBlur,
  action,
  mark,
  required,
  onClear,
  unit,
  limit,
  ...rest
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  /**
   * 입력칸 오른쪽 끝에 붙는 단추.
   *
   * <p>찾기처럼 <b>친 것을 가지고 바로 하는 일</b>에 씁니다. 아래에 따로 두면
   * 칸과 단추 사이가 벌어져 둘이 한 벌로 안 읽히고, 그만큼 세로로 길어집니다.
   */
  action?: { icon: IconName; label: string; onPress: () => void; disabled?: boolean };
  /**
   * 같은 자리에 놓되 <b>누르는 것이 아닌</b> 표식.
   *
   * <p>치는 대로 걸러지는 칸에는 누를 것이 없습니다. 그런 자리에도 돋보기를
   * 단추로 달아 두었더니, 눌러도 아무 일이 안 일어나는 단추가 다섯 곳에
   * 생겼습니다. 눌리는 모양인데 안 눌리면 고장으로 읽힙니다.
   *
   * <p>그렇다고 떼어 버리면 이 칸이 찾는 칸인지 적는 칸인지가 안 보입니다.
   * 그려는 두되 누르는 것이 아니게 둡니다.
   */
  mark?: IconName;
  /** 안 적으면 넘어갈 수 없는 칸. 라벨 뒤에 점이 붙습니다. */
  required?: boolean;
  /**
   * 적은 것을 한 번에 지우는 ⓧ.
   *
   * <p>길게 적은 것을 지우려면 백스페이스를 스무 번 눌러야 했습니다. 폰에서
   * 글자 사이에 커서를 놓는 것은 생각보다 어려운 일이라, 대개는 다 지우고
   * 다시 칩니다.
   */
  onClear?: () => void;
  /** 「원」, 「명」 처럼 칸 안 오른쪽에 붙는 단위. 누르는 것이 아닙니다. */
  unit?: string;
  /** 몇 자까지. 힌트 오른쪽에 「12/40」 이 섭니다. */
  limit?: number;
}) {
  /* 지금 쓰고 있는 칸이 어디인지 보이게 합니다. 칸이 여럿 붙어 있으면
     커서만으로는 눈에 잘 띄지 않습니다. */
  const [focused, setFocused] = useState(false);

  /*
    비밀번호를 한 번 보여 주기.

    <h3>왜 필요한가</h3>

    <p>점으로만 가려 두면 <b>잘못 친 것을 알 길이 없습니다.</b> 폰 자판에서
    긴 비밀번호를 치면 한두 자는 흔히 틀리는데, 틀린 줄도 모르고 「로그인
    실패」만 보게 됩니다 — 그러면 비밀번호가 틀렸는지 계정이 없는지도
    구별이 안 됩니다.

    <p>{@code secureTextEntry} 를 받은 칸은 스스로 눈을 답니다. 호출부
    여섯 자리가 각자 상태를 들고 있을 일이 아닙니다.
  */
  const [shown, setShown] = useState(false);
  const secret = rest.secureTextEntry === true;

  const typed = typeof rest.value === 'string' ? rest.value : '';
  /* 글이 있을 때만 섭니다. 빈 칸에 지우기 단추가 있으면 누를 수 있는 줄
     알고 눌러 보게 됩니다. */
  const clearable = onClear != null && typed.length > 0 && !rest.editable === false;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.labelDot}> ●</Text> : null}
      </Text>
      <View
        /*
          상자가 바깥에 섭니다.

          <h3>줄 하나였습니다</h3>

          <p>밑줄형이었습니다 — 「회색으로 채운 칸이 여럿 놓이면 그 덩어리가
          먼저 눈에 들어온다」가 까닭이었고, 바닥이 회색이던 때는 맞는
          말이었습니다. 바닥이 흰색이 된 뒤로는 <b>칸이 어디서 시작해 어디서
          끝나는지</b>가 밑줄 한 가닥뿐이라, 적는 자리가 글줄처럼 보였습니다.

          <p>상자를 두릅니다. 테두리는 안쪽이 아니라 <b>바깥 껍데기</b>가
          가집니다 — 안쪽 {@code TextInput} 에 두르면 단추와 단위가 그 선
          밖에 서서, 칸과 그것들이 따로 놀았습니다.
        */
        style={[
          styles.box,
          multiline ? styles.boxMultiline : null,
          focused ? styles.boxFocused : null,
          error ? styles.boxError : null,
          rest.editable === false ? styles.boxOff : null,
        ]}>
        <TextInput
          placeholderTextColor={Colors.textDisabled}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          maxLength={limit}
          style={[styles.input, multiline ? styles.inputMultiline : null, style]}
          {...rest}
          /* {@code rest} 뒤에 둡니다. 앞에 두면 호출부가 넘긴
             {@code secureTextEntry} 가 이것을 덮어써서 눈이 안 먹습니다. */
          secureTextEntry={secret && !shown}
        />
        {secret ? (
          <IconButton
            name={shown ? 'eye' : 'eye-off'}
            label={shown ? '비밀번호 감추기' : '비밀번호 보기'}
            tone="muted"
            onPress={() => setShown((was) => !was)}
          />
        ) : null}
        {unit ? <Text style={styles.fieldUnit}>{unit}</Text> : null}
        {clearable ? (
          <IconButton name="x" label={`${label} 지우기`} tone="muted" onPress={onClear} />
        ) : null}
        {action ? (
          <IconButton
            name={action.icon}
            label={action.label}
            tone="accent"
            disabled={action.disabled}
            onPress={action.onPress}
          />
        ) : mark ? (
          <Icon name={mark} tone="muted" />
        ) : null}
      </View>
      {error ? (
        <View style={styles.fieldNote}>
          <Icon name="alert" size={14} tone="danger" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hint || limit ? (
        <View style={styles.fieldNote}>
          <Text style={styles.hint}>{hint}</Text>
          {/* 몇 자 남았는지. 다 쓰고 나서 잘리는 것보다 치는 동안 보이는
              편이 낫습니다. */}
          {limit ? (
            <Text style={styles.hint}>
              {typed.length}/{limit}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * 찾는 칸.
 *
 * <h3>두 가지가 섞여 있었습니다</h3>
 *
 * <p>여덟 자리에서 같은 묶음을 손으로 적고 있었는데, 속을 보니 둘이 섞여
 * 있었습니다. <b>치는 대로 걸러지는 것</b>(보석함, 여행 목록)과 <b>눌러야
 * 물어보는 것</b>(장소 찾기, 추천, 둘러보기)입니다.
 *
 * <p>앞쪽 다섯 자리에도 돋보기가 단추로 달려 있었고, 누르면
 * {@code () => {}} 였습니다. 눌리는 모양인데 아무 일도 안 일어납니다.
 *
 * <p>여기서 가릅니다. {@code onSearch} 를 주면 눌러서 묻는 칸이 되고, 안
 * 주면 돋보기는 표식으로만 남습니다 — 치는 대로 이미 걸러지고 있으니
 * 누를 것이 없습니다.
 *
 * <h3>적는 칸과 찾는 칸은 다르게 생겨야 합니다</h3>
 *
 * <p>여태 {@link Field} 를 그대로 감싸고 있었습니다. 그래서 찾는 칸이
 * <b>라벨이 붙은 흰 상자</b>로 섰습니다 — 「이름」, 「메모」 와 똑같은
 * 생김새입니다. 찾는 칸은 적어 넣는 칸이 아니라 <b>걸러 보는 칸</b>이고,
 * 화면 맨 위에서 한 번 쓰고 지나가는 자리입니다.
 *
 * <p>계획서대로 회색 면에 테두리 없이, 높이 44, 앞에 돋보기를 둡니다. 라벨은
 * 글자로 안 보이고 읽어 주는 기기만 씁니다 — 돋보기가 이미 무슨 칸인지
 * 말하므로, 그 위에 「찾기」를 한 번 더 적으면 같은 말이 두 번입니다.
 */
export function SearchField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  onSearch,
  busy,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  hint?: string;
  /** 눌러야 묻는 칸이면 줍니다. 안 주면 치는 대로 걸러지는 칸입니다. */
  onSearch?: () => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Row gap={Spacing.s2}>
        <View style={styles.seek}>
          {/* 앞에 섭니다. 뒤에 두면 글자가 길어질 때 돋보기가 밀려서
              칸이 적는 칸처럼 보입니다. */}
          <Icon name="search" tone="muted" />
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={Colors.textDisabled}
            accessibilityLabel={label}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={onSearch}
            style={styles.input}
          />
          {/* 묻는 동안에는 지우기 자리에 도는 표시를 둡니다. 「찾기」 단추가
              없어진 뒤로 여기가 「묻는 중」을 말하는 유일한 자리입니다. */}
          {busy ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : value.length > 0 ? (
            <IconButton
              name="x"
              label={`${label} 지우기`}
              tone="muted"
              onPress={() => onChangeText('')}
            />
          ) : null}
        </View>
        {/*
          「찾기」 단추를 뗐습니다.

          <p>칸 옆에 바이올렛 단추가 늘 서 있어서, 찾기 화면의 첫 주 동작이
          「단추를 누르는 것」처럼 보였습니다. 묻는 것은 자판의 검색 키(엔터)가
          합니다 — 모바일 자판은 이 칸에서 검색 키를 띄웁니다(returnKeyType).
          단추가 자리를 비우면 칸이 한 줄을 다 씁니다.
        */}
      </Row>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * 단추의 세기 일곱.
 *
 * <h3>넷으로는 모자랐습니다</h3>
 *
 * <p>전에는 {@code primary · secondary · danger · ghost} 넷이었습니다.
 * 그래서 화면마다 모자란 것을 <b>손으로 만들었습니다</b> — 「더보기」는
 * 테두리를 직접 두르고, 「따라 하기」는 옅은 바이올렛 상자를 직접 깔고,
 * 시트의 「삭제」는 {@code danger} 를 써서 옅은 빨강 덩어리가 됐습니다.
 * 같은 일을 하는 단추가 화면마다 다르게 생긴 까닭이 이것입니다.
 *
 * <h3>{@code danger} 가 뒤집혔습니다</h3>
 *
 * <p>전에 {@code danger} 는 <b>옅은 빨강 면 + 빨간 글씨</b>였습니다. 그게
 * 계획서의 {@code dangerText} 자리인데, 가장 중요한 자리 — 한 번 더 묻는
 * 판의 「지웁니다」 — 가 그 옅은 모양을 쓰고 있었습니다. 되돌릴 수 없는
 * 일을 받는 단추가 <b>가장 흐릿하게</b> 서 있었던 것입니다.
 *
 * <p>{@code danger} 는 가득 칠합니다. 목록·시트에서 글줄처럼 서는 「삭제」는
 * {@code dangerText} 입니다.
 */
type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'tonal'
  | 'text'
  | 'danger'
  | 'dangerText'
  /** @deprecated {@code 'text'} 를 쓰세요. 같은 모습입니다. */
  | 'ghost';

/**
 * 단추의 크기 네 단 — 계획서 §3-5.
 *
 * <p>{@code l} 52 바닥에 고정된 바·시트 바닥·로그인 /
 * {@code m} 44 화면 안의 동작·다이얼로그 /
 * {@code s} 36 목록 줄 끝·카드 안 /
 * {@code xs} 30 글에 붙어 있는 「편집」·「+ 추가」
 */
type ButtonSize = 'l' | 'm' | 's' | 'xs';

export function Button({
  label,
  onPress,
  onMap,
  variant = 'primary',
  size,
  icon,
  iconAfter,
  disabled,
  busy,
  compact,
  strong,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /**
   * 글자 앞에 서는 그림.
   *
   * <h3>글리프를 글자에 섞어 넣고 있었습니다</h3>
   *
   * <p>이것이 없어서 호출부가 라벨 안에 {@code '필터 ⚙'} 처럼 글리프를
   * 적었습니다. 그 글자들은 <b>기기 글꼴에 있을 때만</b> 그려집니다 —
   * 안드로이드에서는 판과 글꼴에 따라 색깔 이모지로 뜨거나 아예 두부
   * 네모(□)가 됩니다. 글리프가 두부가 되면 단추가 고장 난 것으로 보입니다.
   *
   * <p>{@link Icon} 은 번들에 든 글꼴이라 어디서나 같게 그려집니다.
   */
  icon?: IconName;
  /** 글자 뒤에 서는 그림. 「⌄」 처럼 <b>열린다</b>를 말하는 것에 씁니다. */
  iconAfter?: IconName;
  /**
   * 크기. 안 주면 {@code compact} 가 {@code 's'}, 아니면 {@code 'l'} 입니다.
   */
  size?: ButtonSize;
  /**
   * 이 화면에서 <b>제일 하려던 일</b>인지.
   *
   * <h3>옅은 단추가 꺼진 단추로 보였습니다</h3>
   *
   * <p>주 단추는 카드 안에서 옅은 코랄 바탕에 코랄 글씨였습니다. 회색 바닥
   * 위 흰 단추들 사이에서는 그것으로 충분했는데, <b>흰 판 위에 혼자 서 있을
   * 때</b>는 연분홍 덩어리가 되어 눌리지 않는 것처럼 보였습니다. 남의 일정
   * 상세의 「내 여행으로 가져오기」 가 그 자리입니다 — 그 화면에 들어온
   * 까닭인데 못 누르는 것처럼 생겼습니다.
   *
   * <p>바닥에 고정된 단추가 이미 꽉 채워집니다. 그 세기를 화면 한가운데
   * 서는 단추도 쓸 수 있게 열어 둡니다.
   *
   * <p>화면에 <b>하나만</b> 씁니다. 둘이 되는 순간 둘 다 아무 말도 안 합니다.
   */
  strong?: boolean;
  /**
   * 지도 위에 얹히는 단추인지.
   *
   * <p>지도 위에서는 네모난 단추가 건물·구획과 섞여 어디까지가 단추인지
   * 안 보입니다. 알약으로 둥글리고 흰 바탕에 그림자를 두어 떠 있게 합니다.
   *
   * <p>그림만 있는 동그란 단추({@link IconButton} 의 {@code onMap})와 달리
   * 여기에는 글자가 남아 있습니다. 무슨 일이 일어나는지 눌러 보기 전에
   * 알아야 하는 것 — 내가 어디 있는지가 남에게 가는 일 같은 것 — 은 그림
   * 하나로 둘 수 없습니다.
   */
  onMap?: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** 줄 안에 들어가는 작은 버튼. 보이는 높이만 줄이고 누르는 넓이는 그대로입니다. */
  compact?: boolean;
}) {
  const off = disabled || busy;
  /* 훅은 늘 같은 차례로 불려야 합니다 — 조건 안에서 부르면 안 됩니다. */
  useContext(OnFloor);

  /* 못 누르는 버튼은 흐리게 만드는 대신 아예 다른 색으로 둡니다. 투명도만
     낮추면 그 아래 배경이 비쳐 글자가 읽기 어려워집니다. */
  /*
    단추의 세기.

      주 동작   바이올렛으로 꽉 채우고 흰 글씨
      보조      회색 면에 검은 글씨
      위험      옅은 빨강 면에 빨간 글씨
      곁다리    아무것도 없는 바이올렛 글자 — 링크

    <h3>이제 가득 칠합니다</h3>

    <p>옛 코랄은 글씨를 질 수 없는 색이었습니다. 밝게 두면 흰 글씨가 안
    읽히고 어둡게 두면 코랄이 아니라 팥색이 됐습니다. 그래서 주 단추를
    <b>옅은 물에 코랄 글씨</b>로 뒤집었는데, 흰 판 위에 혼자 서면 연분홍
    덩어리가 되어 <b>꺼진 단추처럼</b> 보였습니다.

    <p>바이올렛 500 은 흰 글씨와 5.3:1 입니다. 가득 칠해도 읽힙니다 — 그래서
    주 단추가 주 단추로 보입니다.

    <p>{@code strong} 과 {@code OnFloor} 로 「이것만 채운다」를 가르던 길도
    없앱니다. primary 는 늘 채워집니다. <b>화면에 하나만</b> 쓰면 됩니다.

    <p>못 누를 때는 흐리게 만들지 않고 아예 옅은 바이올렛으로 둡니다. 투명도만
    낮추면 그 아래 배경이 비쳐 글자가 더 안 읽힙니다.
  */
  const palette: Record<
    ButtonVariant,
    { bg: string; pressed: string; fg: string; border?: string }
  > = {
    primary: { bg: Colors.accent, pressed: Colors.accentPressed, fg: Colors.onAccent },
    secondary: { bg: Colors.fill, pressed: Colors.fillPressed, fg: Colors.text },
    /* 흰 바탕에 진한 회색 테두리. 「더보기」처럼 눌러도 되지만 주가 아닌 것 */
    outline: {
      bg: Colors.surface,
      pressed: Colors.surfaceRaised,
      fg: Colors.text,
      border: Colors.borderStrong,
    },
    /* 옅은 바이올렛. 강조하지만 주가 아닌 것 — 따라 하기, 담기 */
    tonal: { bg: Colors.accentSoft, pressed: Colors.accentSoftPressed, fg: Colors.accentText },
    text: { bg: 'transparent', pressed: Colors.fill, fg: Colors.accentInk },
    danger: { bg: Colors.danger, pressed: '#C32B2E', fg: Colors.onAccent },
    dangerText: { bg: 'transparent', pressed: Colors.dangerSoft, fg: Colors.danger },
    ghost: { bg: 'transparent', pressed: Colors.fill, fg: Colors.accentInk },
  };
  const c = palette[variant];
  const bare = variant === 'text' || variant === 'ghost' || variant === 'dangerText';
  const offBg = bare ? 'transparent'
    : variant === 'primary' ? Colors.accentDisabled
    : Colors.fill;
  const offFg = variant === 'primary' ? Colors.onAccent : Colors.textDisabled;

  /*
    크기.

    <p>{@code compact} 는 오래 쓰던 이름이라 그대로 둡니다 — 쉰 군데에
    흩어져 있고, 뜻은 계획서의 {@code s} 와 같습니다. {@code size} 를 주면
    그것이 이깁니다.
  */
  const step: ButtonSize = size ?? (compact ? 's' : 'l');
  const shape = {
    l: styles.buttonL,
    m: styles.buttonM,
    s: styles.buttonS,
    xs: styles.buttonXS,
  }[step];
  const letters = {
    l: styles.buttonLabelL,
    m: styles.buttonLabelM,
    s: styles.buttonLabelS,
    xs: styles.buttonLabelXS,
  }[step];
  /* 보이는 높이가 44 보다 작으면 그만큼 누르는 넓이를 넓혀 줍니다. */
  const slop =
    step === 's' ? Tap.compactSlop : step === 'xs' ? Tap.tinySlop : undefined;
  /* 그림은 글자보다 한 단 큽니다 — 계획서 §3-5 의 L20 · M18 · S16 · XS14. */
  const glyph = { l: 20, m: 18, s: 16, xs: 14 }[step];

  return (
    <Press
      onPress={onPress}
      disabled={off}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      hitSlop={slop}
      /* 계획서 §2-7 — 큰 것 0.98, 작은 것 0.96. 전에 쓰던 0.94 는 줄 안의
         작은 단추가 손끝 아래에서 쑥 꺼지는 것처럼 보였습니다. */
      scale={step === 'l' || step === 'm' ? 0.98 : 0.96}
      pressedStyle={off ? undefined : { backgroundColor: c.pressed }}
      style={[
        styles.button,
        shape,
        onMap ? styles.buttonOnMap : null,
        { backgroundColor: off ? offBg : c.bg },
        c.border && !off ? { borderWidth: 1, borderColor: c.border } : null,
      ]}>
      {busy ? (
        <ActivityIndicator color={off ? offFg : c.fg} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={glyph} tone="inherit" color={off ? offFg : c.fg} /> : null}
          <Text style={[letters, { color: off ? offFg : c.fg }]} numberOfLines={1}>
            {label}
          </Text>
          {iconAfter ? (
            <Icon name={iconAfter} size={glyph} tone="inherit" color={off ? offFg : c.fg} />
          ) : null}
        </>
      )}
    </Press>
  );
}

/** 켜고 끄는 한 줄짜리 선택지. 필터에 씁니다. */
/**
 * 무엇을 볼지 고르는 알약.
 *
 * <h3>고른 것을 색으로 꽉 채우지 않습니다</h3>
 *
 * <p>한때 고른 칩을 강조색으로 가득 채웠습니다. 그랬더니 갈래를 거르는
 * 칩 하나와 "일정에 넣기" 단추가 화면에서 같은 무게로 섰습니다. 둘은
 * 같은 일이 아닙니다 — 하나는 <b>보는 방식</b>을 바꾸고 하나는 <b>실제로
 * 무슨 일을 일으킵니다.</b>
 *
 * <p>고른 칩은 옅은 물을 깔고 글씨만 강조색으로 둡니다. 눈에는 충분히
 * 걸리고, 색을 가득 쓰는 자리는 화면에 하나만 남습니다.
 */
/**
 * 여럿 중 하나를 고르는 단추.
 *
 * <h3>칩을 늘어놓는 것이 화면을 다 먹었습니다</h3>
 *
 * <p>고를 것이 열댓이면 칩이 두세 줄로 접혀 화면 위쪽을 통째로 차지합니다.
 * 그런데 고르는 일은 <b>가끔 한 번</b>이고 나머지 시간에는 고른 결과를
 * 봅니다 — 자리를 늘 차지하는 쪽과 반대입니다.
 *
 * <p>한 칸으로 접습니다. 지금 무엇을 고른 상태인지는 그 칸이 말하고,
 * 누르면 판이 올라와 전부 보여 줍니다. 두 줄이 한 칸이 됩니다.
 *
 * <p>칩을 아주 없애지는 않습니다. 셋 이하로 고정된 것(예: 전체/내 것/동행)은
 * 칩이 낫습니다 — 한 번에 다 보이고 한 번에 눌립니다.
 */
export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
  allLabel = '전체',
}: {
  /** 무엇을 고르는 것인지. 칸에 "갈래 · 카페" 처럼 붙습니다. */
  label: string;
  /** 지금 고른 것. null 이면 안 고른 것입니다. */
  value: T | null;
  options: { value: T; label: string; hint?: string }[];
  onChange: (next: T | null) => void;
  /** 안 고른 상태에 적을 말. */
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = options.find((o) => o.value === value) ?? null;

  return (
    <>
      <Press
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label} 고르기. 지금 ${picked?.label ?? allLabel}`}
        hitSlop={Tap.compactSlop}
        scale={0.96}
        style={[
          styles.chip,
          {
            backgroundColor: picked ? Colors.accentSoft : Colors.surface,
            borderColor: picked ? Colors.accent : Colors.border,
          },
        ]}>
        <Text style={[styles.chipLabel, picked ? { color: Colors.accentInk } : null]}>
          {label} · {picked?.label ?? allLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={picked ? Colors.accentInk : Colors.textSecondary}
        />
      </Press>

      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        {/* 안 고른 상태로 돌아가는 길을 맨 위에 둡니다. 고른 뒤에 되돌리는
            것은 자주 있는 일인데, 목록 끝까지 내려가서 찾게 할 일이
            아닙니다. */}
        <ListRow
          title={allLabel}
          right={value === null ? <Icon name="check" tone="accent" /> : undefined}
          onPress={() => {
            onChange(null);
            setOpen(false);
          }}
        />
        {options.map((option) => (
          <ListRow
            key={option.value}
            title={option.label}
            subtitle={option.hint}
            right={value === option.value ? <Icon name="check" tone="accent" /> : undefined}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityState={{ selected }}
      hitSlop={Tap.compactSlop}
      scale={0.93}
      style={[
        styles.chip,
        {
          /*
            고른 것은 <b>검정 반전</b>입니다.

            <h3>바이올렛으로 채웠다가 되돌렸습니다</h3>

            <p>옅은 물에 색 글씨 → 바이올렛 가득 채움 → 검정 반전으로 두 번
            옮겼습니다. 가운데 단계의 까닭은 「바닥이 흰색이 되니 고른 것과
            안 고른 것이 둘 다 밝은 면이라 안 갈린다」였고, 그 진단은 맞았는데
            <b>약을 잘못 골랐습니다.</b>

            <p>칩은 <b>한 번에 여럿 켜집니다.</b> 갈래 셋에 지역 둘을 걸어
            두면 바이올렛 덩어리가 다섯입니다. 그러면 같은 화면의 주 단추 —
            정말로 무슨 일을 일으키는 하나 — 가 그 다섯과 같은 무게로 서서
            묻힙니다. 색을 가득 쓰는 자리는 화면에 하나여야 합니다.

            <p>검정은 몇 개가 켜져도 그 일이 안 생깁니다. 또렷하게 갈리고,
            브랜드색을 안 먹습니다.
          */
          backgroundColor: selected ? Colors.text : Colors.surface,
          borderColor: selected ? Colors.text : Colors.borderStrong,
        },
      ]}>
      <Text
        style={[
          styles.chipLabel,
          selected ? styles.chipLabelOn : null,
          { color: selected ? Colors.onDay : Colors.textSecondary },
        ]}>
        {label}
      </Text>
    </Press>
  );
}

/**
 * 켜고 끄는 스위치.
 *
 * <h3>왜 칩이 아닌가</h3>
 *
 * <p>칩 하나로 켜고 끄면 글자가 두 가지 뜻으로 읽힙니다. "이후 날들도 같은
 * 곳" 이라고 적혀 있을 때 그것이 <b>지금 그렇다</b> 는 말인지 <b>누르면
 * 그렇게 된다</b> 는 말인지가 갈립니다. 실제로 이미 켜져 있는 것을 누르려다
 * 끄는 일이 생겼습니다.
 *
 * <p>스위치는 그 둘이 갈리지 않습니다. 글자는 무엇에 대한 것인지만 말하고,
 * 켜졌는지는 손잡이의 자리가 말합니다.
 */
export function Switch({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  /** 켰을 때 무슨 일이 일어나는지. 필요할 때만 답니다. */
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  /* 손잡이가 미끄러져 갑니다. 툭 바뀌면 눌렸는지 알기 어렵습니다. */
  const slide = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: value ? 1 : 0,
      duration: Motion.base,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [value, slide]);

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={Tap.compactSlop}
      style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>

      <View
        style={[
          styles.switchTrack,
          { backgroundColor: value ? Colors.accent : Colors.borderStrong },
        ]}>
        <Animated.View
          style={[
            styles.switchKnob,
            {
              transform: [
                /* 51 − 안쪽 2 둘 − 손잡이 27 = 20. 손잡이 크기가 바뀌면
                   이 값도 같이 바뀌어야 해서 셈으로 적어 둡니다. */
                { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 51 - 4 - 27] }) },
              ],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

/**
 * 고른 것에 찍는 네모.
 *
 * <h3>왜 칩이 아닌가</h3>
 *
 * <p>칩은 <b>무엇을 볼지</b> 고르는 것입니다 — 갈래, 정렬, 통화. 누르면
 * 화면에 보이는 것이 바뀝니다.
 *
 * <p>체크는 <b>무엇을 가지고 갈지</b> 고르는 것입니다. 여러 개를 골라 두고
 * 마지막에 한 번에 처리합니다. 둘은 다른 일인데 지금까지 칩 하나로 둘 다
 * 하고 있었고, 그래서 화면에 칩이 늘어서 있으면 그중 무엇이 거르는 것이고
 * 무엇이 담는 것인지 눌러 보기 전에는 몰랐습니다.
 *
 * <h3>색으로만 말하지 않습니다</h3>
 *
 * <p>고른 줄은 바탕이 옅게 깔리지만, 무채색 화면에서 그것 하나로는
 * "눌렀나?" 가 남습니다. 네모가 채워지는 것이 눈에 훨씬 잘 걸립니다.
 */
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  /** 무엇을 고르는 것인지. 눈에는 안 보이고 읽어 주는 기기만 씁니다. */
  label: string;
}) {
  return (
    <Press
      onPress={onChange}
      scale={0.88}
      hitSlop={Spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: checked }}
      style={styles.checkTap}>
      <View style={[styles.check, checked ? styles.checkOn : null]}>
        {checked ? <Icon name="check" size={20} tone="inverse" /> : null}
      </View>
    </Press>
  );
}

/**
 * 그림과 이름이 함께 있는, 눌러서 고르는 칸.
 *
 * <h3>무엇을 대신하는가</h3>
 *
 * <p>핀 그림 고르기({@code icon-picker})와 동행자 얼굴 고르기({@code
 * settings})가 이것을 각각 따로 만들고 있었습니다. 이모지가 줄 높이 때문에
 * 아래로 처지는 것을 막는 {@code lineHeight: undefined} 한 줄까지 주석째
 * 복사돼 있었습니다.
 *
 * <h3>이름을 함께 답니다</h3>
 *
 * <p>그림만 늘어놓으면 뜻을 짐작해야 합니다. 이모지는 기기마다 다르게 생겨,
 * 어떤 폰에서는 라멘과 우동이 거의 같아 보입니다. 다만 얼굴 고르기처럼
 * 이름을 붙일 것이 없는 자리도 있어, 없으면 그림만 그립니다.
 */
export function ChoiceTile({
  mark,
  icon,
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  /** 칸에 그릴 것. 이모지 한 글자거나, 그림이 없으면 비웁니다. */
  mark?: string;
  /** 선 그림. 앱이 정한 갈래(장소 갈래)는 이모지 대신 이것으로 그립니다. */
  icon?: IconName;
  /** 그림 아래 적는 말. 없으면 그림만. 그림이 없으면 이것이 대신 들어갑니다. */
  label?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.9}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[styles.tile, label ? null : styles.tileBare, selected ? styles.tileOn : null]}>
      {icon ? (
        <Icon name={icon} size={24} tone={selected ? 'accent' : 'secondary'} />
      ) : mark ? (
        <Text style={styles.tileMark}>{mark}</Text>
      ) : null}
      {label ? (
        <Text
          style={[
            mark ? styles.tileLabel : styles.tileLabelAlone,
            { color: selected ? Colors.accentInk : mark ? Colors.textMuted : Colors.textSecondary },
          ]}>
          {label}
        </Text>
      ) : null}
    </Press>
  );
}

/**
 * 갈래를 나타내는 그림 한 칸.
 *
 * <h3>아이콘 체계가 둘입니다</h3>
 *
 * <p>화면에는 선으로 그린 UI 아이콘(Ionicons)과 이모지가 같이 삽니다. 섞여
 * 있으면 어설퍼 보이는데, 그렇다고 이모지를 걷을 수도 없습니다 — Ionicons
 * 287개를 뒤져도 온천·초밥·라멘·신사는 없습니다. 그쪽은 도구를 그리는
 * 세트이지 갈래를 그리는 세트가 아닙니다.
 *
 * <p>그래서 걷는 대신 <b>가릅니다.</b> 선 아이콘은 <b>누르는 것</b>이고
 * 이모지는 <b>그 곳이 무엇인가</b>입니다. 뜻이 다르니 사는 자리도 다릅니다 —
 * 선 아이콘은 맨몸으로 서고, 이모지는 늘 이 칸 안에 들어갑니다.
 *
 * <p>칸에 담기 전에는 이모지가 글자 사이에 그냥 박혀 있었습니다
 * ({@code `${iconOf(icon)} ${name}`}). 그러면 기기마다 다른 높이로 그려져
 * 글줄이 들쭉날쭉하고, 이모지가 없는 곳만 줄이 어긋납니다.
 */
export function Mark({
  icon,
  emoji,
  fallback,
  active,
}: {
  /**
   * 선 그림. 장소 갈래·지출 갈래처럼 <b>앱이 정한 갈래</b>는 이것으로 그립니다.
   *
   * <p>이모지는 사람이 고른 표식(모임·여행·얼굴)에만 남깁니다 — 사람이 고른
   * 것은 기종마다 달라도 그 사람의 것이지만, 앱이 정한 갈래가 폰마다 다르게
   * 생기면 같은 화면이 다른 앱처럼 보입니다.
   */
  icon?: IconName | null;
  /** 이모지 한 글자. 없으면 fallback 을 그립니다. */
  emoji?: string | null;
  /** 그림이 없을 때 대신 적을 것. 순서 번호나 별. */
  fallback?: React.ReactNode;
  /** 지금 켜져 있는 것. 바탕이 옅게 물듭니다. */
  active?: boolean;
}) {
  return (
    <View style={[styles.mark, active ? styles.markOn : null]}>
      {icon ? (
        <Icon name={icon} size={20} tone={active ? 'accent' : 'secondary'} />
      ) : emoji ? (
        <Text style={styles.markEmoji}>{emoji}</Text>
      ) : typeof fallback === 'string' || typeof fallback === 'number' ? (
        <Text style={styles.markFallback}>{fallback}</Text>
      ) : (
        fallback
      )}
    </View>
  );
}

/**
 * 지금 걸려 있는 조건 하나. 누르면 풀립니다.
 *
 * <h3>왜 칩과 다른가</h3>
 *
 * <p>{@link Chip} 은 <b>고를 수 있는 것</b>을 늘어놓습니다 — 아홉 개가 있으면
 * 아홉 개가 다 서 있어야 무엇을 고를 수 있는지 알 수 있습니다.
 *
 * <p>이것은 <b>이미 고른 것</b>입니다. 고른 것만 서 있으면 되고, 대개 하나나
 * 둘입니다. 그래서 고르는 자리는 판 안으로 들어가고 밖에는 이것만 남습니다.
 * 아홉 개가 늘 펼쳐져 있으면, 정작 보러 온 목록이 늘 화면 밖에서 시작합니다.
 *
 * <p>누르면 풀립니다. 조건 하나를 빼려고 판을 다시 열게 하지 않습니다.
 */
export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Press
      onPress={onRemove}
      accessibilityLabel={`${label} 조건 빼기`}
      hitSlop={Tap.compactSlop}
      scale={0.93}
      style={styles.filterChip}>
      <Text style={styles.filterChipLabel}>{label}</Text>
      <Icon name="x" size={17} tone="brand" />
    </Press>
  );
}

/**
 * 상태를 한눈에 보여 주는 작은 표식. 누르는 것이 아닙니다.
 *
 * <h3>테두리 대신 옅은 바탕</h3>
 *
 * <p>글자색과 같은 색으로 테두리를 둘렀습니다. 그래서 <code>success</code> 나
 * <code>default</code> 처럼 진한 톤에서는 <b>검은 실선 한 칸</b>이 되어,
 * 둥근 카드들 사이에서 그것만 날카로웠습니다.
 *
 * <p>선을 걷고 옅은 바탕을 깝니다. 배지는 상태를 알리는 것이지 경계를
 * 긋는 것이 아닙니다.
 */
/**
 * 작은 꼬리표.
 *
 * <h3>노란 배지가 안 읽혔습니다</h3>
 *
 * <p>옅은 면 + 같은 색 글자 한 가지만 있었습니다. 대개는 그것으로 되는데,
 * <b>노랑</b>에서 깨집니다 — 옅은 노랑 면에 노란 글자는 흰 바탕에서 대비가
 * 2:1 도 안 됩니다. 그래서 「D-3」, 「여행 중」 같은 가장 눈에 띄어야 하는
 * 것들을 {@code home.tsx} 와 {@code trip/[id].tsx} 가 <b>손으로</b> 노란
 * 상자에 검은 글자로 그리고 있었습니다.
 *
 * <p>{@code solid} 를 둡니다. 색을 가득 칠하고 글자는 그 위에서 읽히는
 * 것으로 뒤집습니다 — 노란 면 위는 늘 Ink 입니다(§2-3).
 */
export function Badge({
  label,
  tone = 'muted',
  solid,
}: {
  label: string;
  tone?: Tone;
  solid?: boolean;
}) {
  return (
    <View
      style={[styles.badge, { backgroundColor: solid ? toneColor[tone] : toneSoft[tone] }]}>
      <Text
        style={[
          styles.badgeLabel,
          { color: solid ? (tone === 'hot' ? Colors.onHot : Colors.onDay) : toneColor[tone] },
        ]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * 두어 개 중 하나를 고르는 띠.
 *
 * 로그인/회원가입처럼 서로 대신하는 화면을 오갈 때 씁니다. 링크로 두면
 * 눌러 본 뒤에야 무엇이 있는지 알지만, 띠로 두면 고를 수 있는 것이 처음부터
 * 다 보입니다.
 */
/**
 * 별 다섯.
 *
 * <h3>읽는 것과 주는 것이 한 부품입니다</h3>
 *
 * <p>{@code onChange} 를 주면 누를 수 있고, 안 주면 보여 주기만 합니다.
 * 둘을 따로 만들면 별 크기와 사이가 어긋나는데, 같은 화면에 「우리 4.6」과
 * 「나도 남기기」가 나란히 서므로 그 어긋남이 바로 보입니다.
 *
 * <h3>반쪽 별은 안 그립니다</h3>
 *
 * <p>평균이 4.6 이면 별 넷과 반이 맞지만, 반쪽 별을 그리려면 별 하나를
 * 두 겹으로 겹쳐 잘라야 합니다. 대신 <b>가까운 쪽으로 채우고 숫자를 옆에
 * 적습니다</b> — 「★★★★★ 4.6」 입니다. 숫자가 이미 정확하므로 그림이
 * 반까지 맞출 이유가 없습니다.
 *
 * @param value   채울 개수. 평균이면 소수여도 됩니다
 * @param onChange 주면 누를 수 있습니다. 누른 별 개수가 옵니다
 * @param size    별 하나의 크기. 목록에서는 14, 남기는 자리에서는 32
 */
export function Stars({
  value,
  onChange,
  size = 16,
  label,
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: number;
  /** 누를 수 있을 때 읽어 주는 기기에 붙는 이름. 「맛」·「별점」 같은 것 */
  label?: string;
}) {
  const filled = Math.round(value);

  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <Press
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            accessibilityState={{ selected: n <= filled }}
            accessibilityLabel={`${label ?? '별점'} ${n}점`}
            /* 별 하나가 32 라도 누르는 자리는 44 를 채웁니다. */
            hitSlop={Math.max(0, (Tap.min - size) / 2)}
            scale={0.96}>
            <Icon name="star" size={size} solid={n <= filled} tone={n <= filled ? 'hot' : 'off'} />
          </Press>
        ) : (
          <Icon
            key={n}
            name="star"
            size={size}
            solid={n <= filled}
            tone={n <= filled ? 'hot' : 'off'}
          />
        ),
      )}
    </View>
  );
}

/**
 * 못 누르는 꼬리표.
 *
 * <h3>칩과 생김새를 가릅니다</h3>
 *
 * <p>「#오사카」, 「3박 4일」 처럼 글 카드에 붙는 것입니다. 이것들을
 * {@link Chip} 으로 그리면 <b>눌러서 거를 수 있는 것</b>처럼 보입니다 —
 * 실제로 눌러 보면 아무 일도 안 일어납니다.
 *
 * <p>그래서 칩과 반대로 둡니다. 칩은 키 34 에 둥근 알약, 테두리가 있습니다.
 * 이것은 키 22 에 모서리 4, 회색 면이고 테두리가 없습니다.
 *
 * <p>{@code feed-card.tsx} 가 같은 모양을 손으로 그리고 있었습니다. 글
 * 카드가 둘러보기·좋아요·내 글 세 화면에 서는데, 한 군데서만 고치면
 * 나머지 둘이 어긋납니다.
 */
export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagLabel}>{label}</Text>
    </View>
  );
}

/**
 * 내용 갈래를 바꾸는 상단 탭.
 *
 * <h3>{@link SegmentedTabs} 와 무엇이 다른가</h3>
 *
 * <p><b>보기만 바뀌면 Segmented, 내용 갈래가 바뀌면 Tabs</b> 입니다.
 * 일정순·폴더별은 <b>같은 것들</b>을 다르게 늘어놓는 것이고(Segmented),
 * 모임 여행·피드는 <b>다른 것들</b>을 보는 것입니다(Tabs).
 *
 * <p>여태 둘 다 {@link SegmentedTabs} 였습니다. 그래서 화면 위쪽이 회색
 * 알약으로 가득 찼고 — 「내 여행」은 알약 묶음이 둘이나 섰습니다 — 무엇을
 * 눌렀을 때 <b>목록이 다시 그려지는지 내용이 통째로 바뀌는지</b>가 생김새로
 * 안 갈렸습니다.
 *
 * <p>알약은 제 바탕을 가진 묶음이라 「이 안에서 고른다」는 뜻이 강합니다.
 * 밑줄 탭은 화면 폭을 가로지르는 선 위에 서므로 「여기서부터 아래가
 * 바뀐다」로 읽힙니다. 그것이 내용 갈래가 하는 일입니다.
 *
 * @param items 2~6개. 더 많으면 가로로 굴러가고 화면 끝에서 잘립니다
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  /*
    칸이 많으면 가로로 굴립니다.

    <p>여섯을 넘으면 글자가 줄어들다 말줄임이 되는데, 그러면 어느 갈래인지
    읽을 수가 없습니다. 잘리게 두는 편이 낫습니다 — 오른쪽이 잘려 있으면
    옆으로 밀어 볼 수 있다는 것이 그 자체로 보입니다.
  */
  const roll = items.length > 4;

  const row = (
    <View style={[styles.tabsRow, roll ? styles.tabsRoll : null]} accessibilityRole="tablist">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Press
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            /* 크기를 안 줄입니다. 글자가 선 위에 앉아 있어, 줄어들면
               밑줄과 글자가 따로 움직이는 것으로 보입니다. */
            scale={1}
            style={styles.tabsItem}>
            <Text style={[styles.tabsLabel, selected ? styles.tabsLabelOn : null]}>
              {item.label}
            </Text>
            {/* 밑줄은 <b>글자 폭만큼</b>입니다. 칸 전체에 그으면 칸 넓이가
                글자 길이에 따라 달라서, 긴 이름의 밑줄이 유난히 길어집니다. */}
            {selected ? <View style={styles.tabsUnder} /> : null}
          </Press>
        );
      })}
    </View>
  );

  /*
    선은 화면 끝까지, 글자는 글자선에.

    <h3>둘을 같이 맞출 수 없었습니다</h3>

    <p>선을 칸들과 같은 {@code View} 에 들고 있었습니다. 그러면 호출부가
    고를 수 있는 것이 둘 중 하나뿐입니다 — 좌우 여백 밖으로 끌어내서 선을
    끝까지 가게 하면 <b>첫 칸 글자가 12 에서 시작</b>하고, 안쪽 여백을 주면
    그만큼 <b>선이 되돌아와</b> 어중간하게 끊깁니다.

    <p>그래서 여기서 두 겹으로 둡니다. 바깥 겹이 좌우 여백 밖으로 나가 선을
    긋고, 안쪽 줄이 여백을 되돌려 첫 글자를 20 에 세웁니다. 호출부는 아무것도
    안 감싸면 됩니다 — 여섯 화면이 저마다 {@code marginHorizontal: -Gutter}
    를 적고 있던 것이 이것으로 사라집니다.
  */
  if (!roll) {
    return <View style={styles.tabs}>{row}</View>;
  }

  return (
    <View style={styles.tabs}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        /* 잘려 있다는 것이 보여야 옆으로 밀어 볼 수 있다는 것을 압니다. */
        contentContainerStyle={styles.tabsRowPad}>
        {row}
      </ScrollView>
    </View>
  );
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  /* 알약 한 칸의 너비를 알아야 미끄러뜨릴 수 있습니다. 칸은 고르게 나누므로
     전체를 재서 수로 나눕니다. */
  const [wide, setWide] = useState(0);
  const at = Math.max(0, items.findIndex((item) => item.value === value));
  const slide = useRef(new Animated.Value(at)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: at,
      damping: Motion.spring.damping,
      stiffness: Motion.spring.stiffness,
      mass: Motion.spring.mass,
      useNativeDriver: true,
    }).start();
  }, [at, slide]);

  const cell = wide > 0 ? (wide - SEGMENT_PAD * 2) / items.length : 0;

  return (
    <View
      style={styles.segment}
      onLayout={(e) => setWide(e.nativeEvent.layout.width)}
      accessibilityRole="tablist">
      {/*
        고른 칸을 덮는 알약.

        <p>칸마다 바탕을 켜고 끄면 <b>꺼지고 켜지는</b> 것으로 보입니다.
        하나짜리 알약이 옮겨 가면 <b>같은 것이 움직인</b> 것으로 보이고,
        그래야 둘이 한 벌이라는 것이 읽힙니다.

        <p>글자 뒤에 깔립니다. 위에 얹으면 글자를 가립니다.

        <p>칸이 하나뿐이면 안 그립니다 — 옮겨 갈 데가 없고, 보간에는 눈금이
        둘 이상 있어야 합니다.
      */}
      {cell > 0 && items.length > 1 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentPill,
            {
              width: cell,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: items.map((_, i) => i),
                    outputRange: items.map((_, i) => i * cell),
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            /* 칸은 띠의 안쪽 여백만큼 작습니다. 그 여백은 알약이 테두리에 안
               붙게 두는 자리인데, 손가락에게는 <b>띠인데 안 눌리는 테</b>였
               습니다 — 끝을 누르면 아무 일도 안 일어납니다. 보이는 띠 전체가
               눌리게 채웁니다. */
            hitSlop={Tap.compactSlop}
            style={styles.segmentItem}>
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelOn]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 띠 가장자리와 알약 사이. 알약이 테두리에 붙으면 눌린 것처럼 보입니다. */
const SEGMENT_PAD = 4;

/**
 * 판 위에 있는가.
 *
 * <p>{@link Panel} 이 스스로 "여기는 흰 판" 이라고 알리고, 그 안의 카드가
 * 그것을 읽어 <b>제 바탕과 테두리를 걷습니다.</b> 흰 판 위에 흰 카드를
 * 얹으면 층이 둘인데 눈에는 하나로 보여, 테두리만 공연히 늘어납니다.
 *
 * <p>호출부마다 "지금 판 안이니 납작하게" 를 넘기게 하면 같은 판단이
 * 여러 군데로 흩어지고 언젠가 한 곳이 어긋납니다. 바닥 단추가 쓰는 것과
 * 같은 방식입니다.
 */
const OnPanel = createContext(false);

/**
 * 같은 종류를 한 장에 담는 흰 판.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>회색 바닥 위에 카드들이 저마다 떠 있었습니다. 카드 하나하나는 흰데
 * 사이가 전부 회색이라, 네 칸이 <b>한 묶음</b>이라는 것이 안 읽히고 따로
 * 놓인 네 개로 보였습니다. 묶음이면 한 장에 담아야 묶음입니다.
 *
 * <p>안에 든 것들은 제 바탕을 걷고 이 판을 바탕으로 씁니다.
 */
export function Panel({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.panel, style]} {...rest}>
      <OnPanel.Provider value>{children}</OnPanel.Provider>
    </View>
  );
}

/**
 * 첫 화면에 늘어놓는 메뉴 카드.
 *
 * <p>두 칸씩 나란히 섭니다(`wide` 면 한 줄 전체). 좁은 폰에서도 두 칸이
 * 들어가도록 폭을 비율로 잡습니다.
 *
 * <p>그림 없이 글자만 씁니다. 뜻이 분명한 아이콘 묶음이 없는 상태에서
 * 아무 그림이나 붙이면 뜻을 돕지 못하고 장식만 됩니다.
 *
 * <p>한동안 뒤에 사진을 옅게 깔았습니다. 카드마다 다른 얼굴을 주려던
 * 것인데, 네 장이 나란히 서니 무엇에 대한 카드인지를 돕기보다 <b>글자를
 * 읽는 데 방해</b>가 되었습니다. 걷어 냈습니다.
 *
 * <p>아직 만들지 않은 것은 `soon` 으로 둡니다. 눌러도 아무 일이 없으면
 * 고장 난 것처럼 보이므로 아예 누를 수 없게 하고 그렇다고 적어 둡니다.
 */
export function MenuCard({
  title,
  caption,
  wide,
  soon,
  onPress,
}: {
  title: string;
  caption: string;
  wide?: boolean;
  soon?: boolean;
  onPress?: () => void;
}) {
  /* 흰 판 안이면 제 바탕과 테두리를 걷습니다. 판이 이미 바탕입니다. */
  const flat = useContext(OnPanel);

  return (
    <Press
      onPress={onPress}
      disabled={soon || !onPress}
      accessibilityState={{ disabled: !!soon }}
      scale={0.965}
      style={[
        styles.menuCard,
        wide ? styles.menuCardWide : styles.menuCardHalf,
        flat ? styles.menuCardFlat : null,
        soon ? styles.menuCardSoon : null,
      ]}>
      <View style={styles.menuText}>
        <Row gap={Spacing.sm}>
          <Text style={[styles.menuTitle, soon && styles.menuTitleSoon]}>{title}</Text>
          {soon ? <Badge label="준비 중" tone="muted" /> : null}
        </Row>
        <Text style={styles.menuCaption}>{caption}</Text>
      </View>
      {/* 셰브론은 <b>넓은 카드에만</b> 붙어 있었습니다. 넷 다 눌리는 것인데
          하나만 화살표가 있으면 나머지는 안 눌리는 것처럼 보입니다.
          넓은 카드는 글자가 왼쪽에 몰려 오른쪽이 비므로 그때만 답니다 —
          반쪽 카드는 글자가 이미 칸을 채워, 화살표를 끼우면 이름이 줄어듭니다. */}
      {wide && !soon ? <Text style={styles.menuChevron}>›</Text> : null}
    </Press>
  );
}

/* ------------------------------------------------------------------ 아이콘 */

/** 쓰는 아이콘 이름만 열어 둡니다. 아무거나 부르면 화면마다 결이 흐트러집니다. */
export type IconName =
  | 'check'
  | 'info'
  | 'alert'
  | 'eye'
  | 'eye-off'
  | 'credit-card'
  | 'home'
  /* 동선 정리. 순서를 다시 세운다는 뜻으로 이만한 그림이 없습니다. */
  | 'shuffle'
  | 'edit-2'
  | 'trash-2'
  | 'settings'
  | 'maximize'
  | 'minimize'
  | 'x'
  | 'plus'
  | 'minus'
  | 'search'
  | 'map-pin'
  | 'calendar'
  | 'users'
  | 'share-2'
  | 'log-out'
  | 'user-minus'
  | 'chevron-left'
  /** 줄 끝에서 "눌러서 들어간다" 는 표시 */
  | 'chevron-right'
  | 'navigation'
  | 'clock'
  | 'phone'
  | 'external-link'
  | 'crosshair'
  | 'chevron-down'
  | 'chevron-up'
  | 'arrow-up'
  | 'arrow-down'
  | 'folder'
  /**
   * 즐겨찾기가 아닙니다.
   *
   * <p>한동안 <b>보석함에 담기</b>와 <b>가고 싶은 곳</b>을 둘 다 별로
   * 그렸습니다. 그런데 별은 어느 앱에서나 "즐겨찾기" 나 "몇 점" 을
   * 뜻해서, 담는 것도 고르는 것도 아닌 제삼의 뜻으로 읽혔습니다.
   *
   * <p>지금은 아무 데도 안 씁니다. 되살릴 일이 생기면 <b>점수</b>를
   * 매기는 자리여야 합니다.
   */
  | 'star'
  /** 보석함. 담고 꺼내는 일 전부 이 그림입니다. */
  | 'bookmark'
  /** 여행 요약. 덮어 둔 것을 펼쳐 보는 뜻입니다. */
  | 'book-open'
  /** 가고 싶은 곳. 각자 좋다·아니다를 누르는 자리입니다. */
  | 'thumbs-up'
  | 'compass'
  | 'message-square'
  | 'upload'
  /** 끌어서 옮기는 손잡이 */
  | 'menu'
  /** 여기 있다고 꽂아 두는 깃발 */
  | 'flag'
  /** 소식함. 내가 없는 동안 무엇이 바뀌었는지 */
  | 'bell'
  /**
   * 더 있다는 표시.
   *
   * <p>상단에 그림을 여섯 세우면 아무것도 안 읽힙니다. 자주 쓰는 둘만
   * 세우고 나머지는 이것으로 접습니다. 세로 점(more-vertical)이 아니라
   * 가로 점입니다 — 가로줄 안에 서는 것이라 줄의 흐름을 안 끊습니다.
   */
  | 'more-horizontal'
  /** 종이로 뽑기 */
  | 'printer'
  /** 파일로 받기. 엑셀처럼 기기에 내려받는 것들 */
  | 'download'
  /** 이 일정을 본떠 새로 만들기 */
  | 'copy'
  /** 사진. 다니면서 볼 것을 챙겨 두는 자리에 씁니다 */
  | 'image'
  /** 여행 안내판. 여행 내내 볼 것을 붙여 두는 판입니다 */
  | 'clipboard'
  /* 장소 갈래 · 지출 갈래. 이모지였던 것을 선 그림 한 벌로 옮겼습니다 —
     이모지는 기종마다 생김새가 달라 같은 화면이 폰마다 다르게 보였습니다. */
  | 'restaurant'
  | 'cafe'
  | 'fish'
  | 'flame'
  | 'ice-cream'
  | 'beer'
  | 'bag'
  | 'camera'
  | 'leaf'
  | 'water'
  | 'bed'
  | 'train'
  | 'happy'
  | 'color-palette'
  | 'ticket'
  | 'wallet'
  | 'thumbs-down'
  /* 이동 수단. 장소와 장소 사이에 적어 두는 길(trip/[id] 의 LegLine). */
  | 'bus'
  | 'walk'
  | 'car'
  | 'airplane'
  | 'boat';

/**
 * 이름 하나가 가리키는 두 가지 — 선과 채움.
 *
 * <h3>왜 세트를 바꿨는가</h3>
 *
 * <p>페더(Feather)에는 <b>채운 그림이 없습니다.</b> 그래서 아래 갈래 띠의
 * 켜짐·꺼짐을 그릴 수가 없었습니다 — 상용 앱이 거의 다 쓰는 「꺼지면 선,
 * 켜지면 채움」을 못 하니, 켜진 칸을 색 하나로만 가려야 했고 그것이 띠를
 * 밋밋하게 만들었습니다.
 *
 * <p>세트를 섞는 길도 있었지만 획 굵기가 달라 엉성해 보입니다. 한 세트로
 * 통일합니다. Ionicons 는 {@code @expo/vector-icons} 에 이미 들어 있어
 * 새로 받을 것이 없습니다.
 *
 * <p>여기 한 곳만 고치면 화면 이백 군데가 따라 바뀝니다 — 화면들은 옛
 * 이름을 그대로 부르고 이 표가 번역합니다.
 */
const ionicon: Record<IconName, { line: string; solid: string }> = {
  check: { line: 'checkmark', solid: 'checkmark' },
  info: { line: 'information-circle-outline', solid: 'information-circle' },
  /* 무엇이 잘못됐다는 표식. 「알림」(bell)과 다릅니다 — 이것은 적은 것이
     규칙에 안 맞는다는 말이고, 오류 글자 앞에만 섭니다. */
  alert: { line: 'alert-circle-outline', solid: 'alert-circle' },
  /* 비밀번호를 보여 주는 눈. 뜬 눈이 「지금 보인다」입니다 — 감은 눈을
     「보기」 단추로 쓰면 눌렀을 때 감기는 것인지 떠지는 것인지 헷갈립니다. */
  eye: { line: 'eye-outline', solid: 'eye' },
  'eye-off': { line: 'eye-off-outline', solid: 'eye-off' },
  'credit-card': { line: 'card-outline', solid: 'card' },
  home: { line: 'home-outline', solid: 'home' },
  shuffle: { line: 'shuffle-outline', solid: 'shuffle' },
  'edit-2': { line: 'create-outline', solid: 'create' },
  'trash-2': { line: 'trash-outline', solid: 'trash' },
  settings: { line: 'settings-outline', solid: 'settings' },
  maximize: { line: 'expand-outline', solid: 'expand' },
  minimize: { line: 'contract-outline', solid: 'contract' },
  x: { line: 'close', solid: 'close' },
  plus: { line: 'add', solid: 'add' },
  minus: { line: 'remove', solid: 'remove' },
  search: { line: 'search-outline', solid: 'search' },
  'map-pin': { line: 'location-outline', solid: 'location' },
  calendar: { line: 'calendar-outline', solid: 'calendar' },
  users: { line: 'people-outline', solid: 'people' },
  'share-2': { line: 'share-social-outline', solid: 'share-social' },
  'log-out': { line: 'log-out-outline', solid: 'log-out' },
  'user-minus': { line: 'person-remove-outline', solid: 'person-remove' },
  'chevron-left': { line: 'chevron-back', solid: 'chevron-back' },
  'chevron-right': { line: 'chevron-forward', solid: 'chevron-forward' },
  navigation: { line: 'navigate-outline', solid: 'navigate' },
  clock: { line: 'time-outline', solid: 'time' },
  phone: { line: 'call-outline', solid: 'call' },
  'external-link': { line: 'open-outline', solid: 'open' },
  crosshair: { line: 'locate-outline', solid: 'locate' },
  'chevron-down': { line: 'chevron-down', solid: 'chevron-down' },
  'chevron-up': { line: 'chevron-up', solid: 'chevron-up' },
  'arrow-up': { line: 'arrow-up', solid: 'arrow-up' },
  'arrow-down': { line: 'arrow-down', solid: 'arrow-down' },
  folder: { line: 'folder-outline', solid: 'folder' },
  star: { line: 'star-outline', solid: 'star' },
  bookmark: { line: 'bookmark-outline', solid: 'bookmark' },
  'book-open': { line: 'book-outline', solid: 'book' },
  'thumbs-up': { line: 'thumbs-up-outline', solid: 'thumbs-up' },
  compass: { line: 'compass-outline', solid: 'compass' },
  'message-square': { line: 'chatbubble-outline', solid: 'chatbubble' },
  upload: { line: 'cloud-upload-outline', solid: 'cloud-upload' },
  menu: { line: 'reorder-three-outline', solid: 'reorder-three' },
  flag: { line: 'flag-outline', solid: 'flag' },
  bell: { line: 'notifications-outline', solid: 'notifications' },
  'more-horizontal': { line: 'ellipsis-horizontal', solid: 'ellipsis-horizontal' },
  printer: { line: 'print-outline', solid: 'print' },
  download: { line: 'download-outline', solid: 'download' },
  copy: { line: 'copy-outline', solid: 'copy' },
  image: { line: 'image-outline', solid: 'image' },
  clipboard: { line: 'clipboard-outline', solid: 'clipboard' },
  'restaurant': { line: 'restaurant-outline', solid: 'restaurant' },
  'cafe': { line: 'cafe-outline', solid: 'cafe' },
  'fish': { line: 'fish-outline', solid: 'fish' },
  'flame': { line: 'flame-outline', solid: 'flame' },
  'ice-cream': { line: 'ice-cream-outline', solid: 'ice-cream' },
  'beer': { line: 'beer-outline', solid: 'beer' },
  'bag': { line: 'bag-handle-outline', solid: 'bag-handle' },
  'camera': { line: 'camera-outline', solid: 'camera' },
  'leaf': { line: 'leaf-outline', solid: 'leaf' },
  'water': { line: 'water-outline', solid: 'water' },
  'bed': { line: 'bed-outline', solid: 'bed' },
  'train': { line: 'train-outline', solid: 'train' },
  'happy': { line: 'happy-outline', solid: 'happy' },
  'color-palette': { line: 'color-palette-outline', solid: 'color-palette' },
  'ticket': { line: 'ticket-outline', solid: 'ticket' },
  'wallet': { line: 'wallet-outline', solid: 'wallet' },
  'thumbs-down': { line: 'thumbs-down-outline', solid: 'thumbs-down' },
  'bus': { line: 'bus-outline', solid: 'bus' },
  'walk': { line: 'walk-outline', solid: 'walk' },
  'car': { line: 'car-outline', solid: 'car' },
  'airplane': { line: 'airplane-outline', solid: 'airplane' },
  'boat': { line: 'boat-outline', solid: 'boat' },
};

export function Icon({
  name,
  /*
    글자 옆에 설 때 같은 무게로 보이려면 그림이 글자보다 조금 커야 합니다 —
    글자는 위아래 여백을 제 안에 갖고 있고 그림은 테두리까지가 전부입니다.

    <p>23 이었습니다. 본문이 20이던 시절의 값이라, 글자를 16으로 되돌리면서
    함께 내립니다. 쓰는 크기는 셋입니다 — 16(글자 옆) · 20(목록·입력) ·
    24(바·탭).
  */
  size = 20,
  tone = 'default',
  /** 켜진 칸처럼 채워서 그려야 하는 자리. 아래 갈래 띠가 씁니다. */
  solid = false,
  color,
}: {
  name: IconName;
  size?: number;
  tone?: Tone | 'inherit';
  solid?: boolean;
  /**
   * 색을 직접.
   *
   * <p>{@code tone} 으로 못 고르는 자리가 있습니다 — 채운 단추 위의 그림은
   * <b>그 단추의 글자색</b>을 그대로 따라야 하고, 그 색은 종류·눌림·못
   * 누름에 따라 바뀝니다. 이름을 열두 개 더 만드는 대신 색을 넘깁니다.
   */
  color?: string;
}) {
  const mark = ionicon[name];
  return (
    <Ionicons
      name={(solid ? mark.solid : mark.line) as never}
      size={size}
      color={color ?? (tone === 'inherit' ? Colors.text : toneColor[tone])}
    />
  );
}

/**
 * 아이콘만 있는 단추.
 *
 * 글자가 없으므로 화면을 읽어 주는 기기를 위해 이름을 반드시 답니다.
 * 보이는 크기는 작아도 누르는 넓이는 44 를 채웁니다.
 */
export function IconButton({
  name,
  label,
  onPress,
  /*
    그림만 서는 단추는 <b>진합니다.</b>

    <p>기본이 gray700 이었습니다. 회색 네모 안에 담겨 있던 시절에는 그
    네모가 「여기가 단추」를 말해 주어서 그림이 흐려도 됐습니다. 바탕이
    걷히고 그림 하나만 남은 뒤로는 <b>그림이 유일한 표시</b>인데, 한 단
    흐린 회색으로 두면 상단바에서 글자보다 약하게 보입니다.

    <p>회색 원·선을 가지는 꼴({@code fill}·{@code outline})은 칸이 말해
    주므로 호출부에서 흐린 톤을 줘도 됩니다.
  */
  tone = 'default',
  active,
  disabled,
  onMap,
  bare,
  fill,
  outline,
  dot,
}: {
  name: IconName;
  /** 무엇을 하는 단추인지. 눈에는 안 보이고 읽어 주는 기기만 씁니다. */
  label: string;
  onPress: () => void;
  tone?: Tone;
  /**
   * 켜진 상태(예: 다녀옴). 눌러 둔 것처럼 보이게 합니다.
   *
   * <p>켜진 것이 <b>보여야 하는</b> 자리에 {@code tone="accent"} 를 쓰지
   * 마세요 — 이 앱에서 글자와 그림의 accent 는 검정입니다(toneColor 참고).
   * bare 와 함께 쓰면 회색에서 검정으로만 바뀌어 아무 말도 안 합니다.
   * 코랄로 물들여야 하는 자리는 {@code tone="brand"} 입니다.
   */
  active?: boolean;
  disabled?: boolean;
  /**
   * 지도 위에 얹히는 단추인지.
   *
   * <p>지도 위에서는 네모난 연회색 단추가 지도의 건물·구획과 섞여 어디까지가
   * 단추인지 보이지 않습니다. 동그랗게, 흰 바탕에 그림자를 두어 떠 있는 것으로
   * 만듭니다. 지도를 쓰는 앱이라면 어디서나 그렇게 생겼습니다.
   */
  onMap?: boolean;
  /**
   * 바탕 없이 그림만.
   *
   * @deprecated 이제 이것이 <b>기본</b>입니다. 안 줘도 같습니다. 회색 원이
   *   필요하면 {@code fill} 을 주세요.
   */
  bare?: boolean;
  /**
   * 회색 원 안에 그림.
   *
   * <h3>기본이 뒤집혔습니다</h3>
   *
   * <p>전에는 <b>채운 것이 기본</b>이고 {@code bare} 를 줘야 바탕이
   * 걷혔습니다. 그래서 상단바마다 44짜리 회색 네모가 한두 개씩 얹혀 있었고,
   * 흰 상단바 위에서 그것이 <b>막대에 회색 조각을 덧댄 것</b>처럼
   * 보였습니다. 서른 자리 넘게 {@code bare} 를 손으로 적고 있던 것이 그
   * 증거입니다 — 거의 모든 자리가 바탕을 원하지 않았습니다.
   *
   * <p>이제 안 주면 그림만 섭니다. 회색 원이 필요한 자리 — 사진 위, 글 묶음
   * 안에서 혼자 떠 있어야 하는 것 — 만 이것을 줍니다.
   */
  fill?: boolean;
  /**
   * 1px 테두리를 두른 36 원.
   *
   * <p>회색 면({@code fill})이 묻히는 자리에 씁니다 — 이미 회색 면 위에
   * 놓이는 단추, 그리고 글 묶음 안에서 「이것도 누를 수 있다」를 조용히
   * 말해야 하는 것. 면은 무엇 위에 놓이느냐에 따라 묻히지만 선은 안
   * 묻힙니다.
   */
  outline?: boolean;
  /**
   * 오른쪽 위에 찍는 점.
   *
   * <p>안에 볼 것이 있다는 표시입니다. 숫자를 적지 않습니다 — 몇 건인지는
   * 열기 전에 할 일이 아니고, 두 자리가 되면 단추가 그만큼 넓어집니다.
   */
  dot?: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      /* 계획서 §2-7 — 작은 것은 0.96. 0.88 은 그림이 손끝 아래에서 쑥
         꺼지는 것처럼 보였습니다. */
      scale={0.96}
      style={[
        styles.iconButton,
        /* 바탕이나 테두리를 가지는 것만 동그란 칸이 됩니다. 그림만 서는
           것(기본)은 칸이 없으므로 둥글릴 것도 없습니다. */
        fill ? styles.iconButtonFill : null,
        outline ? styles.iconButtonOutline : null,
        onMap ? styles.iconButtonOnMap : null,
        {
          /*
            바탕이 있는 것은 <b>달라고 한 자리</b>뿐입니다.

            <p>전에는 채운 것이 기본이었습니다. 그래서 상단바마다 44짜리
            회색 네모가 얹혀, 흰 막대에 회색 조각을 덧댄 것처럼 보였습니다 —
            {@code bare} 를 손으로 적은 자리가 서른 곳을 넘던 것이 그
            증거입니다.

            <p>켜진 것은 <b>바탕이 아니라 그림</b>이 말합니다. 전에는 켜지는
            순간 바탕이 돋아나서, 담겼다는 것보다 <b>네모가 생겼다</b>는
            것이 먼저 보였습니다. 아래에서 그림에 색이 드는 것으로 충분합니다.
          */
          backgroundColor: onMap
            ? Colors.surface
            : fill
              ? active
                ? toneSoft[tone]
                : Colors.fill
              : 'transparent',
        },
        /* 지도 위의 것만 테두리를 가집니다. 흰 원이 지도의 건물·구획과
           섞이면 어디까지가 단추인지 안 보입니다. */
        active && onMap ? { borderColor: toneColor[tone] } : null,
      ]}>
      <Icon
        name={name}
        /* 그림만 서는 것은 24 입니다 — 바탕이 없으면 눈에 걸리는 것이
           그림 하나뿐이라, 20 으로는 눌리는 자리로 안 읽힙니다. */
        size={fill || outline || onMap ? 20 : 24}
        /* 꺼져 있을 때도 {@code tone} 을 봅니다. 전에는 'secondary' 를
           박아 두어서, 위에서 기본값을 아무리 바꿔도 <b>켜졌을 때만</b>
           먹었습니다 — 상단바의 그림들이 늘 한 단 흐린 채였습니다. */
        tone={disabled ? 'muted' : tone}
      />
      {dot ? <View style={styles.iconButtonDot} /> : null}
    </Press>
  );
}

/**
 * 되돌릴 수 없는 일을 묻는 창.
 *
 * 화면 안에서 두 번 누르게 하는 방식은 실수로 연달아 누르면 그냥 지나갑니다.
 * 창을 띄워 손을 한 번 멈추게 합니다.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.dialogBackdrop} onPress={onCancel}>
        {/* 안쪽을 눌렀다고 닫히면 안 됩니다. */}
        <Pressable style={styles.dialog} onPress={() => {}}>
          {/* 제목과 설명을 가운데로 둡니다. 이 창은 글을 읽는 자리가 아니라
              <b>한 가지를 묻는 자리</b>라, 왼쪽 정렬하면 눈이 왼쪽 위부터
              훑게 되어 묻는 말이 한 덩어리로 안 들어옵니다. */}
          <Text style={styles.dialogTitle}>{title}</Text>
          {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
          <Row gap={Spacing.s2} style={styles.dialogActions}>
            <View style={styles.dialogButton}>
              <Button label={cancelLabel} variant="secondary" size="m" onPress={onCancel} />
            </View>
            <View style={styles.dialogButton}>
              <Button
                label={confirmLabel}
                variant={danger ? 'danger' : 'primary'}
                size="m"
                busy={busy}
                onPress={onConfirm}
              />
            </View>
          </Row>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * 아래에서 올라오는 판.
 *
 * <p>무언가를 넣거나 고치는 일은 화면을 갈아 끼우지 않고 여기서 끝냅니다.
 * 페이지를 옮기면 보고 있던 목록과 지도를 잃고, 끝내고 나면 다시 찾아
 * 들어와야 합니다.
 *
 * <p>키보드가 올라와도 입력칸이 가리지 않게 밀어 올립니다. 내용이 길면
 * 판 안에서만 흐르고 뒤 화면은 움직이지 않습니다.
 */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** 완료·취소처럼 늘 손이 닿아야 하는 것. 판 아래에 붙습니다. */
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();
  const { height: screenHeight } = useWindowDimensions();
  /*
    넓은 화면에서는 아래에서 올라오지 않습니다.

    <p>아래 판은 <b>엄지가 닿는 자리</b>를 쓰려고 생긴 꼴입니다. 마우스에는
    닿는 자리가 따로 없고, 1280짜리 창에서 아래에만 붙은 판은 화면 위쪽
    절반을 통째로 버립니다 — 그 위는 가림막뿐입니다.
  */
  const wide = useWide();

  /*
    끌어서 닫고, 끌어서 넓히기.

    판을 닫으려면 X 를 누르거나 바깥을 눌러야 했습니다. X 는 화면 위쪽
    구석이라 한 손으로 쥐었을 때 엄지가 안 닿고, 바깥은 판이 화면을 거의
    다 덮으면 누를 자리가 얼마 없습니다. 폰에서 판을 닫는 몸짓은 아래로
    쓸어내리는 것입니다.

    위로 끌면 넓어집니다. 목록이 긴 판(장소 고르기 같은)은 처음 높이가
    내용에 맞춰 정해지는데, 그것으로 모자랄 때 한 번 끌어올리면 끝까지
    펴집니다.
  */
  const slide = useRef(new Animated.Value(0)).current;
  const [tall, setTall] = useState(false);
  const tallRef = useRef(false);
  tallRef.current = tall;

  /* 다시 열 때는 처음 자리에서. 끌어 내리다 만 채로 닫혔으면 그 자리가
     남아 있어 다음에 열 때 반쯤 내려간 판이 뜹니다. */
  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      setTall(false);
    }
  }, [visible, slide]);

  const drag = useRef(
    PanResponder.create({
      /* 세로로 어느 정도 움직였을 때만 잡습니다. 그러지 않으면 머리의
         닫기 단추를 누르려는 것까지 끌기로 오해합니다. */
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        if (g.dy >= 0) {
          slide.setValue(g.dy);
          return;
        }
        /* 위로는 넓어지는 것으로 갚습니다. 판이 천장을 뚫고 올라가면
           고장 난 것처럼 보입니다. */
        if (!tallRef.current) {
          setTall(true);
        }
        slide.setValue(g.dy * 0.12);
      },
      onPanResponderRelease: (_, g) => {
        /* 세게 튕겼으면 얼마나 내려왔는지보다 방향을 봅니다. 살짝
           쓸어내려도 닫히는 편이 몸에 익은 동작입니다. */
        if (g.dy > 120 || g.vy > 0.7) {
          Animated.timing(slide, {
            toValue: screenHeight,
            duration: Motion.tap,
            useNativeDriver: true,
          }).start(onClose);
          return;
        }
        Animated.spring(slide, {
          toValue: 0,
          damping: Motion.spring.damping,
          stiffness: Motion.spring.stiffness,
          mass: Motion.spring.mass,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.sheetWrap, wide ? styles.sheetWrapWide : null]}
        /* 판은 화면 아래에 붙어 있어 자판이 그대로 덮습니다. 게다가 Modal
           안에는 창을 줄여 주는 동작이 미치지 않습니다. 직접 밀어 올립니다.
           판의 최대 높이가 비율(88%)이라 밀린 만큼 판도 같이 낮아집니다. */
        behavior="padding">
        {/* 바깥을 누르면 닫힙니다. */}
        <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="닫기" />

        <Animated.View
          style={[
            styles.sheet,
            wide ? styles.sheetDialog : null,
            tall && !wide ? styles.sheetTall : null,
            {
              paddingBottom: (keyboardUp || wide ? 0 : insets.bottom) + Spacing.md,
              transform: [{ translateY: wide ? 0 : slide }],
            },
          ]}>
          {/* 손잡이와 제목 줄까지가 끄는 자리입니다. 손잡이만 잡게 하면
              손가락으로는 잘 안 맞습니다. 넓은 화면에서는 끌 데가 없습니다 —
              가운데 뜬 창을 아래로 미는 동작은 아무 데도 안 닿습니다. */}
          <View {...(wide ? {} : drag.panHandlers)}>
            {wide ? null : <View style={styles.sheetGrip} />}

            <View style={styles.sheetHead}>
              {/* 판 제목은 title2 20/700 입니다. body 16/700 이었는데, 그
                  크기는 목록 줄 제목과 같아서 판이 열렸을 때 무엇에 관한
                  판인지가 약하게 읽혔습니다. */}
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {title}
              </Text>
              <IconButton name="x" label="닫기" onPress={onClose} />
            </View>
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>

          {footer ? (
            <View style={styles.sheetFoot}>
              <OnFloor.Provider value>{footer}</OnFloor.Provider>
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * 지도 위로 끌어올리는 판.
 *
 * <p>지도를 위에 260px 만 얹고 아래를 목록으로 채우면, 지도도 목록도 어느 쪽도
 * 넉넉하지 않습니다. 동선을 보려면 좁고, 일정을 훑으려면 위가 잘립니다.
 *
 * <p>그래서 지도를 화면 전체로 깔고 일정을 그 위에 얹었습니다. 판을 내리면
 * 지도가 다 보이고, 올리면 일정이 다 보입니다. 어느 쪽을 크게 볼지 그때그때
 * 손으로 정합니다.
 *
 * <p>세 자리에만 붙습니다. 아무 데나 멈추게 두면 매번 어중간한 높이가 되어,
 * 볼 때마다 다시 맞춰야 합니다.
 *
 * <p>안쪽 목록은 <b>판이 맨 위까지 올라왔을 때만</b> 굴러갑니다. 그러지 않으면
 * 손가락 하나로 판을 올리려는 것과 목록을 굴리려는 것이 다투어, 올리려다
 * 스크롤되고 굴리려다 판이 내려갑니다.
 */
/** 판 바깥에서 판 안의 목록을 움직여야 할 때 쓰는 손잡이. */
export type DragSheetHandle = {
  /**
   * 그 줄이 보이게 목록을 굴립니다.
   *
   * <p>접혀 있으면 함께 펼칩니다 — 굴려 봐야 덮여 있으면 보이지 않습니다.
   */
  reveal: (node: unknown) => void;
};

export const DragSheet = forwardRef<DragSheetHandle, DragSheetProps>(function DragSheet({
  children,
  /** 화면 높이에서 판이 차지할 몫. 낮은 것부터 적습니다. */
  snaps = [0.28, 0.55, 0.92],
  /** 처음 붙는 자리. snaps 의 몇 번째인지. */
  initial = 1,
  /** 판 맨 위에 늘 보이는 줄. 손잡이 옆에 붙습니다. */
  peek,
  revealAtLow,
  lift = 0,
  onHeightChange,
}, ref) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /* 손잡이와 그 옆 줄이 실제로 몇 픽셀인지. 맨 아래 자리를 이것으로 잽니다. */
  const [headTall, setHeadTall] = useState(0);

  /*
    픽셀로 바꿔 둡니다. 화면을 돌리거나 브라우저 창을 줄이면 다시 계산됩니다.

    <h3>맨 아래만 화면 비율로 안 잽니다</h3>

    <p>0.28 은 작은 폰에서는 단추 줄을 반쯤 자르고 큰 폰에서는 그 아래
    일정까지 내보였습니다. 화면 높이와 <b>단추 줄 높이</b>는 아무 상관이
    없는 값인데 하나로 다른 하나를 재고 있었던 것입니다.

    <p>부르는 쪽이 "내렸을 때 이만큼은 보여야 한다" 를 픽셀로 알려 주면
    손잡이 높이를 더해 그 자리를 만듭니다. 어느 폰에서나 단추 줄까지
    딱 보이고 그 아래는 안 보입니다.
  */
  /*
    <h3>판이 쓸 수 있는 높이는 화면 높이가 아닙니다</h3>

    <p>아래로는 띠만큼(lift) 띄워 놓았고, 위로는 상태 표시줄을 덮으면 안
    됩니다. 그런데 자리들은 <b>화면 높이</b>에 비율을 곱해 잡고 있었습니다.

    <p>그래서 맨 위 자리(0.92)가 화면보다 커졌습니다 — 800px 폰이면 판 위쪽이
    0.08×800 − 90 = −26, 손잡이가 화면 밖으로 나갑니다. 끝까지 올리면 판을
    다시 내릴 수가 없었습니다. 잡을 것이 화면에 없으니까요.

    <p>쓸 수 있는 만큼을 먼저 빼고 비율을 곱합니다. 이러면 맨 위로 올려도
    위쪽에 늘 0.08 만큼이 남고, 그 자리에 손잡이가 있습니다.
  */
  const room = Math.max(1, height - lift - insets.top);
  const stops = snaps.map((r) => Math.round(room * r));
  if (revealAtLow != null && headTall > 0) {
    stops[0] = Math.min(headTall + revealAtLow, stops[stops.length - 1]);
  }
  const [at, setAt] = useState(Math.min(initial, stops.length - 1));
  const atRef = useRef(at);
  atRef.current = at;

  const tall = useRef(new Animated.Value(stops[Math.min(initial, stops.length - 1)])).current;
  /* 손가락이 닿았을 때의 높이. 여기서부터 얼마나 움직였는지를 셉니다. */
  const from = useRef(stops[Math.min(initial, stops.length - 1)]);

  const settle = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(stops.length - 1, index));
      setAt(next);
      onHeightChange?.(stops[next]);
      Animated.spring(tall, {
        toValue: stops[next],
        damping: Motion.spring.damping,
        stiffness: Motion.spring.stiffness,
        mass: Motion.spring.mass,
        /* 높이는 네이티브 드라이버로 못 움직입니다(레이아웃 값이라서).
           판 하나뿐이라 이 정도는 자바스크립트 쪽에서 그려도 됩니다. */
        useNativeDriver: false,
      }).start();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tall, onHeightChange, stops.join(',')],
  );

  /* 창 크기가 바뀌면 붙어 있던 자리를 새 높이로 다시 잡습니다. */
  useEffect(() => {
    const px = stops[Math.min(atRef.current, stops.length - 1)];
    tall.setValue(px);
    onHeightChange?.(px);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.join(',')]);

  const scroller = useRef<ScrollView>(null);
  /*
    목록을 감싸는 자리.

    줄이 목록의 어디쯤에 있는지는 이 자리를 기준으로 잽니다. 스크롤 안쪽의
    좌표라, 그대로 굴리면 딱 그 줄이 위에 옵니다.
  */
  const content = useRef<View>(null);

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
        /* 접혀 있으면 함께 펼칩니다. 굴려 봐야 판에 덮여 있으면 보이지
           않습니다. 맨 아래 자리에서만 올립니다 — 이미 펼쳐 둔 것을
           멋대로 더 올리지는 않습니다. */
        if (atRef.current < 1) {
          settle(1);
        }
        target.measureLayout(
          content.current,
          (_x, y) => {
            scroller.current?.scrollTo({ y: Math.max(0, y - Spacing.md), animated: true });
          },
          () => {},
        );
      },
    }),
    [settle],
  );

  const pan = useRef(
    PanResponder.create({
      /* 세로로 어느 정도 움직였을 때만 잡습니다. 그러지 않으면 판 안의
         단추를 누르려는 것까지 끌기로 오해합니다. */
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        from.current = stops[atRef.current];
      },
      onPanResponderMove: (_, g) => {
        const next = from.current - g.dy;
        /* 맨 위와 맨 아래를 넘어가면 조금만 따라옵니다. 딱 멈추면 고장 난 것
           같고, 그대로 따라가면 판이 화면 밖으로 나갑니다. */
        const low = stops[0];
        const high = stops[stops.length - 1];
        const eased =
          next < low
            ? low - (low - next) * 0.35
            : next > high
              ? high + (next - high) * 0.35
              : next;
        tall.setValue(eased);
      },
      onPanResponderRelease: (_, g) => {
        const ended = from.current - g.dy;
        /* 세게 튕겼으면 손을 뗀 자리가 아니라 방향을 봅니다. 살짝 올렸다가
           놓아도 다음 자리로 넘어가야 "던졌다" 는 느낌이 납니다. */
        if (g.vy < -0.5) {
          settle(atRef.current + 1);
          return;
        }
        if (g.vy > 0.5) {
          settle(atRef.current - 1);
          return;
        }
        let best = 0;
        for (let i = 1; i < stops.length; i++) {
          if (Math.abs(stops[i] - ended) < Math.abs(stops[best] - ended)) {
            best = i;
          }
        }
        settle(best);
      },
    }),
  ).current;

  const top = at >= stops.length - 1;

  return (
    /*
      판은 바닥까지 내려갑니다.

      <h3>띠 뒤로 지도가 비쳤습니다</h3>

      <p>아래 갈래 띠만큼 띄워 두었습니다(bottom: lift). 판과 띠가 안 겹치게
      하려던 것인데, 그러면 <b>띠 뒤에 남는 것이 지도</b>입니다. 띠가 반투명
      해지자 그 지도가 그대로 비쳤습니다 — 일정을 보고 있는데 띠 뒤에서만
      지도가 나타납니다.

      <p>띄우는 대신 바닥까지 내리고, 띄웠던 만큼 높이를 늘립니다. 보이는
      자리(띠 위쪽)의 크기는 그대로이고, 띠 뒤에 있는 것이 지도가 아니라
      <b>일정</b>이 됩니다.

      <p>겹치는 자리는 띠가 이깁니다(띠의 zIndex 가 한 칸 위입니다). 마지막
      줄이 띠 뒤로 들어가는 것은 아래의 여백이 막습니다.
    */
    <Animated.View style={[styles.dragSheet, { height: Animated.add(tall, lift) }]}>
      {/* 손잡이와 그 옆 줄까지가 끄는 자리입니다. 손잡이만 잡게 하면
          손가락으로는 잘 안 맞습니다. */}
      <View
        {...pan.panHandlers}
        onLayout={(e) => setHeadTall(e.nativeEvent.layout.height)}
        style={styles.dragHead}>
        {/* 끄는 것 말고 눌러서도 오갑니다. 끄는 몸짓은 마우스에서 잘 안
            잡히고, 무엇보다 끌 수 있다는 것 자체를 모르는 사람이 있습니다.
            맨 위까지 갔으면 다시 맨 아래로 돌아옵니다. */}
        <Pressable
          onPress={() => settle(top ? 0 : atRef.current + 1)}
          accessibilityRole="button"
          accessibilityLabel={top ? '일정 접기' : '일정 펼치기'}
          hitSlop={Spacing.md}
          style={styles.dragGripTap}>
          <View style={styles.dragGrip} />
        </Pressable>
        {peek ? <View style={styles.dragPeek}>{peek}</View> : null}
      </View>

      <ScrollView
        ref={scroller}
        style={styles.dragBody}
        /* 아래 여백은 띠 높이만큼입니다. 안 비우면 마지막 줄이 띠 뒤로
           들어가 아무리 굴려도 안 보입니다. 띠가 없는 화면에서는 지금까지처럼
           안전영역만 비웁니다. */
        contentContainerStyle={[
          styles.dragBodyOuter,
          { paddingBottom: Math.max(lift, insets.bottom) + Spacing.huge },
        ]}
        /*
          언제나 굴러갑니다.

          전에는 맨 위까지 올라오기 전에는 막아 두었습니다. 판을 끄는 손짓과
          다툴까 봐서였는데, 실제로는 끄는 자리가 위쪽 머리(손잡이와 그 옆
          줄)뿐이라 다툴 일이 없었습니다. 반쯤 올린 채로 목록을 훑을 수 없는
          쪽이 훨씬 답답합니다.
        */
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* collapsable 을 꺼야 이 자리가 실제 화면 요소로 남습니다. 안 그러면
            안드로이드가 아무것도 안 그리는 껍데기라며 없애 버려, 줄이 어디
            있는지를 잴 기준이 사라집니다. */}
        <View ref={content} collapsable={false} style={styles.dragBodyInner}>
          {children}
        </View>
      </ScrollView>
    </Animated.View>
  );
});

type DragSheetProps = {
  children: React.ReactNode;
  /** 화면 높이에서 판이 차지할 몫. 낮은 것부터 적습니다. */
  snaps?: number[];
  /** 처음 붙는 자리. snaps 의 몇 번째인지. */
  initial?: number;
  /** 판 맨 위에 늘 보이는 줄. 손잡이 옆에 붙습니다. */
  peek?: React.ReactNode;
  /**
   * 맨 아래로 내렸을 때 <b>내용에서</b> 몇 픽셀이 보여야 하는지.
   *
   * <p>손잡이 높이는 여기에 안 셉니다 — 그건 판이 스스로 재서 더합니다.
   * 부르는 쪽은 "단추 줄까지" 처럼 제가 아는 것만 재면 됩니다.
   *
   * <p>안 주면 지금까지처럼 {@code snaps[0]} 대로 화면 비율을 씁니다.
   */
  revealAtLow?: number;
  /**
   * 화면 바닥에서 몇 픽셀 띄울지.
   *
   * <p>아래에 갈래 띠가 떠 있는 화면에서 씁니다. 안 띄우면 판이 띠 뒤로
   * 들어가, 판의 마지막 줄과 띠가 겹칩니다.
   */
  lift?: number;
  /**
   * 판이 지금 몇 픽셀을 덮고 있는지.
   *
   * <p>지도가 이것을 알아야 합니다. 모르면 고른 장소의 핀을 화면 한가운데로
   * 보내는데, 그 가운데가 판에 덮여 있어 정작 보이지 않습니다.
   */
  onHeightChange?: (px: number) => void;
};

/**
 * 숫자를 눌러서 고르는 칸.
 *
 * 직접 치게 두면 "3박" 을 적는 사람과 "3" 을 적는 사람이 갈리고, 폰에서는
 * 숫자 자판을 부르는 것부터 번거롭습니다.
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 30,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <IconButton
          name="minus"
          label={`${label} 줄이기`}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - 1))}
        />
        <Text style={styles.stepperValue}>
          {value}
          {unit ?? ''}
        </Text>
        <IconButton
          name="plus"
          label={`${label} 늘리기`}
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, value + 1))}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ 상태 */

/**
 * 이전 / 지금 몇 쪽 / 다음.
 *
 * <h3>넷이 똑같이 있었습니다</h3>
 *
 * <p>{@code admin/users}, {@code admin/posts}, {@code admin/audit},
 * {@code community/index} 에 열여덟 줄짜리 같은 것이 네 벌 있었습니다.
 * 셋은 글자까지 한 글자도 안 다르고, 하나만 "전체 N" 이 더 붙어 있었습니다.
 *
 * <h3>한 쪽뿐이면 안 냅니다</h3>
 *
 * <p>넘길 데가 없는데 단추가 둘 서 있으면 눌러 보게 됩니다. 부르는 쪽마다
 * {@code totalPages > 1} 을 손으로 재고 있었는데, 그 판단은 여기 것입니다.
 */
export function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  /** 지금 몇 쪽인지. 0부터 셉니다 — 서버가 그렇게 줍니다. */
  page: number;
  totalPages: number;
  /** 전부 몇 건인지. 있으면 쪽수 옆에 적습니다. */
  total?: number;
  onPage: (next: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <Split>
      <Button
        label="이전"
        variant="secondary"
        compact
        disabled={page <= 0}
        onPress={() => onPage(Math.max(0, page - 1))}
      />
      <Caption>
        {page + 1} / {totalPages}
        {total === undefined ? '' : ` · 전체 ${total.toLocaleString()}`}
      </Caption>
      <Button
        label="다음"
        variant="secondary"
        compact
        disabled={page >= totalPages - 1}
        onPress={() => onPage(page + 1)}
      />
    </Split>
  );
}

/**
 * 기다리는 중.
 *
 * <h3>기기가 그려 주는 바퀴였습니다</h3>
 *
 * <p>{@link ActivityIndicator} 하나와 글자 한 줄이었습니다. 그 바퀴는
 * 안드로이드·iOS·웹에서 생김새가 다 다르고 어느 것도 이 앱이 그린 것이
 * 아닙니다. 서른여덟 자리가 이것을 부르므로, <b>기다리는 동안 보이는 화면은
 * 어디나 남의 것</b>이었습니다.
 *
 * <p>점 셋이 차례로 숨을 쉽니다. 글자와 같은 결의 도형이라 어느 쪽도 튀지
 * 않고, {@link Skeleton} 의 회색 칸과 숨 박자가 같습니다 — 기다리는 것은 이
 * 앱에서 한 가지 몸짓입니다.
 *
 * <p>색은 회색입니다. 바이올렛으로 두면 「기다리는 중」이 화면에서 가장 눈에
 * 띄는 것이 되는데, 기다리는 것은 알리기만 하면 됩니다.
 *
 * <p><b>목록이 올 자리에는 안 씁니다.</b> 바퀴든 점이든 그것이 도는 동안
 * 목록은 백지이고, 데이터가 닿는 순간 줄들이 한꺼번에 들어서면서 화면이
 * 튑니다. 그 자리는 {@link Skeleton} 입니다.
 *
 * @param label 무엇을 가져오는 중인지. 자리마다 적습니다
 */
export function Loading({ label = '가져오고 있어요' }: { label?: string }) {
  const calm = useCalm();

  return (
    <View style={styles.center}>
      <View style={styles.waitDots}>
        {WAIT_DOTS.map((order) => (
          <WaitDot key={order} order={order} calm={calm} />
        ))}
      </View>
      <Caption>{label}</Caption>
    </View>
  );
}

/** 기다리는 점 셋. 넷을 넘으면 「기다리는 중」이 아니라 무늬로 보입니다. */
const WAIT_DOTS = [0, 1, 2];

/** 숨 한 번의 길이. 점과 스켈레톤 칸이 같은 값을 봅니다. */
const BREATH = 400;

/** 점 사이의 시차. 셋이 차례로 밝아지는 간격입니다. */
const BREATH_STEP = 160;

/**
 * 밝아졌다 흐려지는 것.
 *
 * <p>차례를 늦춘 만큼 뒤에서 되돌려 <b>한 바퀴 길이를 셋이 똑같이</b>
 * 가집니다. 안 맞추면 바퀴를 돌 때마다 시차가 쌓여, 셋이 한꺼번에 깜빡이는
 * 순간이 생깁니다.
 *
 * <p>움직임을 줄이겠다고 해 둔 사람에게는 켜 둔 채로 멈춥니다. 기다리는
 * 중이라는 말은 옆의 글자가 이미 하고 있습니다.
 *
 * @param from 가장 흐려졌을 때의 투명도. 0 까지 내리면 점이 사라져 자리가 빕니다
 * @param order 몇 번째인지. 앞에서부터 조금씩 늦게 밝아집니다
 */
function useBreath({ from, order = 0, calm }: { from: number; order?: number; calm: boolean }) {
  const value = useRef(new Animated.Value(calm ? 1 : from)).current;

  useEffect(() => {
    if (calm) {
      value.setValue(1);
      return;
    }
    const wait = order * BREATH_STEP;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: BREATH,
          delay: wait,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: from,
          duration: BREATH,
          /* 늦게 시작한 만큼 일찍 끝냅니다 — 위의 <b>한 바퀴 길이</b> 이야기
             입니다. {@link Animated.delay} 는 안 씁니다. 그것이 만드는 애니
             메이션은 네이티브 드라이버를 안 쓰므로, 한 묶음 안에서 드라이버가
             섞입니다. */
          delay: BREATH_STEP * 2 - wait,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, from, order, calm]);

  return value;
}

function WaitDot({ order, calm }: { order: number; calm: boolean }) {
  const breath = useBreath({ from: 0.25, order, calm });

  return <Animated.View style={[styles.waitDot, { opacity: breath }]} />;
}

/**
 * 올 것의 자리.
 *
 * <h3>다시 받아 오는 동안 목록이 사라졌습니다</h3>
 *
 * <p>목록 화면이 {@link Loading} 을 세우고 있었습니다. 그러면 있던 줄들이
 * 전부 걷히고 가운데에 점 셋만 남았다가, 데이터가 닿는 순간 줄들이 한꺼번에
 * 들어섭니다 — 탭을 옮겨 다니는 것이 <b>부자연스럽다</b>고 한 것의 절반이
 * 이것입니다.
 *
 * <p>올 것과 비슷한 크기의 회색 칸을 미리 세워 둡니다. 자리가 이미 잡혀
 * 있으면 데이터가 닿아도 화면이 안 움직이고, 몇 개쯤 오는지도 먼저 보입니다.
 *
 * <p>칸은 숨을 쉽니다. 가만히 있는 회색 네모는 <b>다 그려진 화면</b>으로
 * 읽혀서, 기다리는 중인지 원래 그런 화면인지 안 갈립니다.
 *
 * @param rows 몇 줄을 세울지. 그 자리에 대개 몇 개가 오는지로 정합니다
 * @param thumb 줄 앞에 그림이 서는 목록인지. 글자만 오는 목록이면 끕니다
 */
export function Skeleton({ rows = 3, thumb = true }: { rows?: number; thumb?: boolean }) {
  const calm = useCalm();
  /* 칸들이 한 숨으로 함께 쉽니다. 줄마다 시차를 두면 목록이 아래로 흐르는
     것처럼 보여서, 가만히 기다리는 자리가 제 혼자 움직이는 화면이 됩니다. */
  const breath = useBreath({ from: 0.5, calm });

  return (
    /* 읽어 주는 기기에 회색 칸은 아무 말도 아닙니다. 무엇을 하는 중인지 한 번
       말하고, 안의 칸들은 읽을 글자가 없으니 저절로 넘어갑니다. */
    <View accessibilityRole="progressbar" accessibilityLabel="가져오고 있어요">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.bone}>
          {thumb ? <Animated.View style={[styles.boneThumb, { opacity: breath }]} /> : null}
          <View style={styles.boneText}>
            <Animated.View style={[styles.boneLine, { opacity: breath }]} />
            <Animated.View style={[styles.boneLine, styles.boneLineTail, { opacity: breath }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 잘못됐다는 말.
 *
 * <h3>왼쪽에 검은 세로선이 있었습니다</h3>
 *
 * <p>2px 검정 세로선을 긋고 그 안에 빨간 글자를 두었습니다. 색을 안 쓰기로
 * 했던 때 「위험한 것은 색이 아니라 모양으로」 라서 생긴 것인데, 이제
 * {@link Colors.danger} 를 씁니다. 그러면 선은 <b>인용문의 들여쓰기</b>처럼
 * 보일 뿐이고, 무엇보다 선 때문에 글자가 왼쪽 글자선에서 안으로 밀려
 * 들어가 있었습니다.
 *
 * <p>선을 걷고 ⚠ 를 글자 앞에 둡니다 — 입력칸의 오류와 같은 모양입니다.
 */
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.note}>
      <Row gap={Spacing.s1}>
        <Icon name="alert" size={14} tone="danger" />
        <Text style={styles.noteText}>{message}</Text>
      </Row>
      {onRetry ? (
        <Button label="다시 시도" variant="outline" size="s" onPress={onRetry} />
      ) : null}
    </View>
  );
}

/**
 * 아무것도 없을 때.
 *
 * <p>앱이 가장 차갑게 느껴지는 순간이 빈 화면입니다. 여느 본문보다 한 단
 * 크게 적습니다 — 회색 글씨 한 줄이 "없습니다" 라고 말하는 것과, 손으로 적어
 * 둔 것처럼 보이는 것은 다릅니다.
 */
/**
 * 아무것도 없는 자리.
 *
 * <h3>글자 한 줄이었습니다</h3>
 *
 * <p>「아직 없어요」 한 줄만 가운데에 떠 있었습니다. 그러면 <b>안 불러온
 * 것인지 원래 없는 것인지</b>가 안 갈립니다 — 비어 있는 화면은 대개 처음
 * 들어온 사람이 보는 화면인데, 거기서 다음에 무엇을 하면 되는지도 말하지
 * 않았습니다.
 *
 * <p>그림 하나와 할 일 하나를 답니다. 그림은 회색 원 안에 들어가 「여기가
 * 비었다」를 모양으로 말하고, 단추는 그 비어 있음을 메우는 길입니다.
 *
 * @param icon 무엇이 비었는지. 그 화면이 다루는 것의 그림을 줍니다
 * @param action 비어 있음을 메우는 한 가지. 없으면 안 섭니다
 */
export function Empty({
  message,
  note,
  icon,
  action,
}: {
  message: string;
  /** 한 줄 더. 왜 비었는지, 또는 무엇을 하면 채워지는지 */
  note?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center}>
      {icon ? (
        <View style={styles.emptyMark}>
          <Icon name={icon} size={28} tone="off" />
        </View>
      ) : null}
      <Text style={styles.emptyLine}>{message}</Text>
      {note ? <Text style={styles.emptyNote}>{note}</Text> : null}
      {action ? (
        <Button label={action.label} variant="outline" size="m" onPress={action.onPress} />
      ) : null}
    </View>
  );
}

/**
 * 방금 한 일과, 물러설 길.
 *
 * <h3>묻는 것과 알리는 것</h3>
 *
 * <p>되돌릴 수 없는 일에는 {@link ConfirmButton} 으로 <b>미리</b> 묻습니다.
 * 그런데 되돌릴 수 있는 일까지 매번 "정말요?" 를 세우면, 열 번 중 아홉 번은
 * 맞게 누른 사람이 아홉 번 다 한 번씩 더 눌러야 합니다.
 *
 * <p>그래서 되돌릴 수 있는 일은 <b>먼저 하고 나중에 알립니다.</b> 맞게 누른
 * 사람은 아무것도 안 해도 되고, 잘못 누른 사람은 한 번 누르면 됩니다.
 *
 * <h3>스스로 사라집니다</h3>
 *
 * <p>물러설 틈은 잠깐이면 됩니다. 계속 떠 있으면 그것이 화면의 일부가
 * 되어 버려서, 정작 무언가를 알릴 자리가 없습니다.
 *
 * @param seconds 떠 있는 동안. 글을 읽고 누를 만큼은 됩니다.
 */
export function useUndo(seconds = 5) {
  const [undo, setUndo] = useState<UndoNote | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setUndo(null);
  }, []);

  const show = useCallback(
    (note: UndoNote) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      setUndo(note);
      timer.current = setTimeout(() => setUndo(null), seconds * 1000);
    },
    [seconds],
  );

  /* 화면을 떠나면 타이머도 접습니다. 안 접으면 사라진 화면을 다시 그리려
     들고, 리액트가 그것을 경고로 알려 줍니다. */
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return { undo, show, hide };
}

/** 스낵 한 줄에 담기는 것. */
export type UndoNote = {
  /** 무슨 일이 있었는지. "지웠습니다" 처럼 <b>이미 끝난 일</b>로 적습니다. */
  message: string;
  /** 물러서는 길. 없으면 알리기만 합니다. */
  onUndo?: () => void;
  /** 되돌리는 단추에 적을 말. */
  label?: string;
};

/**
 * 화면 아래에 잠깐 떠 있는 띠.
 *
 * <p>바닥이 어둡습니다. 이 앱은 그림자를 거의 안 쓰는데(Elevation 참고), 흰
 * 카드들 위에 흰 띠를 띄우면 어디까지가 띠인지 안 보입니다. 색을 뒤집는
 * 것이 그림자 없이 "위에 떠 있다" 를 말하는 가장 조용한 방법입니다.
 */
export function Snack({ undo, onHide }: { undo: UndoNote | null; onHide: () => void }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: undo ? 1 : 0,
      duration: Motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [undo, value]);

  /* 사라지는 동안에도 글자는 남아 있어야 합니다. 없애 버리면 띠가 비어
     있는 채로 내려갑니다. */
  const last = useRef<UndoNote | null>(null);
  if (undo) {
    last.current = undo;
  }
  const shown = undo ?? last.current;
  if (!shown) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={undo ? 'auto' : 'none'}
      style={[
        styles.snack,
        {
          opacity: value,
          transform: [
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}>
      <Text style={styles.snackText} numberOfLines={2}>
        {shown.message}
      </Text>
      {shown.onUndo ? (
        <Press
          onPress={() => {
            onHide();
            shown.onUndo?.();
          }}
          accessibilityLabel={shown.label ?? '되돌리기'}
          style={styles.snackAction}>
          <Text style={styles.snackActionText}>{shown.label ?? '되돌리기'}</Text>
        </Press>
      ) : (
        <Press onPress={onHide} accessibilityLabel="닫기" style={styles.snackAction}>
          <Ionicons name="close" size={20} color={Colors.surface} />
        </Press>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollBody: {
    alignItems: 'center',
    paddingHorizontal: Gutter,
  },
  staticBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Gutter,
  },
  screenGray: {
    backgroundColor: Colors.band,
  },
  screenInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: ScreenGap,
  },
  /* 띠가 구역을 가르는 화면. 띠 위아래로 간격이 또 붙으면 8짜리 띠가
     32 자리를 먹어, 가르는 선이 아니라 텅 빈 구간으로 보입니다. */
  screenInnerBanded: {
    gap: 0,
  },


  /*
    위에 붙어 있는 줄.

    <p>아래 여백이 lg(20) 였습니다. 굴러가는 본문 안에 있던 시절의 크기인데,
    지금은 <b>늘 보이는 줄</b>이라 그만큼이 화면에서 영영 빠집니다.
  */
  header: {
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.md,
  },
  /*
    바닥에 고정된 바.

    <p>위에 실선 한 가닥을 두르고 있었습니다. 그런데 이 바는 <b>굴러가는
    내용 위에 떠 있는 것</b>입니다 — 선은 「여기서 구역이 갈린다」는 말이고,
    떠 있는 것은 그림자로 말해야 그 아래로 글이 지나간다는 것이 보입니다.
    선만 있으면 바가 내용의 마지막 칸처럼 보여서, 글이 그 뒤로 흘러 들어가는
    동안 뭔가 잘린 것 같습니다.
  */
  footer: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.s3,
    backgroundColor: Colors.background,
    ...Elevation.float,
    /* 아래가 아니라 위로 드리웁니다. 바 아래에는 아무것도 없습니다. */
    shadowOffset: { width: 0, height: -4 },
  },
  footerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.sm,
  },

  /*
    카드는 상자가 아니라 묶음입니다.

    그림자로 띄우던 것을 걷고 선 한 가닥을 둘렀다가, 그 선마저 걷었습니다.
    선을 두르면 화면이 테두리 쳐진 사각형의 더미가 되고, 카드가 넷 놓이면
    사각형이 넷입니다. 정작 봐야 할 것은 그 안의 글자입니다.

    이제 바닥이 한 단 어둡고 카드가 흰색입니다. 밝기 차이만으로 어디까지가
    한 덩어리인지 보이고, 화면에 그어진 선은 하나도 없습니다.
  */
  card: {
    backgroundColor: Colors.surface,
    /* r16 이었습니다. 계획서 §2-5 에서 16 은 <b>사진 카드</b>의 모서리이고,
       물건 카드는 12 입니다 — 안이 글자뿐인 작은 판에 16 을 두르면 둥근
       끝이 글자 자리를 먹어 안쪽 여백이 모서리마다 달라 보입니다. */
    borderRadius: Radius.r3,
    padding: Spacing.s4,
    /*
      흰 바탕 위에 흰 카드가 놓입니다.

      <p>바닥이 회색이던 시절에는 밝기 차이만으로 카드가 떠 보였습니다.
      바닥을 흰색으로 돌렸으니 그 일을 <b>옅은 그림자</b>가 대신합니다 —
      선을 두르면 화면이 다시 「테두리 쳐진 사각형의 더미」가 됩니다.
    */
    ...Elevation.card,
    /*
      안에 든 것들 사이.

      <p>md(14) → sm(10) → xs(6) 으로 두 번 좁혔습니다. 한 판 안의 것들은 한
      덩어리로 읽혀야 하는데, 사이가 벌어져 있으면 제목과 본문이 서로 다른
      이야기처럼 보입니다.

      <p>여기서 더 좁히면 글줄 사이와 구별이 안 됩니다. 이 정도가 "붙어
      있지만 다른 줄" 의 선입니다.
    */
    gap: Spacing.xs,
  },

  sectionHeader: {
    /* 위 32 · 아래 12. 계획서의 「구역 위 여백」과 「제목 아래」입니다. */
    paddingTop: Spacing.s8,
    paddingBottom: Spacing.s3,
    gap: Spacing.s1,
  },
  /* 띠가 바로 위에 있으면 위 여백을 걷습니다. 띠가 제 여백 12 를 가지고
     화면이 덩어리 사이에 12 를 두므로, 띠 아래로 이미 24 가 있습니다 —
     계획서가 「띠 바로 아래면 24」라고 적은 그 값입니다. */
  sectionHeaderTight: {
    paddingTop: 0,
  },
  /* 제목과 「전체보기」는 <b>밑줄</b>로 맞춥니다. 가운데로 맞추면 글자
     크기가 20 대 14 라, 작은 쪽이 큰 쪽의 가운데에 떠서 둘이 같은 줄에
     앉은 것으로 안 보입니다. */
  sectionHeaderTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.s3,
  },
  sectionHeaderTitle: {
    ...Type.title2,
    fontWeight: Weight.bold,
    color: Colors.text,
    flexShrink: 1,
  },
  sectionHeaderNote: {
    ...Type.body2,
    color: Colors.textSecondary,
  },

  band: {
    height: BandHeight,
    marginHorizontal: -Gutter,
    marginVertical: Spacing.s3,
    backgroundColor: Colors.band,
  },

  /* 면 카드 — 눌리지 않는 것. 떠 있을 이유가 없으니 그림자를 걷습니다. */
  cardFill: {
    backgroundColor: Colors.fill,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  /*
    목록 줄.

    <h3>흰 카드를 걷고 선으로 가릅니다</h3>

    <p>줄 하나하나가 흰 카드였습니다. 바닥이 회색이던 시절에는 그 카드들이
    바닥 위에 떠 보여서 줄이 갈렸는데, <b>바닥을 흰색으로 돌리니 흰 카드가
    흰 종이 위에 놓인 꼴</b>이 됐습니다 — 글자만 줄줄이 늘어서고 어디서
    한 줄이 끝나는지 안 보였습니다.

    <p>배경을 걷고 아래에 머리카락 굵기 선을 긋습니다. 선은 <b>글이
    시작하는 자리</b>에서부터 그어야 앞의 그림이 줄을 이끄는 것으로
    읽힙니다 — 끝에서 끝까지 그으면 구역을 가르는 띠처럼 보입니다.

    <p>마지막 줄에는 안 긋습니다. 목록이 끝났는데 선이 하나 더 있으면
    아래에 뭔가 더 있는 줄 압니다.
  */
  listRow: {
    paddingVertical: Spacing.s3,
    minHeight: Tap.min + Spacing.s3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.s3,
  },
  /* 부제가 붙은 줄. 글이 두 줄이면 위아래 여백만으로는 66 밖에 안 되어,
     한 줄짜리 줄들과 섞였을 때 키 차이가 어정쩡합니다 — 계획서의 72 로
     올려 둡니다. */
  listRowTwo: {
    minHeight: 72,
  },
  /* 눌린 줄. 크기를 안 줄이는 대신 이것이 눌렸다는 말을 합니다. */
  listRowDown: {
    backgroundColor: Colors.surfaceRaised,
  },
  listRowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
  },
  /*
    앞에 그림이 선 줄의 선 시작점.

    <p>40 짜리 그림 + 사이 12 = 52 입니다. 좌우 여백 20 을 더하면 화면
    왼쪽에서 72 — 계획서 §3-4 의 값입니다. 썸네일(56)이 서는 줄은 네 칸
    차이가 나는데, 그만큼은 눈에 걸리지 않습니다. 앞 요소 너비를 재서
    맞추려면 줄마다 한 번 더 그려야 해서, 목록이 길어질수록 값이 커집니다.
  */
  listRowLineInset: {
    left: 52,
  },
  /* 곁다리가 있는 줄. 판은 여기가 쓰고 여백은 안쪽이 가집니다. */
  listRowHeld: {
    minHeight: Tap.min + Spacing.s3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listRowTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.s3,
    paddingVertical: Spacing.s3,
    /* 오른쪽은 곁다리와의 사이만큼만. */
    paddingRight: Spacing.s2,
  },
  listRowText: {
    flex: 1,
    flexShrink: 1,
    gap: Spacing.xs,
  },
  /* 목록 제목은 headline 16/22 입니다. 전에 보던 {@code Type.body} 는
     16/24 로, 여러 줄 본문을 위해 줄 사이를 벌려 둔 것입니다 — 한 줄
     말줄임하는 제목에서는 그 여유가 줄을 괜히 키웁니다. */
  listRowTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  listRowTitleDanger: {
    color: Colors.danger,
  },
  listRowSubtitle: {
    ...Type.caption,
    color: Colors.textMuted,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  /* 양끝에 붙이는 줄은 안 흘립니다. 흘러 내려가면 오른쪽 것이 제 줄을
     잃고 왼쪽 아래로 붙어, 양끝에 둔 뜻이 사라집니다. */
  split: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  grow: {
    flex: 1,
  },

  /* --------------------------------------------------- 지도 위의 판 */
  dragSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    /*
      판은 흰 종이입니다.

      <p>바닥색을 쓰고 있었습니다. "판 안에도 카드가 놓이니 판이 흰색이면 그
      위의 흰 카드가 안 보인다" 는 이유였는데, 실제로 안에 들어 있는 것은
      <b>테두리만 가진 투명한 줄들</b>입니다(여행 상세의 장소, 여행기의 장소).
      안 보일 흰 카드가 없습니다.

      <p>그러면서 지도 위에 회색 판이 떠 있었습니다. 지도도 회색조라 둘이
      비슷한 밝기로 붙어, 판이 지도에서 잘 안 떨어졌습니다. 흰 종이는 무엇
      위에 놓이든 떠 보입니다.
    */
    backgroundColor: Colors.surface,
    /* 바텀시트와 같은 r20 입니다. 16 이었는데, 둘 다 「아래에서 올라오는
       판」이라 모서리가 다르면 다른 물건으로 보입니다. */
    borderTopLeftRadius: Radius.r5,
    borderTopRightRadius: Radius.r5,
    /*
      지도 위에 얹히는 판이라 판이 어디서 시작하는지가 보여야 합니다.
      한동안 위쪽으로 그림자를 드리웠습니다.

      <p><b>그런데 안드로이드는 위쪽만 고를 수가 없습니다.</b> shadowOffset 은
      iOS 전용이고, 안드로이드의 elevation 은 사방으로 같이 뿌립니다.
      그래서 판 아래쪽 그림자가 하단 띠 위에 떨어졌습니다 — 판도 띠도 같은
      색이라 이어진 한 면으로 보여야 하는데 그 사이에 얼룩만 하나 생겼습니다.

      <p>그래서 그림자를 걷고 <b>어디서나</b> 위쪽에 실선 한 줄만 둡니다.
      한쪽만 고치면 같은 화면이 쪽마다 달라지고, 무엇보다 이 앱은 원래
      그림자를 거의 안 씁니다 — 판만 혼자 그림자를 지고 있었습니다.
      지도와 갈리는 자리는 위쪽 한 줄뿐이고, 선 하나면 그 자리를 말하는 데
      충분합니다.
    */
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    /*
      <h3>그림자는 걷되 레이어는 남깁니다</h3>

      <p>안드로이드의 elevation 은 두 가지를 같이 합니다 — 그림자를 그리고,
      그 뷰를 <b>제 레이어에 올립니다.</b> 그림자가 싫어서 elevation 을 아예
      뺐더니 레이어까지 같이 없어졌습니다.

      <p>그러자 판을 끌 때 깜빡이고 잔상이 남았습니다. 지도는 제 겉면을 따로
      가진 것이라, 레이어 없는 뷰가 그 위에서 높이를 바꾸면 지나간 자리가
      제때 안 지워집니다.

      <p>elevation 은 두고 그림자 색만 비웁니다. 레이어는 그대로 있고 그림자는
      안 보입니다. 판이 어디서 시작하는지는 위쪽 실선 한 줄이 말합니다.

      <p>그림자 색이 먹는 것은 안드로이드 9(API 28)부터입니다. 그 아래
      (이 앱은 8.0 까지 받습니다)에서는 옅은 그림자가 남는데, 안 보이는 것과
      깜빡이는 것 중에는 이쪽이 낫습니다.
    */
    ...(Platform.OS === 'android' ? Elevation.layerOnly : null),
    /* 지도(안드로이드에서는 제 겉면을 따로 가진 것)보다 위에 서야 합니다. */
    zIndex: 2,
    overflow: 'hidden',
  },
  dragHead: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  dragGripTap: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  /* 손잡이는 36×4 입니다. 44 였는데, 44 는 「누르는 것의 최소 크기」에서
     온 값입니다 — 이것은 누르는 것이 아니라 끄는 자리를 가리키는 표식이고,
     바텀시트의 손잡이와 같은 폭이어야 둘이 같은 동작으로 읽힙니다. */
  dragGrip: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderStrong,
  },
  /* 넓은 화면에서 글줄이 지나치게 길어지지 않게 가운데로 모읍니다. 판이
     화면 폭을 다 쓰면 날짜는 왼쪽 끝, 진행률은 오른쪽 끝에 떨어져 한눈에
     같이 읽히지 않습니다. */
  dragPeek: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Gutter,
    gap: Spacing.sm,
  },
  dragBody: {
    flex: 1,
  },
  dragBodyOuter: {
    paddingTop: Spacing.sm,
  },
  dragBodyInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Gutter,
    gap: Spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  title: {
    ...Type.title,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  subtitle: {
    ...Type.body,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  body: {
    ...Type.body,
    fontWeight: Weight.regular,
  },
  bodySmall: {
    ...Type.bodySmall,
    fontWeight: Weight.regular,
  },
  caption: {
    ...Type.caption,
    fontWeight: Weight.regular,
  },
  strong: {
    fontWeight: Weight.semibold,
  },

  field: {
    gap: Spacing.s2,
  },
  /* 라벨은 label 14/500 입니다. caption 13/600 이었는데, 작고 굵은 글자는
     「적어 둔 값」처럼 보여서 무엇을 적는 칸인지가 약하게 읽혔습니다. */
  label: {
    ...Type.label,
    fontWeight: Weight.medium,
    color: Colors.textSecondary,
  },
  /* 안 적으면 못 넘어가는 칸의 점. 「*」 가 아니라 점입니다 — 별표는
     각주처럼 읽혀서 아래에 설명이 있는지 찾게 됩니다. */
  labelDot: {
    color: Colors.accent,
  },

  /*
    칸의 상자.

    <p>높이 52 · r12 · 흰 바탕 · 1px gray300 · 좌우 16. 안쪽 글자와 단추를
    한 줄에 담으므로 {@code flexDirection: 'row'} 입니다.
  */
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
    height: Tap.control,
    borderRadius: Radius.r3,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: Spacing.s4,
  },
  /* 여러 줄은 최소 120. 104 였는데 네 줄째가 걸려서, 적는 동안 칸이
     스스로 굴러가 방금 친 줄이 안 보였습니다. */
  boxMultiline: {
    height: undefined,
    minHeight: 120,
    alignItems: 'flex-start',
    paddingVertical: Spacing.s3 + 2,
  },
  /*
    지금 쓰고 있는 칸.

    <p>테두리 색만 바꾸고 굵기는 1.5 로 한 단만 올립니다. 2 를 넘기면 칸이
    커진 것처럼 보여서 글자가 한 번 밀립니다.
  */
  boxFocused: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    /* 웹에서 칸을 누르면 브라우저가 제 테두리를 한 겹 더 둘러 줍니다.
       우리가 이미 그리고 있으니 둘이 겹칩니다. */
    outlineWidth: 0,
  },
  boxError: {
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  /* 못 쓰는 칸. 흰 바탕을 회색으로 돌려 「여기는 지금 못 적는다」를
     바탕으로 말합니다 — 글자만 흐리면 다 적힌 칸으로 보입니다. */
  boxOff: {
    backgroundColor: Colors.fill,
    borderColor: Colors.border,
  },
  /* 「원」·「명」. 누르는 것이 아니므로 흐린 글자입니다. */
  fieldUnit: {
    ...Type.body2,
    color: Colors.textMuted,
  },
  /* 힌트와 글자 수가 한 줄에서 양끝으로 갈립니다. */
  fieldNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.s1,
  },
  /*
    입력칸은 상자가 아니라 줄입니다.

    회색으로 채운 칸이 한 화면에 서넛 놓이면 그 회색 덩어리들이 먼저
    눈에 들어옵니다. 정작 봐야 할 것은 거기 적힌 글자인데도요.

    밑줄 하나면 "여기에 적는다" 가 그대로 전해지고, 화면에서 도형이
    그만큼 줍니다. 쓰는 동안에는 그 줄이 검게 굵어집니다 — 색을 못 쓰니
    지금 어느 칸에 있는지는 굵기가 말합니다.
  */
  /* 글자만 담습니다. 상자·테두리·여백은 겉껍데기({@code box})가 가집니다. */
  input: {
    flex: 1,
    ...Type.body,
    color: Colors.text,
    /* 브라우저가 둘러 주는 테두리. 겉껍데기가 이미 그립니다. */
    outlineWidth: 0,
  },
  inputMultiline: {
    alignSelf: 'stretch',
    textAlignVertical: 'top',
  },
  hint: {
    ...Type.caption,
    color: Colors.textMuted,
  },
  errorText: {
    ...Type.caption,
    color: Colors.danger,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    /* 그림과 글자 사이. 그림이 없으면 아무 일도 안 합니다. */
    gap: Spacing.s1 + 2,
  },
  buttonL: {
    height: Tap.control,
    borderRadius: Radius.r3,
    paddingHorizontal: Spacing.s5,
  },
  buttonM: {
    height: Tap.min,
    borderRadius: Radius.r3,
    paddingHorizontal: Spacing.s4,
  },
  buttonS: {
    height: Tap.compact,
    borderRadius: Radius.r2,
    paddingHorizontal: Spacing.s3,
  },
  /* 글에 붙어 있는 동작. 알약으로 둥글려야 글줄 사이에서 단추로 읽힙니다 —
     네모로 두면 작은 네모 하나가 글 옆에 붙은 것으로 보입니다. */
  buttonXS: {
    height: Tap.tiny,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.s2 + 2,
  },
  /* 지도 위에 떠 있는 것. 알약으로 둥글리고 그림자를 둡니다 — 지도의 길과
     건물 위에서는 실선만으로 가장자리가 안 보입니다. */
  buttonOnMap: {
    borderRadius: Radius.full,
    ...Elevation.float,
  },
  buttonLabelL: {
    ...Type.headline,
    fontWeight: Weight.semibold,
  },
  buttonLabelM: {
    ...Type.body2,
    fontWeight: Weight.semibold,
  },
  buttonLabelS: {
    ...Type.label,
    fontWeight: Weight.medium,
  },
  buttonLabelXS: {
    ...Type.caption,
    fontWeight: Weight.medium,
  },

  chip: {
    height: Tap.chip,
    borderRadius: Radius.full,
    /* 좌우 14. 16 이었는데, 알약이 길어져서 네댓 개가 한 줄에 안 들어가고
       두 줄로 접혔습니다 — 고르는 줄이 화면 위쪽을 두 줄씩 먹습니다. */
    paddingHorizontal: Spacing.s3 + 2,
    alignItems: 'center',
    justifyContent: 'center',
    /* 안 고른 칩은 흰 바탕이라 선이 없으면 어디서 끝나는지 안 보입니다. */
    borderWidth: 1,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    ...Type.body,
    color: Colors.text,
  },
  switchHint: {
    ...Type.caption,
    color: Colors.textMuted,
  },
  /*
    켜고 끄는 것.

    <h3>네모였습니다</h3>

    <p>{@code borderRadius: 0} 으로 둔 46×26 네모에 20 네모 손잡이였습니다.
    모서리를 안 쓰기로 했던 때의 것인데, 그러면 <b>켜고 끄는 것인지
    고르는 칸인지</b>가 안 보입니다 — 네모난 것은 이 앱에서 체크박스이고,
    체크박스는 「여럿 중 몇 개」, 스위치는 「이 하나를 켜고 끔」입니다.

    <p>알약으로 돌립니다. 두 쪽 기기가 모두 쓰는 51×31 이라, 처음 보는
    사람도 손가락으로 밀 수 있다는 것을 압니다.
  */
  switchTrack: {
    width: 51,
    height: 31,
    borderRadius: Radius.full,
    padding: 2,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 27,
    height: 27,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    /* 켜졌을 때 강조색 위에서, 꺼졌을 때 회색 위에서 둘 다 떠 보여야
       합니다. 옅은 그림자 하나로 충분합니다. */
    ...Elevation.stamp,
  },
  /*
    갈래를 나타내는 표식.

    <p>44 r12 네모였습니다. 44 는 <b>누르는 것의 최소 크기</b>인데 이것은
    누르는 것이 아니고, 네모는 {@link Card} 와 같은 모양입니다 — 목록 줄
    앞에 작은 카드가 하나 더 붙은 꼴이었습니다.

    <p>40 짜리 원으로 돌립니다. 원은 이 앱에서 「눌리지 않는 표식」이고,
    40 은 목록 줄의 구분선이 비켜서는 자리와 같은 값입니다(§3-4).
  */
  mark: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  markOn: {
    backgroundColor: Colors.accentSoft,
  },
  markEmoji: {
    ...Type.bodySmall,
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  markFallback: {
    ...Type.caption,
    fontWeight: Weight.bold,
    color: Colors.textSecondary,
  },
  /*
    걸려 있는 필터.

    <p>테두리를 둘렀다가 걷었습니다. 이것은 <b>고르는 칩이 아니라 이미
    걸린 것</b>입니다 — 테두리가 있으면 {@link Chip} 과 같은 무게로 서서,
    눌러서 거는 것인지 눌러서 떼는 것인지 헷갈립니다. 옅은 면만 두고 ×
    하나로 「떼는 것」을 말합니다.

    <p>높이도 30 으로 한 단 낮춥니다. 고르는 줄 바로 아래에 붙는 것이라
    36 이면 둘이 같은 줄처럼 보입니다.
  */
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s1,
    height: Tap.tiny,
    paddingHorizontal: Spacing.s3,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentSoft,
  },
  filterChipLabel: {
    ...Type.caption,
    fontWeight: Weight.medium,
    color: Colors.accentText,
  },
  /* 고른 것만 한 단 굵게. 검정 면 위에서 500 은 흰 글자가 얇아 보입니다. */
  chipLabelOn: {
    fontWeight: Weight.bold,
  },
  /* label 14/500. 15/600 이었는데, 굵은 15 는 목록 제목과 같은 무게라
     「고르는 것」보다 「적힌 것」으로 읽혔습니다. */
  chipLabel: {
    ...Type.label,
    fontWeight: Weight.medium,
  },

  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  /* 못 누르는 꼬리표. 칩(키 34, 알약, 테두리)과 생김새를 가릅니다. */
  tag: {
    height: 22,
    borderRadius: Radius.r1,
    paddingHorizontal: 6,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagLabel: {
    ...Type.micro,
    fontSize: 12,
    fontWeight: Weight.medium,
    color: Colors.textMuted,
  },

  /*
    내용 갈래를 바꾸는 탭.

    <p>아래로 한 가닥 선이 화면을 가로지르고, 고른 칸만 그 위에 2px 검정
    밑줄을 얹습니다. 선이 먼저 있어야 밑줄이 「그 선 위에 덧그어진 것」으로
    읽힙니다 — 선 없이 밑줄만 두면 글자에 줄을 친 것처럼 보입니다.
  */
  /* 바깥 겹 — 선을 화면 끝까지 긋습니다. */
  tabs: {
    marginHorizontal: -Gutter,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  /*
    안쪽 줄 — 글자를 글자선으로 되돌립니다.

    <p>{@code Gutter}(20) 에서 칸이 제 안에 가진 여백({@code s3} 12)을 뺀
    8 입니다. 그래야 <b>첫 칸의 글자</b>가 20 에 섭니다 — 20 을 그대로 주면
    글자가 32 에서 시작해 아래 내용보다 안으로 들어갑니다.
  */
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Gutter - Spacing.s3,
  },
  tabsRowPad: {
    paddingHorizontal: Gutter - Spacing.s3,
  },
  /* 굴러가는 탭은 칸이 제 글자만큼만 넓습니다. 고르게 나누면 칸 넷이
     화면을 채워 버려서 다섯째가 안 보입니다. */
  tabsRoll: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  tabsItem: {
    height: Tap.topTab,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.s3,
    /* 선 위에 밑줄을 얹으려고 아래쪽을 기준으로 둡니다. */
    position: 'relative',
  },
  tabsLabel: {
    ...Type.body2,
    fontWeight: Weight.medium,
    color: Colors.textMuted,
  },
  tabsLabelOn: {
    color: Colors.text,
    fontWeight: Weight.semibold,
  },
  tabsUnder: {
    position: 'absolute',
    left: Spacing.s3,
    right: Spacing.s3,
    bottom: -1,
    height: 2,
    backgroundColor: Colors.text,
  },


  /*
    띠는 밑줄이 아니라 알약입니다.

    <h3>밑줄이었던 까닭과 그만둔 까닭</h3>

    <p>한동안 고른 칸 아래에만 굵은 선을 그었습니다. 밝기가 아니라 있고 없음
    이라 한눈에 갈린다고 봤습니다.

    <p>그런데 밑줄은 <b>칸이 아니라 경계</b>를 말합니다. 그래서 띠가 아래
    내용의 머리처럼 읽혔고, 무엇보다 고른 칸이 <b>움직이지 않았습니다</b> —
    여기 켜졌다 저기 켜졌다 할 뿐이라 둘이 한 벌이라는 것이 안 보입니다.
    화면 맨 위에 서는 것이라 더 그렇습니다.

    <p>이제 바탕을 깔고 그 위에서 알약 하나가 미끄러집니다. 같은 것이 옮겨
    가므로 둘이 한 벌이고, 지금 어느 쪽인지가 모양으로 남습니다.

    <p>바탕은 회색입니다. 흰 판 위에 서든 회색 화면에 서든 제 바닥을 갖고,
    그 위의 흰 알약이 「지금 여기」를 말합니다.
  */
  /*
    바탕은 gray100, 모서리는 r12.

    <p>gray50 + 알약이었습니다. gray50 은 <b>구역을 가르는 띠</b>와 같은
    값이라, 띠를 쓰는 화면에서 이 묶음이 띠의 일부처럼 보였습니다 — 한 단
    더 내려 제 바닥을 갖게 합니다.

    <p>알약(full)을 r12 로 바꿉니다. 알약은 {@link Chip} 의 모양이고, 칩은
    <b>여럿 중 몇 개를 거는 것</b>입니다. 이것은 <b>둘 중 하나를 보는 것</b>
    이라 같은 모양을 쓰면 무슨 일이 일어나는지가 헷갈립니다.
  */
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.fillPressed,
    borderRadius: Radius.r3,
    padding: SEGMENT_PAD,
  },
  /* 고른 칸을 덮는 흰 알약. 글자 뒤에 깝니다. */
  segmentPill: {
    position: 'absolute',
    top: SEGMENT_PAD,
    bottom: SEGMENT_PAD,
    left: SEGMENT_PAD,
    borderRadius: Radius.r2,
    backgroundColor: Colors.surface,
    /* 손잡이는 e1 입니다. stamp 는 도장처럼 눌린 자리를 말하는 그림자라
       「위에 떠 있는 것」과 반대 방향으로 읽힙니다. */
    ...Elevation.card,
  },
  /*
    칸 높이 40 − 안쪽 여백.

    <p>44 였는데, 계획서가 세그먼트를 40 으로 두는 까닭은 이것이 화면 맨 위에
    늘 서 있는 것이라서입니다. 그 자리에서는 4픽셀이 상단을 그만큼 낮춰 줍니다.

    <h3>그래서 32픽셀만 눌렸습니다</h3>

    <p>보이는 띠는 40 인데 <b>누르는 것은 이 칸</b>이고, 칸은 띠의 안쪽 여백
    둘을 뺀 32 였습니다. 띠의 위아래 테를 누르면 아무 일도 안 일어났습니다 —
    마이페이지에서 「토글이 너무 짧다」고 한 것이 이 자리입니다. 그 화면에서는
    이것이 맨 위가 아니라 프로필과 갈래 탭 아래 중간에 서 있어, 4픽셀을 아껴
    봐야 아무것도 안 벌어 줍니다.
  */
  /*
    보이는 높이는 그대로 두고 {@code hitSlop} 으로 채웁니다.

    <p>{@link Tap.segment} 를 44 로 올리면 <b>앱의 모든 세그먼트</b>가 그만큼
    키가 큽니다 — 한 화면의 불만보다 큰 변경입니다.

    <p>채우는 끝은 <b>띠의 바깥선</b>입니다. {@code hitSlop} 은 부모 밖으로는
    안 나가므로(리액트 네이티브가 그렇게 못 박아 두었습니다), 여기서 더 늘려
    44 를 만들 수는 없습니다. 눌리는 높이 40 은 손가락이 겨냥하는 <b>보이는
    것과 같은</b> 크기이고, 44 가 필요하면 그때 고치는 것은 토큰입니다.
  */
  segmentItem: {
    flex: 1,
    height: Tap.segment - SEGMENT_PAD * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    ...Type.label,
    fontWeight: Weight.medium,
    color: Colors.textMuted,
  },
  segmentLabelOn: {
    color: Colors.text,
    fontWeight: Weight.semibold,
  },

  /* 같은 종류를 담는 흰 판. 카드가 제 여백을 갖는 것과 같은 크기입니다. */
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.lg,
    minHeight: 96,
    justifyContent: 'flex-end',
  },
  /* 아직 없는 것은 띄우지 않습니다. 못 누른다는 것이 글자(준비 중) 말고
     생김새로도 읽혀야 합니다 — 떠 있지 않으면 손이 가지 않습니다. */
  menuCardSoon: {
    backgroundColor: 'transparent',
    ...Elevation.none,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  /* 판 안에서는 납작하게. 판이 바탕이라 제 바탕과 테두리가 필요 없습니다.
     여백은 줄여도 됩니다 — 판이 바깥 여백을 이미 가지고 있습니다. */
  menuCardFlat: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: Spacing.md,
    minHeight: 76,
  },
  menuCardHalf: {
    /* 두 칸씩. 사이 간격(md)을 빼고 반씩 나눠 가집니다. */
    flexGrow: 1,
    flexBasis: '46%',
  },
  menuCardWide: {
    width: '100%',
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  menuText: {
    gap: Spacing.xs,
    flexShrink: 1,
  },
  menuTitle: {
    ...Type.body,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  menuTitleSoon: {
    color: Colors.textMuted,
  },
  menuChevron: {
    fontSize: 22,
    lineHeight: 22,
    color: Colors.textDisabled,
  },
  menuCaption: {
    ...Type.caption,
    color: Colors.textMuted,
  },

  /* 옅은 채움으로 구분하던 것을 가는 테두리로 바꿉니다. 무채색에서는
     옅은 채움끼리 밝기가 같아 아무 표시도 아닌 것이 됩니다. */
  checkTap: {
    width: Tap.min,
    height: Tap.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.r1 + 2,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },

  /*
    격자로 늘어놓고 고르는 칸.

    <p>최소 높이가 44 였습니다. 44 는 <b>손가락이 닿는 최소</b>이고, 이것은
    격자로 여러 개가 늘어서는 칸입니다 — 최소에 딱 맞춰 두니 이모지와
    이름이 위아래로 꽉 차서, 칸이 아니라 빽빽한 표처럼 보였습니다.
    계획서의 64 로 올립니다.
  */
  tile: {
    minWidth: 56,
    minHeight: 64,
    /* 이름이 붙는 칸은 글자가 들어갈 만큼 넓어야 합니다. */
    borderRadius: Radius.r3,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: Colors.fill,
    paddingVertical: Spacing.s2,
    paddingHorizontal: Spacing.s2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  /* 그림만 있는 칸. 넓힐 이유가 없습니다 — 넓히면 같은 개수가 줄을 더
     먹고, 고르는 화면이 그만큼 아래로 밀립니다. */
  tileBare: {
    minWidth: Tap.min,
    width: Tap.min,
    minHeight: Tap.min,
  },
  tileOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  tileMark: {
    ...Type.bodySmall,
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  tileLabel: {
    ...Type.caption,
  },
  /* 그림 없이 글자만 들어가는 칸. 그림 아래 붙는 이름보다 한 단 큽니다 —
     혼자 있으면 그것이 곧 그 칸의 얼굴입니다. */
  tileLabelAlone: {
    ...Type.bodySmall,
    fontWeight: Weight.semibold,
  },

  /*
    배지.

    <p>알약(full)이었습니다. 알약은 {@link Chip} 의 모양이라, 못 누르는
    배지가 <b>고를 수 있는 칩</b>처럼 보였습니다 — 눌러 봐도 아무 일이 안
    일어납니다. r4 로 내리고 높이를 20 으로 고정합니다.

    <p>높이를 안 주고 위아래 여백 3 으로 두면, 글자가 한글인지 숫자인지에
    따라 키가 달라져서 나란히 선 배지 둘이 어긋났습니다.
  */
  badge: {
    height: 20,
    borderRadius: Radius.r1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.s2 - 2,
  },
  /* 배지 글자는 micro 11/14 입니다 — 계획서 §2-2. 전에 여기가 보던
     {@code Type.label} 은 「구역 이름표」(12/16, 자간 1.2)였는데, 그 이름이
     버튼·칩·탭의 14/20 으로 바로잡히면서 배지 글자가 두 단 커질 처지였습니다. */
  badgeLabel: {
    ...Type.micro,
    fontWeight: Weight.semibold,
  },

  /*
    누르는 넓이는 늘 44 입니다.

    <p>보이는 칸이 40 이나 36 으로 줄어도 이 넓이는 안 줄입니다 — 계획서
    §2-8 의 「작게 보여도 44 를 채운다」입니다. 그래서 바탕을 가지는 꼴들은
    이 안에 제 크기의 원을 하나 더 그립니다.

    <p>모서리를 r12 로 두고 있었습니다. 그런데 바탕이 없는 것이 기본이 된
    뒤로 그 값을 쓰는 데가 한 군데도 없습니다 — 보이지 않는 칸의 모서리는
    아무 일도 안 합니다.
  */
  iconButton: {
    width: Tap.min,
    height: Tap.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 회색 원 40. 44 r12 네모였습니다 — 네모는 이 앱에서 카드의 모양이라,
     단추가 작은 카드처럼 보였습니다. */
  iconButtonFill: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
  },
  /* 선만 두른 원 36. 회색 면 위에 놓이는 단추는 면으로 말할 수 없습니다. */
  iconButtonOutline: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  /* 안에 볼 것이 있다는 점. accent 9 였는데, 바이올렛은 이 앱에서
     「눌러서 하는 일」의 색이라 점이 단추의 일부처럼 보였습니다. 계획서의
     danger 8 로 둡니다 — 들여다봐야 하는 것은 알림이고, 알림은 빨강입니다. */
  iconButtonDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  /* 지도 위에 떠 있는 단추. 동그랗고, 실선과 그림자로 지도에서 떼어 놓습니다. */
  /* 지도 위. 흰 원 40 에 그림자. 44 였는데, 지도 위에 떠 있는 것들은
     지도를 가리는 만큼만 작아야 합니다 — 누르는 넓이는 겉껍데기가 44 로
     지킵니다. */
  iconButtonOnMap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Elevation.float,
  },

  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Gutter,
    /* 계획서 §2-3 의 덮개입니다. 전에는 먹색을 섞은 rgba(25,31,40,.45) 를
       두 자리에 손으로 적어 두었습니다 — {@link Colors.scrim} 이 생긴 뒤에도
       그대로 남아, 토큰 쪽을 고쳐도 화면은 안 바뀌었습니다. */
    backgroundColor: Colors.scrim,
  },
  /*
    한 번 더 묻는 창.

    <p>최대 폭 320 입니다. 360 이었는데, 이 창에 드는 것은 제목 한 줄과
    설명 두어 줄뿐이라 넓으면 글자가 가로로 흩어져서 <b>한눈에 안
    읽힙니다.</b> 되돌릴 수 없는 일을 묻는 자리라 한눈에 읽혀야 합니다.

    <p>위를 아래보다 넓게 둡니다(28 / 20). 아래에는 단추가 서는데, 단추는
    제 안에 여백을 갖고 있어 같은 값으로 두면 아래가 더 벌어져 보입니다.
  */
  dialog: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.surface,
    borderRadius: Radius.r5,
    /* 가림막 위에 떠 있는 것이라 선이 아니라 그림자가 띄웁니다. */
    ...Elevation.dialog,
    paddingTop: Spacing.s6 + 4,
    paddingHorizontal: Spacing.s6,
    paddingBottom: Spacing.s5,
    gap: Spacing.s3,
  },
  dialogTitle: {
    ...Type.title3,
    fontWeight: Weight.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  dialogMessage: {
    ...Type.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  dialogActions: {
    marginTop: Spacing.sm,
  },
  dialogButton: {
    flexGrow: 1,
    flexBasis: 100,
  },

  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.scrim,
  },
  /* 넓은 화면에서는 가운데에 띄웁니다. */
  sheetWrapWide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetDialog: {
    width: '100%',
    maxWidth: 480,
    /* 아래가 아니라 가운데에 뜨므로 네 모서리가 모두 둥급니다. 위만 둥글면
       아래 모서리가 잘린 것처럼 보입니다. */
    borderRadius: Radius.r5,
    maxHeight: '80%',
    ...Elevation.dialog,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.r5,
    borderTopRightRadius: Radius.r5,
    /*
      선을 걷고 그림자로 띄웁니다.

      <p>판 위에 선을 한 가닥 그어 「여기서부터 판」을 말하고 있었습니다.
      모서리가 각지던 시절의 길입니다. 이제 위 모서리가 20만큼 둥글고 그림자가
      위로 드리우므로, 선은 그 위에 한 겹 더 얹힌 군더더기입니다.
    */
    ...Elevation.sheet,
    paddingTop: Spacing.s3,
    /* 화면을 다 덮지 않습니다. 뒤가 조금 보여야 어디로 돌아가는지 압니다. */
    maxHeight: '90%',
  },
  /* 위로 한 번 끌어올렸을 때. 내용이 짧아도 끝까지 폅니다 — 끌어올렸는데
     아무것도 안 움직이면 안 되는 줄 압니다. */
  sheetTall: {
    height: '90%',
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderStrong,
  },
  sheetTitle: {
    ...Type.title2,
    fontWeight: Weight.bold,
    color: Colors.text,
    flexShrink: 1,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Gutter,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  /*
    끌어올렸을 때 안이 비지 않게 채웁니다.

    <p>{@code flexGrow: 0} 이었습니다. 그래서 위로 끌어 {@link sheetTall} 이
    판을 90%로 키워도 <b>이 안의 스크롤 자리는 내용 길이만큼만</b> 그대로였고,
    남는 높이는 아래 단추({@code sheetFoot}) 밑으로 빈 면이 되어 버렸습니다 —
    판은 커졌는데 단추는 하단에 안 붙고 중간 어딘가에 떠 있는 것처럼 보였습니다.

    <p>{@code flexGrow: 1} 로 이 스크롤 자리가 남는 높이를 먹습니다. 그러면
    단추는 저절로 바닥에 붙고, 짧은 내용도 판이 커진 만큼 스크롤할 여지가
    생겨 끌어올린 보람이 있습니다. 내용이 원래 길어 꽉 차 있던 판에서는 아무
    것도 안 바뀝니다 — 먹을 남는 높이가 없기 때문입니다.
  */
  sheetBody: {
    flexGrow: 1,
  },
  sheetBodyInner: {
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  /*
    판 아래에 붙는 것.

    <p>위에 실선을 두르고 있었습니다. 화면 바닥의 고정 바와 같은 까닭으로
    걷습니다 — 선은 「여기서 구역이 갈린다」는 말이고, 이것은 <b>굴러가는
    내용 위에 떠 있는 것</b>입니다. 그림자로 말해야 그 아래로 내용이
    지나간다는 것이 보입니다.
  */
  sheetFoot: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.s3,
    backgroundColor: Colors.surface,
    ...Elevation.float,
    /* 아래가 아니라 위로. 이 아래에는 아무것도 없습니다. */
    shadowOffset: { width: 0, height: -4 },
    gap: Spacing.s2,
  },

  /*
    찾는 칸.

    <p>회색 면에 테두리가 없습니다. 적는 칸({@code box})이 흰 바탕에 선을
    두르는 것과 일부러 반대로 둡니다 — 한 화면에 둘이 같이 있을 때 어느
    것이 적는 칸이고 어느 것이 걸러 보는 칸인지 생김새로 갈려야 합니다.
  */
  seek: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
    height: Tap.min,
    borderRadius: Radius.r3,
    backgroundColor: Colors.fill,
    paddingHorizontal: Spacing.s3,
  },

  /*
    더하고 빼는 칸.

    <p>회색 면이었습니다. 적는 칸이 상자형으로 바뀌면서 같은 폼 안에
    회색 면 하나가 끼어 보였습니다 — 둘 다 「값을 정하는 칸」인데 하나는
    흰 상자, 하나는 회색 덩어리였습니다. 같은 상자를 두릅니다.

    <p>높이만 44 로 한 단 낮습니다. 글자를 치는 칸이 아니라 두 단추를
    누르는 칸이고, 52 로 두면 그 안의 단추들 위아래가 휑합니다.
  */
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.r3,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: Spacing.s2,
    height: Tap.min,
  },
  stepperValue: {
    ...Type.body,
    fontWeight: Weight.bold,
    color: Colors.text,
  },

  /* 목록 위에 띄웁니다. box-none 이라 띠 바깥은 그대로 눌립니다. */
  snackSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Gutter,
  },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 480,
    width: '100%',
    paddingVertical: Spacing.s2 + 2,
    paddingLeft: Spacing.s4,
    paddingRight: Spacing.s2,
    borderRadius: Radius.r4,
    /* gray800. gray900 이었는데, 그것은 <b>글자색</b>입니다 — 같은 값으로
       면을 깔면 띠가 글자 덩어리처럼 보이고, 그 위에 얹힌 흰 글자가 파낸
       것처럼 읽힙니다. 한 단 밝은 면이 「진한 띠」로 보입니다. */
    backgroundColor: Palette.gray[800],
  },
  snackText: {
    flex: 1,
    ...Type.bodySmall,
    fontWeight: Weight.medium,
    color: Colors.surface,
  },
  snackAction: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  /* 어두운 바닥 위입니다. 코랄 잉크는 검정 위에서 어두워 안 보이므로
     여기서만 옅은 쪽을 씁니다. */
  snackActionText: {
    ...Type.bodySmall,
    fontWeight: Weight.bold,
    /* violet300. violet50 은 거의 흰색이라 진한 띠 위에서 옆의 흰 글자와
       구별이 안 돼, 누를 수 있다는 것이 안 보였습니다. */
    color: Palette.violet[300],
  },
  /* 빈 화면 한 줄. */
  /* 비어 있음을 말하는 그림이 드는 회색 원. */
  emptyMark: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLine: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyNote: {
    ...Type.body2,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
  },
  /* 기다리는 점 셋. 글자 위에 서므로 한 덩어리로 모읍니다 — 사이를 8 로
     벌리면 점 셋이 아니라 따로 선 점 세 개로 보입니다. */
  waitDots: {
    flexDirection: 'row',
    gap: Spacing.s1,
  },
  waitDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    /* 옛 바퀴와 같은 회색입니다. */
    backgroundColor: Colors.textDisabled,
  },
  /*
    올 줄 하나.

    <p>{@link ListRow} 의 <b>부제가 붙은 줄</b>과 같은 키·같은 여백입니다.
    어긋나면 칸이 걷히고 줄이 들어설 때 그 차이만큼 목록이 들썩여, 자리를
    미리 비워 둔 뜻이 없어집니다.
  */
  bone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    paddingVertical: Spacing.s3,
    minHeight: 72,
  },
  /*
    회색 칸의 색.

    <p>{@code Colors.fillPressed} 와 같은 값인데 그 이름으로 안 부릅니다 —
    여기는 눌린 면이 아닙니다. 토큰 설명이 gray100 을 <b>스켈레톤의 색</b>
    으로 적어 두었고, 부품 안에서는 단계를 직접 집어도 됩니다.
  */
  boneThumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.r2,
    backgroundColor: Palette.gray[100],
  },
  boneText: {
    flex: 1,
    gap: Spacing.s2,
  },
  boneLine: {
    height: 14,
    borderRadius: Radius.r1,
    backgroundColor: Palette.gray[100],
  },
  /* 둘째 줄은 짧고 얇습니다. 둘이 같은 길이면 글이 아니라 표처럼 보입니다. */
  boneLineTail: {
    height: 12,
    width: '48%',
  },
  /* 옅은 붉은 상자였습니다. 색을 걷으니 흰 바탕에 흰 상자가 되어
     아무 표시도 아니게 됐습니다. 상자 대신 왼쪽에 선 한 줄을 세웁니다 —
     도형이 하나 줄고, 무엇에 대한 말인지는 그대로 보입니다. */
  note: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.s1,
    gap: Spacing.s2,
    alignItems: 'flex-start',
  },
  noteText: {
    ...Type.bodySmall,
    color: Colors.danger,
  },
});
