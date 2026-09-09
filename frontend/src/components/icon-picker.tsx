import { StyleSheet, View } from 'react-native';

import { PLACE_ICONS } from '@/constants/place-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Body, Caption, Press, Row } from '@/ui';

/**
 * 핀에 찍을 그림 고르기.
 *
 * <p>먼저 하나 찍혀 있습니다. 장소를 찾아 고르면 서버가 구글이 알려 준 갈래로
 * 짐작해 둡니다. 대개 맞고, 틀렸을 때만 손대면 됩니다 — 넣을 때마다 열여섯 개
 * 중에서 고르라고 하면 그것이 곧 일이 됩니다.
 *
 * <p>그림만 늘어놓지 않고 이름을 함께 답니다. 이모지는 기기마다 다르게 생겨,
 * 어떤 폰에서는 라멘과 우동이 거의 같아 보입니다.
 */
export function IconPicker({
  value,
  onChange,
  /** 그림을 안 고른 상태에 붙일 이름. 자리에 따라 다릅니다. */
  noneLabel = '번호',
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  noneLabel?: string;
}) {
  return (
    <View style={styles.picker}>
      <Row gap={Spacing.xs}>
        <Press
          onPress={() => onChange(null)}
          scale={0.9}
          accessibilityLabel={`그림 없이 ${noneLabel}`}
          accessibilityState={{ selected: value === null }}
          style={[styles.kind, value === null ? styles.kindOn : null]}>
          <Body small strong tone={value === null ? 'accent' : 'secondary'}>
            {noneLabel}
          </Body>
        </Press>
        {PLACE_ICONS.map((kind) => {
          const on = value === kind.key;
          return (
            <Press
              key={kind.key}
              onPress={() => onChange(kind.key)}
              scale={0.9}
              accessibilityLabel={kind.label}
              accessibilityState={{ selected: on }}
              style={[styles.kind, on ? styles.kindOn : null]}>
              <Body small style={styles.emoji}>
                {kind.emoji}
              </Body>
              <Caption tone={on ? 'accent' : 'muted'}>{kind.label}</Caption>
            </Press>
          );
        })}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    gap: Spacing.sm,
  },
  kind: {
    minWidth: 56,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.fill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  kindOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  emoji: {
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
});
