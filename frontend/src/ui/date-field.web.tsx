import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Tap, Type, Weight } from '@/constants/theme';
import { Icon } from '@/ui';

/**
 * 날짜 고르기 (웹).
 *
 * 브라우저가 가진 달력을 그대로 씁니다. 직접 그린 달력보다 낫습니다 —
 * 기기의 언어·요일 시작·터치 습관을 이미 알고 있습니다.
 *
 * 값은 YYYY-MM-DD 로 주고받습니다. 서버가 그 형식을 받습니다.
 *
 * <h3>한 폼 안에 입력칸이 두 가지였습니다</h3>
 *
 * <p>이 칸은 <b>회색으로 채운 직각 상자</b>였습니다. 바로 위에 서는 이름
 * {@code Field} 와 바탕색도 모서리도 달라서, 한 화면에 적는 칸이 두 종류로
 * 보였습니다. {@code Field} 와 같은 토큰을 보게 맞춥니다.
 *
 * <h3>달력 아이콘은 겹쳐 놓습니다</h3>
 *
 * <p>앞에 세우는 달력 그림을 {@code <input>} 옆에 나란히 두면, 그 그림이
 * 덮은 자리는 칸이 아니게 됩니다 — 거기를 눌러도 달력이 안 열립니다.
 * 그래서 칸은 상자 전체로 두고 그림만 그 위에 얹습니다. 손은 그림을 통과해
 * 칸에 닿습니다.
 *
 * <p>브라우저가 칸 오른쪽 끝에 제 달력 단추를 그려 둡니다. 그 자리는
 * 비워 둬야 합니다 — 가리면 웹에서 날짜를 아예 못 고릅니다.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
  min,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** 이보다 앞선 날은 못 고릅니다. */
  min?: string;
}) {
  /* 지금 쓰고 있는 칸이 어디인지 보이게 합니다 — Field 와 같은 테두리입니다. */
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <input
          type="date"
          value={value}
          min={min}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            height: Tap.control,
            borderRadius: Radius.r3,
            backgroundColor: disabled ? Colors.fill : Colors.surface,
            /* 겹치는 차례는 Field 와 같습니다 — 못 쓰는 상태가 오류를,
               오류가 포커스를 덮습니다. */
            border: disabled
              ? `1px solid ${Colors.border}`
              : error
                ? `1.5px solid ${Colors.danger}`
                : focused
                  ? `1.5px solid ${Colors.accent}`
                  : `1px solid ${Colors.borderStrong}`,
            /* 좌우 16 에, 왼쪽은 달력 그림 20 과 그 뒤 8 을 더 비웁니다. */
            paddingLeft: Spacing.s4 + 20 + Spacing.s2,
            /* 오른쪽은 브라우저가 제 달력 단추를 그리는 자리입니다. */
            paddingRight: Spacing.s4,
            fontSize: Type.body.fontSize,
            fontWeight: Weight.regular,
            color: disabled || !value ? Colors.textDisabled : Colors.text,
            fontFamily: 'inherit',
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <View style={styles.mark} pointerEvents="none">
          <Icon name="calendar" size={20} tone={disabled ? 'off' : 'muted'} />
        </View>
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.s2,
  },
  label: {
    ...Type.label,
    fontWeight: Weight.medium,
    color: Colors.textSecondary,
  },
  mark: {
    position: 'absolute',
    left: Spacing.s4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  hint: {
    ...Type.caption,
    color: Colors.textMuted,
  },
  errorText: {
    ...Type.caption,
    color: Colors.danger,
  },
});
