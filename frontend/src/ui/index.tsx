import Feather from '@expo/vector-icons/Feather';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Colors,
  Gutter,
  MaxContentWidth,
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        { backgroundColor: pressed ? Colors.fill : Colors.surface },
      ]}>
      <View style={styles.listRowText}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
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

type Tone = 'default' | 'secondary' | 'muted' | 'danger' | 'success' | 'accent' | 'warning';

const toneColor: Record<Tone, string> = {
  default: Colors.text,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  danger: Colors.danger,
  success: Colors.success,
  accent: Colors.accent,
  warning: Colors.warning,
};

const toneSoft: Record<Tone, string> = {
  default: Colors.fill,
  secondary: Colors.fill,
  muted: Colors.fill,
  danger: Colors.dangerSoft,
  success: Colors.successSoft,
  accent: Colors.accentSoft,
  warning: Colors.warningSoft,
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
  style,
}: {
  children: React.ReactNode;
  tone?: Tone;
  strong?: boolean;
  small?: boolean;
  numberOfLines?: number;
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
      numberOfLines={numberOfLines}>
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
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      /* 보이는 높이가 44 보다 작으면 그만큼 누르는 넓이를 넓혀 줍니다. */
      hitSlop={compact ? Tap.compactSlop : undefined}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : styles.buttonFull,
        { backgroundColor: off ? offBg : pressed ? c.pressed : c.bg },
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
    </Pressable>
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={Tap.compactSlop}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? Colors.accent
            : pressed
              ? Colors.fillPressed
              : Colors.fill,
        },
      ]}>
      <Text
        style={[styles.chipLabel, { color: selected ? Colors.accentText : Colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
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
    <Pressable
      onPress={onPress}
      disabled={soon || !onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!soon }}
      style={({ pressed }) => [
        styles.menuCard,
        wide ? styles.menuCardWide : styles.menuCardHalf,
        { backgroundColor: pressed ? Colors.fill : Colors.surface },
      ]}>
      <View style={styles.menuText}>
        <Row gap={Spacing.sm}>
          <Text style={[styles.menuTitle, soon && styles.menuTitleSoon]}>{title}</Text>
          {soon ? <Badge label="준비 중" tone="muted" /> : null}
        </Row>
        <Text style={styles.menuCaption}>{caption}</Text>
      </View>
      {wide && !soon ? <Text style={styles.menuChevron}>›</Text> : null}
    </Pressable>
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
  | 'calendar';

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
}: {
  name: IconName;
  /** 무엇을 하는 단추인지. 눈에는 안 보이고 읽어 주는 기기만 씁니다. */
  label: string;
  onPress: () => void;
  tone?: Tone;
  /** 켜진 상태(예: 다녀옴). 눌러 둔 것처럼 보이게 합니다. */
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: active
            ? toneSoft[tone]
            : pressed
              ? Colors.fillPressed
              : Colors.fill,
        },
      ]}>
      <Icon name={name} tone={disabled ? 'muted' : active ? tone : 'secondary'} />
    </Pressable>
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
      <ActivityIndicator color={Colors.accent} />
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
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },

  listRow: {
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
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
  },
  buttonCompact: {
    height: Tap.compact,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
  },
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
  },
  chipLabel: {
    ...Type.bodySmall,
    fontWeight: Weight.semibold,
  },

  segment: {
    flexDirection: 'row',
    /* 페이지 바탕(fill)과 같은 색을 쓰면 띠가 보이지 않습니다. 한 단계 진하게. */
    backgroundColor: Colors.fillPressed,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  segmentItem: {
    flex: 1,
    height: Tap.min,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemOn: {
    backgroundColor: Colors.surface,
  },
  segmentLabel: {
    ...Type.bodySmall,
    fontWeight: Weight.semibold,
    color: Colors.textMuted,
  },
  segmentLabelOn: {
    color: Colors.text,
  },

  menuCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    minHeight: 96,
    justifyContent: 'center',
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
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
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
