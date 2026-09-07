import { useEffect, useState } from 'react';

import { api, ApiError } from '@/api/client';
import type { Trip } from '@/api/types';
import { BottomSheet, Button, Caption, ErrorNote, Field, Stepper } from '@/ui';
import { DateField } from '@/ui/date-field';

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
 */
export function TripForm({
  visible,
  onCreated,
  onCancel,
}: {
  visible: boolean;
  onCreated: (trip: Trip) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [startIso, setStartIso] = useState(today());
  const [nights, setNights] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  }, [visible]);

  async function submit() {
    if (busy) {
      return;
    }
    if (!title.trim()) {
      setError('여행 이름을 넣어 주세요.');
      return;
    }
    if (!startIso) {
      setError('시작일을 골라 주세요.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ trip: Trip }>('/api/trips', {
        title: title.trim(),
        startIso,
        nights,
      });
      onCreated(res.trip);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '만들지 못했습니다.');
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
        hint="0이면 당일치기입니다."
      />

      <Caption tone="secondary">{summary(startIso, nights)}</Caption>

      {error ? <ErrorNote message={error} /> : null}
    </BottomSheet>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toIso(new Date());

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 며칠부터 며칠까지인지 미리 보여 줍니다. 숙박 수만으로는 잘 안 그려집니다. */
function summary(startIso: string, nights: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso);
  if (!m) {
    return '';
  }
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const end = new Date(start);
  end.setDate(end.getDate() + nights);

  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
  const days = nights + 1;
  return nights === 0
    ? `${fmt(start)} 당일치기`
    : `${fmt(start)} ~ ${fmt(end)} · ${nights}박 ${days}일`;
}
