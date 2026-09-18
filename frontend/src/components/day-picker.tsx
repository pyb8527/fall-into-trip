import { useEffect, useState } from 'react';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { BottomSheet, Button, Caption, ErrorNote, ListRow, SearchField, Split, Subtitle } from '@/ui';

/**
 * 고른 것을 어느 날에 넣을지 묻는 판.
 *
 * <h3>두 벌이 있었습니다</h3>
 *
 * <p>보석함에서 꺼낼 때와 투표장에서 정해진 것을 옮길 때, 같은 판을 각각
 * 만들고 있었습니다. 글자도 거의 같았습니다 — "고른 N곳이 그 날 맨 뒤에
 * 붙습니다".
 *
 * <p>다른 것은 둘뿐이었습니다. 어디로 보내는지({@code onPour})와, <b>여행을
 * 먼저 골라야 하는지</b>. 투표장은 이미 한 여행 안에 서 있어서 날짜만
 * 고르면 되고, 보석함은 여행에 매이지 않은 자리라 여행부터 고릅니다.
 *
 * <p>그 둘을 밖에서 받습니다. {@code days} 를 주면 날짜만 고르고, 안 주면
 * 여행부터 고릅니다.
 *
 * <h3>왜 한 번에 다 안 늘어놓는가</h3>
 *
 * <p>여행 셋에 날짜가 각각 나흘이면 열두 줄입니다. 여행을 먼저 고르면
 * 나흘만 남습니다. 게다가 "어느 여행" 과 "며칠" 은 사람이 실제로 나눠서
 * 떠올리는 물음입니다.
 */
export function DayPicker({
  visible,
  title,
  note,
  days,
  onPour,
  onDone,
  onCancel,
}: {
  visible: boolean;
  /** 여행까지 골라야 할 때 첫 화면에 다는 제목. 날짜만 고를 때는 안 씁니다. */
  title?: string;
  /** 넣으면 무슨 일이 일어나는지. 부르는 자리가 압니다. */
  note: string;
  /**
   * 고를 수 있는 날짜들. 주면 날짜만 고릅니다.
   *
   * <p>안 주면 여행부터 고르고, 고른 여행의 날짜를 그때 불러옵니다.
   */
  days?: TripDetail['days'];
  /** 실제로 넣는 일. 어디로 보낼지는 부르는 자리가 정합니다. */
  onPour: (dayId: string) => Promise<void>;
  /** 다 넣은 뒤. 여행을 골랐으면 그 번호가 옵니다. */
  onDone: (tripId: string | null) => void;
  onCancel: () => void;
}) {
  const picksTrip = days === undefined;
  const [trip, setTrip] = useState<TripSummary | null>(null);
  /** 여행 고르는 칸에서 이름으로 거르기. */
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
    판은 닫혀도 화면에서 사라지지 않습니다 — 닫히는 동안 아래로 미끄러져
    내려가야 하기 때문입니다. 그래서 골라 둔 여행이 그대로 남아, 다음에
    열면 지난번에 고른 여행의 날짜부터 보입니다.
  */
  useEffect(() => {
    if (visible) {
      setTrip(null);
      setQ('');
      setFailed(null);
    }
  }, [visible]);

  const { data: trips } = useAsync<{ trips: TripSummary[] }>(
    (signal) =>
      visible && picksTrip ? api.get('/api/trips', signal) : Promise.resolve({ trips: [] }),
    [visible, picksTrip],
  );
  const { data: detail } = useAsync<TripDetail | null>(
    (signal) =>
      trip ? api.get(`/api/trip?trip=${encodeURIComponent(trip.id)}`, signal) : Promise.resolve(null),
    [trip],
  );

  const shown = days ?? detail?.days ?? null;

  async function pour(dayId: string) {
    if (busy) {
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      await onPour(dayId);
      onDone(trip?.id ?? null);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={picksTrip && trip === null ? (title ?? '어느 여행에 넣을까요?') : '어느 날에 넣을까요?'}
      onClose={() => {
        setTrip(null);
        onCancel();
      }}>
      <Caption tone="secondary">{note}</Caption>

      {failed ? <ErrorNote message={failed} /> : null}

      {picksTrip && trip === null ? (
        <>
          {/* 여행이 여럿이면 여기서도 훑어 내려가야 합니다. 다섯을 넘을 때만 냅니다. */}
          {(trips?.trips.length ?? 0) > 5 ? (
            <SearchField
              label="여행 찾기"
              value={q}
              onChangeText={setQ}
              placeholder="오사카, 제주"
            />
          ) : null}
          {(trips?.trips ?? [])
            .filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase()))
            .map((t) => (
              <ListRow
                key={t.id}
                title={t.title}
                subtitle={`${t.dayCount}일 · 장소 ${t.placeCount}곳`}
                onPress={() => setTrip(t)}
              />
            ))}
        </>
      ) : null}

      {shown !== null ? (
        <>
          {trip ? (
            <Split>
              <Subtitle>{trip.title}</Subtitle>
              <Button label="다른 여행" variant="ghost" compact onPress={() => setTrip(null)} />
            </Split>
          ) : null}
          {shown.map((day) => (
            <ListRow
              key={day.id}
              title={day.date || day.label}
              subtitle={`장소 ${day.places.length}곳`}
              onPress={() => pour(day.id)}
            />
          ))}
        </>
      ) : null}
    </BottomSheet>
  );
}
