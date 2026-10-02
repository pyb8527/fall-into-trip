import { StyleSheet, Text, View } from 'react-native';

import type { TripSummary } from '@/api/types';
import { CountdownBadge } from '@/components/countdown-badge';
import { TripMark } from '@/components/trip-mark';
import { Colors, Radius, Spacing, Type, Weight } from '@/constants/theme';
import { formatNights, formatSpan, type Countdown } from '@/lib/countdown';
import { Icon, IconButton, Press, Row, type IconName } from '@/ui';

/** 카드 안의 할 일 칩 하나. 누르면 그 일을 하는 화면으로 갑니다. */
export type TodoChip = { label: string; onPress: () => void };

/** 카드 오른쪽 아래 그림 단추. 가고 싶은 곳 · 가계부 · 요약 같은 것. */
export type CardAction = { icon: IconName; label: string; onPress: () => void };

/**
 * 큰 여행 카드 — 홈 맨 위와 내 여행의 「곧 떠나요」가 같이 씁니다.
 *
 * <h3>이름과 날짜만 있었습니다</h3>
 *
 * <p>큰 카드가 표식 · D-day · 이름 · 날짜만 보여 줘서, 카드의 절반이
 * 바이올렛 빈 면이었습니다. 그 자리에 <b>함께 가는 사람</b>과 <b>남은 할 일</b>을
 * 둡니다 — 홈을 열자마자 다음에 할 일이 보입니다.
 *
 * <h3>준비 몇 퍼센트는 안 둡니다</h3>
 *
 * <p>챙길 것 · 투표 · 빈 날을 어떤 비율로 합칠지에 답이 없습니다. 답 없는
 * 숫자는 뜻을 잃습니다. 남은 일을 칩으로 적기만 합니다(plan-review Q3).
 *
 * <h3>카드 아래 동그라미 셋을 안으로</h3>
 *
 * <p>가고 싶은 곳 · 가계부 · 요약이 카드 아래 동그라미로 따로 서 있었습니다.
 * 할 일 칩과 하는 일이 겹쳐 보여서, 카드 오른쪽 아래 작은 그림 단추로
 * 줄였습니다.
 *
 * @param faces    「갈게요」 한 사람들의 얼굴. 넷까지 그리고 나머지는 수로
 * @param middle   카드 가운데 — 시기마다 다른 것(여행 중이면 오늘 다음 곳)
 * @param todos    남은 할 일. 내 여행 목록에서는 안 줍니다
 */
export function TripCard({
  trip,
  at,
  label,
  faces = [],
  middle,
  todos = [],
  actions = [],
  onPress,
}: {
  trip: TripSummary;
  at: Countdown | null;
  /** D-day 배지 글자를 바꿀 때(「여행 중 2일째」) */
  label?: string;
  faces?: string[];
  middle?: React.ReactNode;
  todos?: TodoChip[];
  actions?: CardAction[];
  onPress: () => void;
}) {
  return (
    /*
      카드 전체가 한 단추가 아닙니다.

      <p>할 일 칩과 그림 단추가 카드 안에 서므로, 카드 전체를 단추로 두면
      단추 안에 단추가 들어갑니다 — 웹에서는 그런 HTML 이 없고, 누른 자리가
      칩인지 카드인지가 흔들립니다. 위쪽(얼굴 · 이름 · 가운데)만 여행을 여는
      자리이고, 아래 줄은 저마다의 단추입니다.
    */
    <View style={styles.card}>
      <Press onPress={onPress} scale={0.99} accessibilityLabel={`${trip.title} 열기`} style={styles.open}>
      <View style={styles.top}>
        {faces.length > 0 ? (
          <Faces faces={faces} />
        ) : (
          <TripMark theme={trip.theme} emoji={trip.emoji} />
        )}
        <CountdownBadge at={at} label={label} />
      </View>

      <View style={styles.names}>
        <Text style={styles.title} numberOfLines={1}>
          {trip.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[
            formatSpan(trip.startIso, trip.endIso),
            trip.dayCount > 0 ? formatNights(trip.dayCount) : null,
            trip.groupName,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {middle}
      </Press>

      {todos.length > 0 || actions.length > 0 ? (
        <View style={styles.foot}>
          <Row gap={Spacing.s2} style={styles.todos}>
            {todos.map((t) => (
              <Press key={t.label} onPress={t.onPress} scale={0.96} style={styles.todo}>
                <Text style={styles.todoText} numberOfLines={1}>
                  {t.label}
                </Text>
                <Icon name="chevron-right" size={14} tone="secondary" />
              </Press>
            ))}
          </Row>
          {actions.length > 0 ? (
            <Row gap={Spacing.s1}>
              {actions.map((a) => (
                <IconButton key={a.label} name={a.icon} label={a.label} bare onPress={a.onPress} />
              ))}
            </Row>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * 함께 가는 사람 얼굴을 겹쳐서.
 *
 * <p>넷까지 그립니다. 다섯부터는 겹친 동그라미가 줄을 넘쳐 무엇이 누구인지
 * 안 보입니다 — 나머지는 「+3」.
 */
function Faces({ faces }: { faces: string[] }) {
  const shown = faces.slice(0, 4);
  const more = faces.length - shown.length;
  return (
    <Row style={styles.faces}>
      {shown.map((f, i) => (
        <View key={i} style={[styles.face, i > 0 ? styles.faceOver : null]}>
          <Text style={styles.faceText}>{f}</Text>
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.face, styles.faceOver, styles.faceMore]}>
          <Text style={styles.moreText}>+{more}</Text>
        </View>
      ) : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  /* 큰 카드의 모서리는 16 입니다(plan-review Q1 — 큰 카드 16, 목록 카드 12). */
  card: {
    borderRadius: 16,
    backgroundColor: Colors.accentSoft,
    padding: Spacing.s4,
    gap: Spacing.s3,
  },
  open: {
    gap: Spacing.s3,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  names: {
    gap: 2,
  },
  title: {
    ...Type.title2,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  meta: {
    ...Type.caption,
    color: Colors.textSecondary,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.s2,
  },
  todos: {
    flex: 1,
    flexWrap: 'wrap',
  },
  /* 할 일 칩. 흰 알약 — 바이올렛 면 위에서 「눌러서 하는 것」으로 뜹니다. */
  todo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingLeft: Spacing.s3,
    paddingRight: Spacing.s2,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  todoText: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  faces: {
    alignItems: 'center',
  },
  face: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 앞 얼굴에 3분의 1쯤 겹칩니다. */
  faceOver: {
    marginLeft: -10,
  },
  faceText: {
    fontSize: 16,
  },
  faceMore: {
    backgroundColor: Colors.accentSoftPressed,
  },
  moreText: {
    ...Type.micro,
    fontWeight: Weight.bold,
    color: Colors.accentText,
  },
});
