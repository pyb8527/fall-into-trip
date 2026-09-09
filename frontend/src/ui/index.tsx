import Feather from '@expo/vector-icons/Feather';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
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

import {
  Colors,
  Gutter,
  Lift,
  MaxContentWidth,
  Motion,
  Radius,
  ScreenGap,
  Spacing,
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

export function Press({
  children,
  onPress,
  disabled,
  scale = 0.97,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** 얼마나 작아질지. 큰 판일수록 덜 줄어야 어색하지 않습니다. */
  scale?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link';
  accessibilityState?: { selected?: boolean; disabled?: boolean; busy?: boolean };
  hitSlop?: number;
}) {
  const value = useRef(new Animated.Value(1)).current;

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
      onPressIn={() => to(scale, Motion.tap)}
      onPressOut={() => to(1, Motion.base)}
      style={[style, { transform: [{ scale: value }] }]}>
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
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [value, order]);

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
  scroll?: boolean;
  /** 위에 막대(헤더)가 없는 화면이면 켭니다. 노치를 피해 여백을 넣습니다. */
  safeTop?: boolean;
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
  { children, header, footer, scroll = true, safeTop = false },
  ref,
) {
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();
  const scroller = useRef<ScrollView>(null);

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: () => scroller.current?.scrollTo({ y: 0, animated: true }),
    }),
    [],
  );

  const body = <View style={styles.screenInner}>{children}</View>;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      /* 자판이 가리는 만큼 아래에서 밀어 올립니다.

         안드로이드는 예전에 창 자체가 줄어들어 손댈 일이 없었지만,
         Expo 54 부터 화면 끝까지 그리는 방식이 기본이라 이제 줄지 않습니다.
         두 쪽 다 직접 밀어야 합니다. */
      behavior="padding">
      {header ? (
        <View style={[styles.header, { paddingTop: (safeTop ? insets.top : 0) + Spacing.lg }]}>
          <View style={styles.headerInner}>{header}</View>
        </View>
      ) : null}

      {scroll ? (
        <ScrollView
          ref={scroller}
          contentContainerStyle={[
            styles.scrollBody,
            {
              paddingTop: header ? Spacing.lg : (safeTop ? insets.top : 0) + Spacing.xxl,
              /* 아래 버튼이 있으면 그 높이만큼, 없으면 홈 인디케이터만큼 띄웁니다. */
              paddingBottom: footer ? Spacing.xl : insets.bottom + Spacing.huge,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.staticBody,
            { paddingTop: (safeTop ? insets.top : 0) + Spacing.xxl },
          ]}>
          {body}
        </View>
      )}

      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: (keyboardUp ? 0 : insets.bottom) + Spacing.md },
          ]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
});

/** 흰 판. 관련 있는 것들을 하나로 묶습니다. */
export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * 눌러서 들어가는 줄.
 *
 * 줄 전체가 눌리는 자리입니다. 안에 작은 버튼을 넣으면 어디를 누르는지
 * 헷갈리므로, 곁다리 동작은 right 에 표시만 두고 상세 화면에서 다룹니다.
 */
export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} scale={0.985} style={styles.listRow}>
      <View style={styles.listRowText}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Press>
  );
}

export function Row({ children, style, gap = Spacing.sm, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View style={[styles.row, { gap }, style]} {...rest}>
      {children}
    </View>
  );
}

