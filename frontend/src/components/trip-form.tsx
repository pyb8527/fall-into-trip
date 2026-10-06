import { useEffect, useState } from 'react';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Group, Trip } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Spacing } from '@/constants/theme';
import { BottomSheet, Button, Caption, Chip, ErrorNote, Field, Row, Stepper } from '@/ui';
import { DateField } from '@/ui/date-field';
import { formatDay } from '@/lib/countdown';

/** 서버의 CreateTripRequest 가 받는 상한. */
const MAX_NIGHTS = 30;

/**
 * 여행을 새로 만드는 판.
 *
 * <p>날짜는 기기가 가진 달력으로 고릅니다. 손으로 적게 두면 2026-10-08 인지
 * 26.10.8 인지 매번 헷갈리고, 폰에서는 숫자 자판을 부르는 것부터 번거롭습니다.
 *
 * <p>숙박도 눌러서 고릅니다. 직접 치면 "3박" 이라고 적는 사람과 "3" 이라고
 * 적는 사람이 갈립니다.
 *
 * <h3>혼자인지, 어느 모임인지</h3>
 *
 * <p>여행을 모임 것으로 만들면 모임 사람 모두에게 보이고 모두가 고칠 수
 * 있습니다. 그래서 만들 때 물어야 합니다 — 나중에 옮기는 길도 있지만, 혼자
 * 짜 놓고 나서 옮기는 것은 「언제 보여 주기 시작했는지」 가 흐려집니다.
 *
 * <p>든 모임이 없으면 아무것도 묻지 않습니다. 고를 것이 하나뿐인 물음은
 * 묻는 일만 남습니다.
 */
export function TripForm({
  visible,
  /** 모임 화면에서 열었으면 그 모임. 그때는 「어느 모임?」 을 안 묻습니다. */
  groupId,
  onCreated,
  onCancel,
}: {
  visible: boolean;
  groupId?: string;
  onCreated: (trip: Trip) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [startIso, setStartIso] = useState(today());
  const [nights, setNights] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 고른 모임. 비어 있으면 혼자 여행입니다. */
  const [pick, setPick] = useState<string | null>(null);

  /* 열 때 부릅니다. 이 판은 여행 목록 화면에 늘 얹혀 있어서, 그냥 부르면
     목록을 열 때마다 모임을 한 번씩 묻습니다. 모임 화면에서 열었으면 물을
     것도 없습니다. */
  const { data: groupData } = useAsync<{ groups: Group[] }>(
    (signal) =>
      visible && groupId == null
        ? api.get('/api/groups', signal)
        : Promise.resolve({ groups: [] }),
    [visible, groupId],
  );
  const groups = groupData?.groups ?? [];

  /* 판은 닫혀도 화면에 남아 있어(닫히는 동안 미끄러져 내려가야 합니다)
     처음 잡은 값이 다음에 열 때도 그대로입니다. 열릴 때마다 비웁니다. */
  useEffect(() => {
    if (!visible) {
      return;
    }
    setTitle('');
    setStartIso(today());
    setNights(2);
    setError(null);
    setBusy(false);
    setPick(null);
  }, [visible]);

  async function submit() {
    if (busy) {
      return;
    }
    if (!title.trim()) {
      setError('이름부터 지어 주세요. 나중에 바꿔도 돼요.');
      return;
    }
    if (!startIso) {
      setError('언제 떠나는지 골라 주세요.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ trip: Trip }>('/api/trips', {
        title: title.trim(),
        startIso,
        nights,
        groupId: groupId ?? pick,
      });
      onCreated(res.trip);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="새 여행"
      onClose={onCancel}
      footer={<Button label="만들기" onPress={submit} busy={busy} />}>
      <Field
        label="이름"
        value={title}
        onChangeText={setTitle}
        placeholder="가을 오사카"
        maxLength={120}
      />

      <DateField label="시작일" value={startIso} onChange={setStartIso} />

      <Stepper
        label="숙박"
        value={nights}
        onChange={setNights}
        min={0}
        max={MAX_NIGHTS}
        unit="박"
        hint="0이면 당일치기예요."
      />

      <Caption tone="secondary">{summary(startIso, nights)}</Caption>

      {groupId == null && groups.length > 0 ? (
        <>
          <Caption tone="secondary">누구와 가요?</Caption>
          <Row gap={Spacing.xs} style={{ flexWrap: 'wrap' }}>
            <Chip label="혼자" selected={pick === null} onPress={() => setPick(null)} />
            {groups.map((g) => (
              <Chip
                key={g.id}
                label={`${g.emoji ?? '🧳'} ${g.name}`}
                selected={pick === g.id}
                onPress={() => setPick(g.id)}
              />
            ))}
          </Row>
          <Caption tone="secondary">
            {pick === null
              ? '나만 볼 수 있어요. 나중에 모임으로 옮길 수 있어요.'
              : '이 모임 사람 모두에게 보이고, 모두가 일정을 고칠 수 있어요.'}
          </Caption>
        </>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}
    </BottomSheet>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toIso(new Date());

/** 며칠부터 며칠까지인지 미리 보여 줍니다. 숙박 수만으로는 잘 안 그려집니다. */
function summary(startIso: string, nights: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso);
  if (!m) {
    return '';
  }
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const end = new Date(start);
  end.setDate(end.getDate() + nights);

  /* 다른 화면과 같은 모양으로(10.08(목)). 여기만 「10.8 (목)」이었습니다. */
  const fmt = (d: Date) => formatDay(toIso(d));
  const days = nights + 1;
  return nights === 0
    ? `${fmt(start)} 당일치기`
    : `${fmt(start)} ~ ${fmt(end)} · ${nights}박 ${days}일`;
}
