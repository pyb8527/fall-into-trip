import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Tap, Type, Weight } from '@/constants/theme';

/**
 * 날짜 고르기 (웹).
 *
 * 브라우저가 가진 달력을 그대로 씁니다. 직접 그린 달력보다 낫습니다 —
 * 기기의 언어·요일 시작·터치 습관을 이미 알고 있습니다.
 *
 * 값은 YYYY-MM-DD 로 주고받습니다. 서버가 그 형식을 받습니다.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  min,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  /** 이보다 앞선 날은 못 고릅니다. */
  min?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: Tap.control,
          borderRadius: Radius.none,
          backgroundColor: Colors.fill,
          border: `1.5px solid ${Colors.fill}`,
          paddingLeft: Spacing.lg,
          paddingRight: Spacing.md,
          fontSize: Type.body.fontSize,
          fontWeight: Weight.regular,
          color: Colors.text,
          fontFamily: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.sm,
  },
  label: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Colors.textSecondary,
  },
  hint: {
    ...Type.caption,
    color: Colors.textMuted,
  },
});