/** 카드 안에서 내용을 가르는 얇은 선. */
export function Divider() {
  return <View style={styles.divider} />;
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
  | 'inverse';

const toneColor: Record<Tone, string> = {
  default: Colors.text,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  danger: Colors.danger,
  success: Colors.success,
  /* 칠하는 색(파스텔)이 아니라 글자로 읽히는 짙은 쪽을 씁니다. */
  accent: Colors.accentInk,
  hot: Colors.hot,
  warning: Colors.warning,
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
  /* 바탕이 이미 진한 자리에 쓰므로 무른 배경은 두지 않습니다. */
  inverse: 'transparent',
};

/** 화면의 제목. 한 화면에 하나만. */
export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
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
  ...rest
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  /* 지금 쓰고 있는 칸이 어디인지 보이게 합니다. 회색 칸이 여럿 붙어 있으면
     커서만으로는 눈에 잘 띄지 않습니다. */
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
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
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  /** 줄 안에 들어가는 작은 버튼. 보이는 높이만 줄이고 누르는 넓이는 그대로입니다. */
  compact?: boolean;
}) {
  const off = disabled || busy;

  /* 못 누르는 버튼은 흐리게 만드는 대신 아예 다른 색으로 둡니다. 투명도만
     낮추면 그 아래 배경이 비쳐 글자가 읽기 어려워집니다. */
  const palette: Record<ButtonVariant, { bg: string; pressed: string; fg: string }> = {
    primary: { bg: Colors.accent, pressed: Colors.accentPressed, fg: Colors.accentText },
    secondary: { bg: Colors.fill, pressed: Colors.fillPressed, fg: Colors.textSecondary },
    danger: { bg: Colors.dangerSoft, pressed: Colors.dangerSoftPressed, fg: Colors.danger },
    ghost: { bg: 'transparent', pressed: Colors.fill, fg: Colors.textSecondary },
  };
  const c = palette[variant];
  const offBg = variant === 'ghost' ? 'transparent' : Colors.fill;

  return (
    <Press
      onPress={onPress}
      disabled={off}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      /* 보이는 높이가 44 보다 작으면 그만큼 누르는 넓이를 넓혀 줍니다. */
      hitSlop={compact ? Tap.compactSlop : undefined}
      scale={compact ? 0.94 : 0.975}
      style={[
        styles.button,
        compact ? styles.buttonCompact : styles.buttonFull,
        { backgroundColor: off ? offBg : c.bg },
        /* 주 동작에는 제 색을 옅게 흘려 둡니다. 어두운 화면에서 라임 하나가
           떠 있으면 어디를 눌러야 하는지 찾을 필요가 없습니다. */
        !off && variant === 'primary' ? styles.buttonGlow : null,
      ]}>
      {busy ? (
        <ActivityIndicator color={off ? Colors.textDisabled : c.fg} size="small" />
      ) : (
        <Text
          style={[
            compact ? styles.buttonLabelCompact : styles.buttonLabel,
            { color: off ? Colors.textDisabled : c.fg },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      )}
    </Press>
  );
}

/** 켜고 끄는 한 줄짜리 선택지. 필터에 씁니다. */
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
          backgroundColor: selected ? Colors.accent : Colors.fill,
          borderColor: selected ? Colors.accent : Colors.border,
        },
      ]}>
      <Text
        style={[styles.chipLabel, { color: selected ? Colors.accentText : Colors.textSecondary }]}>
        {label}
      </Text>
    </Press>
  );
}

/** 상태를 한눈에 보여 주는 작은 표식. 누르는 것이 아닙니다. */
export function Badge({ label, tone = 'muted' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: toneSoft[tone] }]}>
      <Text style={[styles.badgeLabel, { color: toneColor[tone] }]}>{label}</Text>
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
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segmentItem, selected && styles.segmentItemOn]}>
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelOn]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
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
  return (
    <Press
      onPress={onPress}
      disabled={soon || !onPress}
      accessibilityState={{ disabled: !!soon }}
      scale={0.965}
      style={[
        styles.menuCard,
        wide ? styles.menuCardWide : styles.menuCardHalf,
        soon ? styles.menuCardSoon : null,
      ]}>
      <View style={styles.menuText}>
        <Row gap={Spacing.sm}>
          <Text style={[styles.menuTitle, soon && styles.menuTitleSoon]}>{title}</Text>
          {soon ? <Badge label="준비 중" tone="muted" /> : null}
        </Row>
        <Text style={styles.menuCaption}>{caption}</Text>
      </View>
      {wide && !soon ? <Text style={styles.menuChevron}>›</Text> : null}
    </Press>
  );
}

/* ------------------------------------------------------------------ 아이콘 */

/** 쓰는 아이콘 이름만 열어 둡니다. 아무거나 부르면 화면마다 결이 흐트러집니다. */
export type IconName =
  | 'check'
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
  | 'star'
  | 'bookmark'
  | 'compass'
  | 'message-square'
  | 'upload';

