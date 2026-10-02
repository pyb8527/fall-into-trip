import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { DateChoice, DateOption, DatePoll, Going } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatNights, formatSpan, todayIso } from '@/lib/countdown';
import {
  Badge,
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ConfirmDialog,
  ErrorNote,
  Loading,
  Row,
  Split,
  Subtitle,
} from '@/ui';
import { DateField } from '@/ui/date-field';

/**
 * 언제 갈까 — 날짜 후보에 답하고, 만든 사람이 정합니다.
 *
 * <h3>새 화면을 두지 않습니다</h3>
 *
 * <p>여행 화면의 「이 여행 다루기」와 모임 달력의 빗금 줄이 이 판을 엽니다.
 * 투표 화면을 따로 두면 「날짜 정하러 가는 길」을 또 하나 외워야 합니다.
 *
 * <h3>누가 아직 안 답했는지는 안 적습니다</h3>
 *
 * <p>답한 사람만 이름이 붙습니다. 안 답한 사람을 늘어놓으면 그 줄이
 * 독촉이 됩니다(눈치). 몇 명이 답했는지만 셉니다.
 */
export function DatePollSheet({
  visible,
  tripId,
  onClose,
  onConfirmed,
}: {
  visible: boolean;
  tripId: string;
  onClose: () => void;
  /** 날이 정해지면 여행의 날짜가 바뀝니다. 부른 화면이 다시 받게 합니다. */
  onConfirmed: () => void;
}) {
  return (
    <BottomSheet visible={visible} title="언제 갈까" onClose={onClose}>
      {visible ? <Inner tripId={tripId} onConfirmed={onConfirmed} /> : null}
    </BottomSheet>
  );
}

const CHOICES: { value: DateChoice; label: string }[] = [
  { value: 'YES', label: '돼요' },
  { value: 'IF_NEED', label: '어쩔 수 없으면' },
  { value: 'NO', label: '안 돼요' },
];

