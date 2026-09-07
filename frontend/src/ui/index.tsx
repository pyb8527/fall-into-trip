import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

import { MaxContentWidth, Radius, Spacing, type Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 화면 어디서나 쓰는 조각들.
 *
 * 화면마다 StyleSheet 을 새로 쓰면 여백과 색이 조금씩 어긋납니다. 여기 있는
 * 것만 조합해서 씁니다.
 */

/* ------------------------------------------------------------------ 뼈대 */

export function Screen({
  children,
  scroll = true,
  ...rest
}: ViewProps & { scroll?: boolean }) {
  const theme = useTheme();
  const body = (
    <View style={[styles.screenInner, { maxWidth: MaxContentWidth }]} {...rest}>
      {children}
    </View>
  );

  if (!scroll) {
    return <View style={[styles.screen, { backgroundColor: theme.background }]}>{body}</View>;
  }
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.screenScroll}
      keyboardShouldPersistTaps="handled">
      {body}
    </ScrollView>
  );
}

export function Card({ children, style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

export function Row({ children, style, gap = Spacing.two, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View style={[styles.row, { gap }, style]} {...rest}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ 글씨 */

type TextTone = 'default' | 'secondary' | 'muted' | 'danger' | 'success' | 'accent';

const toneColor = (theme: Theme, tone: TextTone) =>
  ({
    default: theme.text,
    secondary: theme.textSecondary,
    muted: theme.textMuted,
    danger: theme.danger,
    success: theme.success,
    accent: theme.accent,
  })[tone];

export function Title({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.text }]}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.subtitle, { color: theme.text }]}>{children}</Text>;
}

export function Body({
  children,
  tone = 'default',
  numberOfLines,
}: {
  children: React.ReactNode;
  tone?: TextTone;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  return (
    <Text style={[styles.body, { color: toneColor(theme, tone) }]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Caption({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: TextTone;
}) {
  const theme = useTheme();
  return <Text style={[styles.caption, { color: toneColor(theme, tone) }]}>{children}</Text>;
}

/* ------------------------------------------------------------------ 입력 */

export function Field({
  label,
  hint,
  style,
  ...rest
}: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
          style,
        ]}
        {...rest}
      />
      {hint ? <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text> : null}
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
  compact?: boolean;
}) {
  const theme = useTheme();
  const off = disabled || busy;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: theme.accent, fg: theme.accentText, border: theme.accent },
    secondary: { bg: theme.backgroundElement, fg: theme.text, border: theme.border },
    danger: { bg: theme.dangerSoft, fg: theme.danger, border: theme.dangerSoft },
    ghost: { bg: 'transparent', fg: theme.textSecondary, border: 'transparent' },
  };
  const c = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: c.bg, borderColor: c.border, opacity: off ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {busy ? (
        <ActivityIndicator color={c.fg} size="small" />
      ) : (
        <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: c.fg }]}>
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
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <Text style={[styles.chipLabel, { color: selected ? theme.accentText : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 상태를 한눈에 보여 주는 작은 표식. */
export function Badge({ label, tone = 'muted' }: { label: string; tone?: TextTone }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { borderColor: toneColor(theme, tone) }]}>
      <Text style={[styles.badgeLabel, { color: toneColor(theme, tone) }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ 상태 */

export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.accent} />
      <Caption>{label}</Caption>
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
      <Text style={[styles.body, { color: theme.danger }]}>{message}</Text>
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
    <Row gap={Spacing.one}>
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
    alignItems: 'center',
  },
  screenScroll: {
    alignItems: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  screenInner: {
    width: '100%',
    gap: Spacing.three,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonCompact: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    minHeight: 32,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLabelCompact: {
    fontSize: 13,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + 2,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingVertical: 1,
    paddingHorizontal: Spacing.one + 2,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  note: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    padding: Spacing.two + 2,
    gap: Spacing.one,
  },
});