export function Icon({
  name,
  size = 18,
  tone = 'default',
}: {
  name: IconName;
  size?: number;
  tone?: Tone;
}) {
  return <Feather name={name} size={size} color={toneColor[tone]} />;
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
  tone = 'secondary',
  active,
  disabled,
  onMap,
}: {
  name: IconName;
  /** 무엇을 하는 단추인지. 눈에는 안 보이고 읽어 주는 기기만 씁니다. */
  label: string;
  onPress: () => void;
  tone?: Tone;
  /** 켜진 상태(예: 다녀옴). 눌러 둔 것처럼 보이게 합니다. */
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
}) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      scale={0.88}
      style={[
        styles.iconButton,
        onMap && styles.iconButtonOnMap,
        {
          backgroundColor: active
            ? toneSoft[tone]
            : onMap
              ? Colors.surface
              : Colors.fill,
        },
        active && onMap ? { borderColor: toneColor[tone] } : null,
      ]}>
      <Icon name={name} tone={disabled ? 'muted' : active ? tone : 'secondary'} />
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
          <Subtitle>{title}</Subtitle>
          {message ? (
            <Body small tone="secondary">
              {message}
            </Body>
          ) : null}
          <Row gap={Spacing.sm} style={styles.dialogActions}>
            <View style={styles.dialogButton}>
              <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
            </View>
            <View style={styles.dialogButton}>
              <Button
                label={confirmLabel}
                variant={danger ? 'danger' : 'primary'}
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        /* 판은 화면 아래에 붙어 있어 자판이 그대로 덮습니다. 게다가 Modal
           안에는 창을 줄여 주는 동작이 미치지 않습니다. 직접 밀어 올립니다.
           판의 최대 높이가 비율(88%)이라 밀린 만큼 판도 같이 낮아집니다. */
        behavior="padding">
        {/* 바깥을 누르면 닫힙니다. */}
        <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="닫기" />

        <View
          style={[
            styles.sheet,
            { paddingBottom: (keyboardUp ? 0 : insets.bottom) + Spacing.md },
          ]}>
          <View style={styles.sheetGrip} />

          <View style={styles.sheetHead}>
            <Subtitle>{title}</Subtitle>
            <IconButton name="x" label="닫기" onPress={onClose} />
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>

          {footer ? <View style={styles.sheetFoot}>{footer}</View> : null}
        </View>
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
export function DragSheet({
  children,
  /** 화면 높이에서 판이 차지할 몫. 낮은 것부터 적습니다. */
  snaps = [0.28, 0.55, 0.92],
  /** 처음 붙는 자리. snaps 의 몇 번째인지. */
  initial = 1,
  /** 판 맨 위에 늘 보이는 줄. 손잡이 옆에 붙습니다. */
  peek,
  onSnapChange,
}: {
  children: React.ReactNode;
  snaps?: number[];
  initial?: number;
  peek?: React.ReactNode;
  onSnapChange?: (index: number) => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /* 픽셀로 바꿔 둡니다. 화면을 돌리거나 브라우저 창을 줄이면 다시 계산됩니다. */
  const stops = snaps.map((r) => Math.round(height * r));
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
      onSnapChange?.(next);
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
    [tall, onSnapChange, stops.join(',')],
  );

  /* 창 크기가 바뀌면 붙어 있던 자리를 새 높이로 다시 잡습니다. */
  useEffect(() => {
    tall.setValue(stops[Math.min(atRef.current, stops.length - 1)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.join(',')]);

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
    <Animated.View style={[styles.dragSheet, { height: tall }]}>
      {/* 손잡이와 그 옆 줄까지가 끄는 자리입니다. 손잡이만 잡게 하면
          손가락으로는 잘 안 맞습니다. */}
      <View {...pan.panHandlers} style={styles.dragHead}>
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
        style={styles.dragBody}
        contentContainerStyle={[
          styles.dragBodyInner,
          { paddingBottom: insets.bottom + Spacing.huge },
        ]}
        /* 맨 위까지 올라오기 전에는 굴리지 않습니다. 판을 끄는 손짓과
           다투지 않게 하려는 것입니다. */
        scrollEnabled={top}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </Animated.View>
  );
}

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

export function Loading({ label = '불러오는 중' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.accentInk} />
      <Caption>{label}</Caption>
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteText}>{message}</Text>
      {onRetry ? <Button label="다시 시도" variant="ghost" compact onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Body tone="muted">{message}</Body>
    </View>
  );
}