function Inner({ tripId, onConfirmed }: { tripId: string; onConfirmed: () => void }) {
  const { user } = useAuth();
  const path = `/api/trips/${encodeURIComponent(tripId)}`;
  const { data, error, loading, reload } = useAsync<DatePoll>(
    (signal) => api.get(`${path}/dates`, signal),
    [tripId],
  );
  /* 확정된 날에 「안 돼요」였으면 참석 응답을 물어야 합니다. 지금 내 답을 봅니다. */
  const going = useAsync<{ going: Going[] }>(
    (signal) => api.get(`${path}/going`, signal),
    [tripId],
  );

  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState<DateOption | null>(null);

  async function run(work: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setFailed(null);
    try {
      await work();
      reload();
      after?.();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  const options = data?.options ?? [];
  const settled = options.find((o) => o.confirmed) ?? null;
  const myGoing = going.data?.going.find((g) => g.id === user?.id)?.answer ?? 'MAYBE';
  /*
    정해진 날에 「안 돼요」라고 했던 사람에게만 묻습니다.

    <p>앱이 대신 「못 가요」로 바꾸지 않습니다 — 그날 어떻게든 시간을 낼
    수도 있습니다. 제 참석은 제가 정합니다.
  */
  const askAway = settled != null && settled.mine === 'NO' && myGoing !== 'NOT_GOING';

  return (
    <>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {askAway ? (
        <View style={styles.ask}>
          <Body small>
            {formatSpan(settled.startIso, settled.endIso)}로 정해졌어요. 이 날은 안 된다고
            하셨는데, 「못 가요」로 바꿀까요?
          </Body>
          <Button
            label="못 가요로 바꾸기"
            variant="secondary"
            compact
            busy={busy}
            onPress={() =>
              run(
                () => api.put(`${path}/going`, { answer: 'NOT_GOING' }),
                () => going.reload(),
              )
            }
          />
        </View>
      ) : null}

      {data && options.length === 0 ? (
        <Caption tone="secondary">
          아직 올라온 날짜가 없어요. 되는 날을 하나 올려 보세요 — 모두 되는 날이 위로 올라와요.
        </Caption>
      ) : null}

      {options.map((o) => (
        <View key={o.id} style={[styles.card, o.confirmed ? styles.chosen : null]}>
          <Split align="center">
            <Body strong>
              {formatSpan(o.startIso, o.endIso)} · {formatNights(o.nights + 1)}
            </Body>
            {o.confirmed ? (
              <Badge tone="brand" solid label="정해짐" />
            ) : o.tier === 1 ? (
              <Badge tone="brand" label="모두 돼요" />
            ) : o.tier === 2 ? (
              <Badge tone="secondary" label="안 돼요 없음" />
            ) : null}
          </Split>

          <Caption tone="secondary">
            {data ? `${data.people}명 중 ${o.answered}명 답함` : ''}
            {o.answers.length > 0
              ? ' · ' +
                o.answers
                  .map((a) => `${a.name} ${CHOICES.find((c) => c.value === a.answer)?.label}`)
                  .join(', ')
              : ''}
          </Caption>

          <Row gap={Spacing.s2} style={styles.wrap}>
            {CHOICES.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                selected={o.mine === c.value}
                onPress={() =>
                  run(() =>
                    api.put(`${path}/dates/${o.id}/answer`, {
                      /* 고른 것을 또 누르면 답을 거둡니다 — 잘못 누른 것을
                         「안 답함」으로 되돌릴 길입니다. */
                      answer: o.mine === c.value ? null : c.value,
                    }),
                  )
                }
              />
            ))}
          </Row>

          <Row gap={Spacing.s2}>
            {data?.amOwner && !o.confirmed ? (
              <Button
                label="이 날로 정하기"
                compact
                busy={busy}
                onPress={() => setSettling(o)}
              />
            ) : null}
            {data?.amOwner || o.createdBy === user?.id ? (
              <Button
                label="내리기"
                variant="ghost"
                compact
                busy={busy}
                onPress={() => run(() => api.delete(`${path}/dates/${o.id}`))}
              />
            ) : null}
          </Row>
        </View>
      ))}

      <Band />
      <Propose busy={busy} onPropose={(startIso, nights) => run(() => api.post(`${path}/dates`, { startIso, nights }))} />

      <ConfirmDialog
        visible={settling != null}
        title="이 날로 정할까요?"
        message={
          settling
            ? `${formatSpan(settling.startIso, settling.endIso)}로 여행 날짜를 옮겨요. 날마다 넣어 둔 장소는 그 차례대로 따라가요.`
            : ''
        }
        confirmLabel="정하기"
        busy={busy}
        onCancel={() => setSettling(null)}
        onConfirm={() => {
          const o = settling;
          setSettling(null);
          if (o) {
            run(() => api.post(`${path}/dates/${o.id}/confirm`), onConfirmed);
          }
        }}
      />
    </>
  );
}

/** 0박(당일)부터 6박까지. 그보다 긴 여행은 드물고, 칩이 두 줄로 넘칩니다. */
const NIGHTS = [0, 1, 2, 3, 4, 5, 6];

function Propose({
  busy,
  onPropose,
}: {
  busy: boolean;
  onPropose: (startIso: string, nights: number) => void;
}) {
  const [start, setStart] = useState(todayIso());
  const [nights, setNights] = useState(1);

  return (
    <View style={styles.propose}>
      <Subtitle>날짜 올리기</Subtitle>
      <DateField label="떠나는 날" value={start} onChange={setStart} min={todayIso()} />
      <Row gap={Spacing.s2} style={styles.wrap}>
        {NIGHTS.map((n) => (
          <Chip
            key={n}
            label={n === 0 ? '당일' : `${n}박`}
            selected={nights === n}
            onPress={() => setNights(n)}
          />
        ))}
      </Row>
      <Button
        label="이 날 올리기"
        variant="secondary"
        busy={busy}
        onPress={() => onPropose(start, nights)}
      />
      <Caption tone="muted">올린 날은 내가 「돼요」라고 한 것으로 들어가요.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.s2,
    paddingVertical: Spacing.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  /* 정해진 날은 옅은 바탕으로 한 번 더 가릅니다. 배지만으로는 목록을
     훑을 때 안 걸립니다. */
  chosen: {
    backgroundColor: Colors.accentSoft,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.s3,
    borderBottomWidth: 0,
  },
  ask: {
    gap: Spacing.s2,
    padding: Spacing.s3,
    borderRadius: Radius.md,
    backgroundColor: Colors.fill,
  },
  propose: {
    gap: Spacing.s2,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
