import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { Spacing } from '@/constants/theme';
import { daysBetween, formatDay, todayIso } from '@/lib/countdown';
import { BottomSheet, Button, Caption, Chip, ErrorNote, Field, Press, Row } from '@/ui';

/**
 * 가고 싶은 곳 투표 마감.
 *
 * <h3>왜 있는가</h3>
 *
 * <p>운영 서버의 도쿄 여행은 출발 이틀 전에도 「2명 중 0명 찬성」으로 열려
 * 있었습니다. 표를 언제까지 던지면 되는지 아무도 몰라서, 정해지지 않은 채
 * 출발이 다가왔습니다.
 *
 * <h3>정하는 규칙은 안 바꿉니다</h3>
 *
 * <p>마감이 지나면 표와 새 후보를 안 받을 뿐입니다. 득표가 많은 곳을 정해진
 * 것으로 올리지 않습니다 — 모두 좋다고 한 곳만 정해진 것입니다(vote 화면의
 * 「줄 세우는 순서」 문서).
 */

/** 머리 아래 한 줄. 마감이 없으면 「마감 정하기」 링크입니다. */
export function DeadlineLine({
  until,
  closed,
  onEdit,
}: {
  until: string | null;
  closed: boolean;
  onEdit: () => void;
}) {
  const text = !until
    ? '마감을 정하면 언제까지 골라야 하는지 모두 알아요 ›'
    : closed
      ? `${formatDay(until)}에 마감됐어요. 정해진 곳을 일정으로 옮겨요 · 고치기 ›`
      : `${formatDay(until)}까지 골라요 · ${leftOf(until)} · 고치기 ›`;
  return (
    <Press onPress={onEdit} scale={1} accessibilityLabel={until ? '투표 마감 고치기' : '투표 마감 정하기'}>
      <Caption tone={closed ? 'danger' : until ? 'secondary' : 'brand'} strong={!!until}>
        {text}
      </Caption>
    </Press>
  );
}

/** 「오늘 마감」 · 「내일 마감」 · 「3일 남음」 */
function leftOf(until: string) {
  const days = daysBetween(todayIso(), until);
  return days === 0 ? '오늘 마감' : days === 1 ? '내일 마감' : `${days}일 남음`;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 마감을 고르는 판.
 *
 * <p>날짜를 처음부터 치게 하지 않고 흔한 셋을 칩으로 둡니다 — 내일, 사흘 뒤,
 * 출발 전날. 출발 전날이 가장 흔한 답인데, 그날을 사람이 셈하게 두면 날짜
 * 고르기를 한 번 더 엽니다.
 */
export function DeadlineSheet({
  visible,
  tripId,
  until,
  startIso,
  onClose,
  onDone,
}: {
  visible: boolean;
  tripId: string;
  until: string | null;
  /** 첫날. 「출발 전날」 칩을 셈합니다. 날짜 없는 여행이면 비어 있습니다. */
  startIso: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = todayIso();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText(until ?? '');
      setFailed(null);
    }
  }, [visible, until]);

  const eve = startIso ? addDays(startIso, -1) : null;
  /* 이미 떠났거나 내일 떠나는 여행이면 「출발 전날」이 오늘보다 앞입니다. */
  const picks = [
    { label: '오늘', iso: today },
    { label: '내일', iso: addDays(today, 1) },
    { label: '사흘 뒤', iso: addDays(today, 3) },
    ...(eve && eve >= today ? [{ label: '출발 전날', iso: eve }] : []),
  ];

  const clean = text.trim();
  const shaped = /^\d{4}-\d{2}-\d{2}$/.test(clean);
  const bad = clean !== '' && (!shaped || clean < today);

  async function save(next: string | null) {
    setBusy(true);
    setFailed(null);
    try {
      await api.put(`/api/trips/${encodeURIComponent(tripId)}/vote-until`, { date: next ?? '' });
      onDone();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="투표 마감"
      onClose={onClose}
      footer={
        <Row gap={Spacing.s2}>
          {until ? (
            <View style={styles.grow}>
              <Button label="마감 없애기" variant="secondary" onPress={() => save(null)} disabled={busy} />
            </View>
          ) : null}
          <View style={styles.grow}>
            <Button label="저장" onPress={() => save(clean)} busy={busy} disabled={bad || clean === ''} />
          </View>
        </Row>
      }>
      <Caption tone="secondary">
        그날까지 표를 받아요. 지나면 표와 새 후보를 안 받고, 모두 좋다고 한 곳을 일정으로 옮기는 일만 남아요.
        같이 가는 사람 모두에게 보여요.
      </Caption>
      {failed ? <ErrorNote message={failed} /> : null}
      <Row gap={Spacing.s2} style={styles.wrap}>
        {picks.map((p) => (
          <Chip key={p.label} label={p.label} selected={clean === p.iso} onPress={() => setText(p.iso)} />
        ))}
      </Row>
      <Field
        label="날짜"
        value={text}
        onChangeText={setText}
        placeholder="2026-10-07"
        hint={shaped && !bad ? `${formatDay(clean)}까지` : undefined}
        error={bad ? '오늘이나 그 뒤 날짜를 YYYY-MM-DD 로 적어 주세요' : undefined}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexWrap: 'wrap',
  },
  grow: {
    flex: 1,
  },
});
