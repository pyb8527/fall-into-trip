import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Tap, Type, Weight } from '@/constants/theme';

/**
 * 날짜 고르기 (앱).
 *
 * iOS·안드로이드가 가진 달력을 띄웁니다. 직접 그린 달력보다 낫습니다 —
 * 쓰는 사람이 이미 익숙한 모양이고, 기기의 언어와 요일 시작을 압니다.
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
        accessibilityRole="button"
        accessibilityLabel={`${label} 고르기`}
        style={({ pressed }) => [styles.box, pressed && styles.boxPressed]}>
        <Text style={value ? styles.value : styles.placeholder}>
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

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
    gap: Spacing.sm,
  },
  label: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Colors.textSecondary,
  },
  box: {
    height: Tap.control,
    borderRadius: Radius.none,
    backgroundColor: Colors.fill,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  boxPressed: {
    backgroundColor: Colors.fillPressed,
  },
  value: {
    ...Type.body,
    color: Colors.text,
  },
  placeholder: {
    ...Type.body,
    color: Colors.textDisabled,
  },
  hint: {
    ...Type.caption,
    color: Colors.textMuted,
  },
});
