import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Tap, Type, Weight } from '@/constants/theme';
import { Icon } from '@/ui';

/**
 * 날짜 고르기 (앱).
 *
 * iOS·안드로이드가 가진 달력을 띄웁니다. 직접 그린 달력보다 낫습니다 —
 * 쓰는 사람이 이미 익숙한 모양이고, 기기의 언어와 요일 시작을 압니다.
 *
 * 값은 YYYY-MM-DD 로 주고받습니다. 서버가 그 형식을 받습니다.
 *
 * <h3>한 폼 안에 입력칸이 두 가지였습니다</h3>
 *
 * <p>이 칸은 <b>회색으로 채운 직각 상자</b>였습니다. 새 여행 폼에서는 바로
 * 위에 이름 {@code Field} 가 섭니다. 그 둘이 바탕색도 모서리도 달라서, 한
 * 화면에 적는 칸이 두 종류로 보였습니다 — 어느 쪽이 적는 칸인지가 생김새로
 * 안 읽힙니다.
 *
 * <p>{@code Field} 와 같은 상자를 씁니다. 숫자를 따로 적지 않고 같은 토큰을
 * 봅니다 — 한쪽만 손대도 둘이 어긋나지 않게.
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
  min?: string;
}) {
  const [open, setOpen] = useState(false);

  /* 시간대에 끌려가지 않게 자리 시간 기준으로 만듭니다. new Date('2026-10-08')
     은 UTC 자정으로 읽혀서, 한국에서는 전날로 보일 수 있습니다. */
  const parsed = parseLocal(value) ?? new Date();

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityLabel={`${label} 고르기`}
        /* 겹치는 차례는 Field 와 같습니다 — 오류가 눌림을 덮고, 못 쓰는
           상태가 그 둘을 덮습니다. */
        style={({ pressed }) => [
          styles.box,
          pressed && !disabled ? styles.boxPressed : null,
          error ? styles.boxError : null,
          disabled ? styles.boxOff : null,
        ]}>
        <Icon name="calendar" size={20} tone={disabled ? 'off' : 'muted'} />
        <Text style={disabled ? styles.valueDisabled : value ? styles.value : styles.placeholder}>
          {value ? format(parsed) : '날짜 고르기'}
        </Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={parsed}
          mode="date"
          display="spinner"
          minimumDate={min ? (parseLocal(min) ?? undefined) : undefined}
          onChange={(event, picked) => {
            /* 안드로이드는 고르거나 취소하면 창이 스스로 닫힙니다. */
            setOpen(false);
            if (event.type === 'set' && picked) {
              onChange(toIso(picked));
            }
          }}
        />
      ) : null}

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

function parseLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) {
    return null;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const format = (d: Date) =>
  `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} (${WEEKDAYS[d.getDay()]})`;

const styles = StyleSheet.create({
  field: {
    gap: Spacing.s2,
  },
  label: {
    ...Type.label,
    fontWeight: Weight.medium,
    color: Colors.textSecondary,
  },
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
  /* 눌림은 gray25 입니다. 못 쓰는 칸이 쓰는 gray50 을 여기에도 쓰면,
     누르는 동안 칸이 못 쓰게 된 것처럼 보입니다. */
  boxPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  /* 색만으로 가리지 않게 테두리도 한 단 굵힙니다. 무엇이 잘못됐는지는
     바로 아래 줄이 말합니다. */
  boxError: {
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  /* 못 쓰는 칸. 바탕을 회색으로 돌리고 테두리는 한 단 연하게 — Field 와
     같은 값입니다. 바탕만 바꾸고 진한 테두리를 두면 아직 쓸 수 있는
     칸으로 읽힙니다. */
  boxOff: {
    backgroundColor: Colors.fill,
    borderColor: Colors.border,
  },
  value: {
    ...Type.body,
    color: Colors.text,
  },
  placeholder: {
    ...Type.body,
    color: Colors.textDisabled,
  },
  valueDisabled: {
    ...Type.body,
    color: Colors.textDisabled,
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
