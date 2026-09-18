import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { SavedPlace } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { SavedRow } from '@/components/saved-row';
import { SORT_GIVEN, SORT_NAME, SortBar, type SortBy } from '@/components/sort-bar';
import { Spacing } from '@/constants/theme';
import { kindsIn, siftSaved } from '@/lib/saved';
import {
  BottomSheet,
  Button,
  Caption,
  Chip,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Row,
} from '@/ui';

/** 한 번에 넣을 수 있는 개수. 서버가 재는 것과 같은 값입니다. */
const AT_ONCE = 20;

/**
 * 보석함에서 꺼내 이 날에 넣는 판.
 *
 * <h3>왜 일정 쪽에도 있어야 하는가</h3>
 *
 * <p>보석함에서 일정으로 가는 길은 있었습니다. 골라 두고 "일정에 넣기" 를
 * 누르면 여행을 고르고 날짜를 고릅니다. 그런데 <b>사람이 일정을 짜는 것은
 * 일정 화면에서</b>입니다. 그 자리에서 "여기 뭐 넣지" 가 되었을 때, 이미
 * 답을 적어 둔 보석함에 가려면 화면을 떠나 탭을 옮기고, 고르고, 다시 여행과
 * 날짜를 되짚어 골라 돌아와야 했습니다. 되짚는 세 걸음이 전부 <b>방금
 * 떠나온 자리</b>를 다시 말하는 일입니다.
 *
 * <p>여기서 열면 어느 날인지는 이미 정해져 있습니다. 고르고 넣으면 끝입니다.
 *
 * <h3>찾을 수 있어야 합니다</h3>
 *
 * <p>보석함은 쌓이는 곳입니다. 스무 곳이 넘으면 훑어 내려가는 것으로는 못
 * 찾고, 넣으려고 들어온 사람은 무엇을 찾는지 이미 알고 있습니다. 이름으로도
 * 메모로도 갈래로도 찾습니다 — 보석함 화면이 쓰는 것과 같은 규칙입니다
 * ({@code lib/saved.ts}).
 */
export function SavedPicker({
  visible,
  dayId,
  dayLabel,
  onDone,
  onCancel,
}: {
  visible: boolean;
  dayId: string;
  /** 어느 날에 넣는지. 판 제목에 적습니다. */
  dayLabel: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [by, setBy] = useState<SortBy>('given');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync<{ places: SavedPlace[] }>(
    (signal) => (visible ? api.get('/api/saved', signal) : Promise.resolve({ places: [] })),
    [visible],
  );

  /*
    판은 닫혀도 화면에서 사라지지 않습니다 — 닫히는 동안 아래로 미끄러져
    내려가야 하기 때문입니다. 그래서 골라 둔 것이 그대로 남아, 다음에
    열면 지난번에 고른 것이 켜져 있습니다.
  */
  useEffect(() => {
    if (visible) {
      setPicked(new Set());
      setQ('');
      setKind(null);
      setFailed(null);
    }
  }, [visible]);

  const all = useMemo(() => data?.places ?? [], [data]);
  const kinds = useMemo(() => kindsIn(all), [all]);
  const shown = useMemo(() => siftSaved(all, { q, kind, by }), [all, q, kind, by]);

  function toggle(id: string) {
    setFailed(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size >= AT_ONCE) {
        setFailed(`한 번에 ${AT_ONCE}곳까지 넣을 수 있습니다.`);
        return prev;
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function pour() {
    if (busy || picked.size === 0) {
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      await api.post(`/api/days/${dayId}/places/from-saved`, { savedIds: [...picked] });
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
      title={`${dayLabel}에 꺼내 넣기`}
      onClose={onCancel}
      footer={
        picked.size > 0 ? (
          <Button label={`${picked.size}곳 넣기`} onPress={pour} busy={busy} />
        ) : undefined
      }>
      <Caption tone="secondary">
        고른 곳이 이 날 맨 뒤에 붙습니다. 보석함에서는 안 없어집니다 — 같은 곳을 여러
        여행에 넣을 수 있어야 합니다.
      </Caption>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && all.length === 0 ? (
        <Empty message="보석함이 비어 있습니다. 장소를 찾다가 별을 누르면 여기 쌓이고, 그다음부터 이 자리에서 꺼내 쓸 수 있습니다." />
      ) : null}

      {/* 몇 개 안 될 때는 찾을 것이 없습니다. 칸만 자리를 차지합니다. */}
      {all.length > 4 ? (
        <Field
          label="보석함에서 찾기"
          value={q}
          onChangeText={setQ}
          placeholder="국밥, 온천, 도톤보리"
          returnKeyType="search"
          action={{ icon: 'search', label: '보석함에서 찾기', onPress: () => {} }}
        />
      ) : null}

      {/* 갈래가 둘 이상일 때만 냅니다. 하나뿐이면 누를 것이 없습니다. */}
      {kinds.length > 1 ? (
        <Row gap={Spacing.xs} style={styles.chips}>
          <Chip label="전체" selected={kind === null} onPress={() => setKind(null)} />
          {kinds.map((k) => (
            <Chip
              key={k.key}
              label={`${k.emoji} ${k.label}`}
              selected={kind === k.key}
              onPress={() => setKind(kind === k.key ? null : k.key)}
            />
          ))}
        </Row>
      ) : null}

      {/* 거르는 것은 왼쪽에서 흘러가고, 세우는 것은 오른쪽 끝에 붙습니다.
          둘 다 같은 모양 칩이라 나란히 두면 경계가 안 보입니다 — 보석함
          화면도 같은 방식으로 섭니다. */}
      {all.length > 2 ? (
        <Row style={styles.sort}>
          <SortBar
            options={[{ ...SORT_GIVEN, label: '담은 순' }, SORT_NAME]}
            value={by}
            onChange={setBy}
          />
        </Row>
      ) : null}

      {data && all.length > 0 && shown.length === 0 ? (
        <Empty
          message={q.trim() ? `"${q.trim()}" 로는 찾은 것이 없습니다.` : '이 갈래에는 아직 없습니다.'}
        />
      ) : null}

      <View style={styles.list}>
        {shown.map((place) => (
          <SavedRow
            key={place.id}
            place={place}
            selected={picked.has(place.id)}
            onToggle={() => toggle(place.id)}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexWrap: 'wrap',
  },
  sort: {
    justifyContent: 'flex-end',
  },
  list: {
    gap: Spacing.xs,
  },
});