/**
 * 되돌릴 수 없는 일에는 한 번 더 묻습니다.
 *
 * React Native 의 Alert 은 웹에서 동작이 제각각이라 화면 안에서 처리합니다.
 * 누르면 바로 실행되지 않고 "정말요?" 가 그 자리에 나타납니다.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  variant = 'danger',
  busy,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: ButtonVariant;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button
        label={label}
        variant={variant}
        compact
        busy={busy}
        disabled={disabled}
        onPress={() => setArmed(true)}
      />
    );
  }
  return (
    <Row gap={Spacing.xs}>
      <Button
        label={confirmLabel}
        variant={variant}
        compact
        busy={busy}
        onPress={() => {
          setArmed(false);
          onConfirm();
        }}
      />
      <Button label="취소" variant="ghost" compact onPress={() => setArmed(false)} />
    </Row>
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
  screenInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: ScreenGap,
  },

  header: {
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.md,
  },
  footer: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    /* 스크롤되는 내용과 붙어 보이지 않게 실선 하나만 둡니다. */
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  footerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    /* 거의 흰 바탕 위의 흰 카드입니다. 실선을 두르면 그 선이 카드 안의
       글자보다 먼저 눈에 띕니다. 옅고 넓은 그림자로만 띄웁니다. */
    ...Lift,
    padding: Spacing.xl,
    gap: Spacing.md,
  },

  listRow: {
    backgroundColor: Colors.surface,
    ...Lift,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    minHeight: Tap.min + Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  listRowText: {
    flexShrink: 1,
    gap: Spacing.xs,
  },
  listRowTitle: {
    ...Type.body,
    fontWeight: Weight.semibold,
    color: Colors.text,
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

  /* --------------------------------------------------- 지도 위의 판 */
  dragSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    /* 지도 위에 얹히는 판이라 위쪽으로 그림자를 드리웁니다. 실선만 두면
       지도의 길과 섞여 판의 시작이 보이지 않습니다. */
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
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
  dragGrip: {
    alignSelf: 'center',
    width: 44,
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
  dragBodyInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Gutter,
    paddingTop: Spacing.sm,
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
    gap: Spacing.sm,
  },
  label: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Colors.textSecondary,
  },
  input: {
    height: Tap.control,
    borderRadius: Radius.md,
    backgroundColor: Colors.fill,
    paddingHorizontal: Spacing.lg,
    ...Type.body,
    color: Colors.text,
    /* 자리를 미리 잡아 둡니다. 눌렸을 때 테두리가 생기며 글자가 밀리지 않게. */
    borderWidth: 1.5,
    borderColor: Colors.fill,
  },
  inputMultiline: {
    height: 104,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    textAlignVertical: 'top',
  },
  inputFocused: {
    backgroundColor: Colors.surface,
    borderColor: Colors.accent,
  },
  inputError: {
    backgroundColor: Colors.surface,
    borderColor: Colors.danger,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFull: {
    height: Tap.control,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
  },
  buttonCompact: {
    height: Tap.compact,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
  },
  /* 주 동작도 카드와 같은 그림자로 띄웁니다. 색 그림자를 깔면 단추 아래가
     물들어 탁해집니다. */
  buttonGlow: Lift,
  buttonLabel: {
    ...Type.body,
    fontWeight: Weight.semibold,
  },
  buttonLabelCompact: {
    ...Type.bodySmall,
    fontWeight: Weight.semibold,
  },

  chip: {
    height: Tap.compact,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    /* 어두운 바탕에서 칩과 판은 밝기가 비슷합니다. 실선이 없으면 칩이
       어디서 끝나는지 보이지 않습니다. */
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    ...Type.bodySmall,
    fontWeight: Weight.semibold,
  },

  segment: {
    flexDirection: 'row',
    /* 판(surface)보다 한 단 어둡게 눌러 앉힙니다. 고른 칸만 다시 떠오릅니다. */
    backgroundColor: Colors.abyss,
    borderRadius: Radius.lg,
    padding: Spacing.xs,
    gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  segmentItem: {
    flex: 1,
    height: Tap.min,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemOn: {
    backgroundColor: Colors.fill,
  },
  segmentLabel: {
    ...Type.bodySmall,
    fontWeight: Weight.semibold,
    color: Colors.textMuted,
  },
  segmentLabelOn: {
    color: Colors.accentInk,
  },

  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    ...Lift,
    padding: Spacing.xl,
    minHeight: 104,
    justifyContent: 'center',
  },
  /* 아직 없는 것은 띄우지 않습니다. 못 누른다는 것이 글자(준비 중) 말고
     생김새로도 읽혀야 합니다 — 떠 있지 않으면 손이 가지 않습니다. */
  menuCardSoon: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
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

  badge: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md - 2,
  },
  badgeLabel: {
    ...Type.caption,
    fontWeight: Weight.bold,
  },

  iconButton: {
    width: Tap.min,
    height: Tap.min,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 지도 위에 떠 있는 단추. 동그랗고, 실선과 그림자로 지도에서 떼어 놓습니다. */
  iconButtonOnMap: {
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Gutter,
    backgroundColor: 'rgba(25, 31, 40, 0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
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
    backgroundColor: 'rgba(25, 31, 40, 0.45)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingTop: Spacing.md,
    /* 화면을 다 덮지 않습니다. 뒤가 조금 보여야 어디로 돌아가는지 압니다. */
    maxHeight: '88%',
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.fillPressed,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Gutter,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sheetBody: {
    flexGrow: 0,
  },
  sheetBodyInner: {
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  sheetFoot: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.fill,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: Tap.control,
  },
  stepperValue: {
    ...Type.body,
    fontWeight: Weight.bold,
    color: Colors.text,
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
  },
  note: {
    backgroundColor: Colors.dangerSoft,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  noteText: {
    ...Type.bodySmall,
    color: Colors.danger,
  },
});
