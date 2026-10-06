import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Move, Place } from '@/api/types';
import { Colors, Spacing } from '@/constants/theme';
import {
  BottomSheet,
  Button,
  Caption,
  Chip,
  ErrorNote,
  Field,
  Icon,
  type IconName,
  Press,
  Row,
} from '@/ui';

/**
 * 다음 장소까지 어떻게 가는지 — 사람이 적어 두는 이동 한 토막.
 *
 * <h3>왜 있는가</h3>
 *
 * <p>운영 서버의 도쿄 3박 4일 63곳 가운데 서른 남짓이 역이었습니다. 「닛포리 역」을
 * 장소로 넣고 메모에 「야마노테선 탑승 약 10분 소요」를 적는 식입니다. 이동을
 * 적을 칸이 없어서 역을 장소로 넣고 그 메모 칸을 빌린 것입니다.
 *
 * <p>칸({@code place.move})은 처음부터 서버에 있었는데 그리는 화면이 없었습니다.
 * 아래 {@code GapBlock} 과 다릅니다 — 그쪽은 구글이 셈한 「몇 분 걸린다」이고,
 * 이쪽은 <b>사람이 정한 길</b>입니다(어느 노선, 몇 번 출구, 스이카 충전).
 */
export const LEG_MODES: { key: string; label: string; icon: IconName }[] = [
  { key: 'transit', label: '전철', icon: 'train' },
  { key: 'bus', label: '버스', icon: 'bus' },
  { key: 'walk', label: '걷기', icon: 'walk' },
  { key: 'taxi', label: '택시', icon: 'car' },
  { key: 'car', label: '차', icon: 'car' },
  { key: 'flight', label: '비행기', icon: 'airplane' },
  { key: 'ferry', label: '배', icon: 'boat' },
];

/** 적어 둔 것이 있는지. 넷 다 비었으면 없는 것입니다. */
export function hasLeg(move: Move | null | undefined): move is Move {
  return !!move && !!(move.mode || move.min || move.via || move.cost);
}

/** 「전철 · 야마노테선 · 10분 · 170엔」 */
export function legText(move: Move): string {
  const mode = LEG_MODES.find((m) => m.key === move.mode);
  return [mode?.label, move.via, move.min ? minutes(move.min) : null, move.cost]
    .filter(Boolean)
    .join(' · ');
}

function minutes(min: number) {
  if (min < 60) {
    return `${min}분`;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 장소 줄 아래에 서는 한 줄. 누르면 고칩니다.
 *
 * <p>적은 것이 없으면 아무것도 안 그립니다 — 스무 곳짜리 날에 「이동 적기」가
 * 스무 줄 서면 일정보다 그 줄이 먼저 보입니다. 처음 적는 길은 장소의 ⋯ 판에
 * 있습니다.
 */
export function LegLine({ move, onPress }: { move: Move | null | undefined; onPress?: () => void }) {
  if (!hasLeg(move)) {
    return null;
  }
  const mode = LEG_MODES.find((m) => m.key === move.mode);
  return (
    <Press
      onPress={onPress}
      disabled={!onPress}
      scale={1}
      accessibilityLabel={`다음 장소까지 ${legText(move)}`}
      style={styles.line}>
      <Icon name={mode?.icon ?? 'navigation'} size={14} tone="secondary" />
      <View style={styles.lineText}>
        <Caption tone="secondary" numberOfLines={2}>
          {legText(move)}
        </Caption>
      </View>
    </Press>
  );
}

/**
 * 이동을 적는 판.
 *
 * <p>수단 · 가는 길 · 걸리는 시간 · 요금. 다 안 적어도 됩니다 — 「야마노테선」
 * 한 마디면 충분한 사람이 많습니다. 다 지우고 저장하면 이동이 지워집니다.
 */
export function LegSheet({
  place,
  nextName,
  onClose,
  onDone,
}: {
  /** 이 장소에서 출발합니다. null 이면 판이 닫혀 있습니다. */
  place: Place | null;
  /** 도착할 곳. 판 머리에 「→ 칸다역」으로 적습니다. 마지막 곳이면 없습니다. */
  nextName?: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<string | null>(null);
  const [via, setVia] = useState('');
  const [min, setMin] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 판을 열 때마다 그 장소에 적힌 것으로 채웁니다. */
  useEffect(() => {
    const m = place?.move ?? null;
    setMode(m?.mode ?? null);
    setVia(m?.via ?? '');
    setMin(m?.min ? String(m.min) : '');
    setCost(m?.cost ?? '');
    setFailed(null);
  }, [place]);

  const minNumber = min.trim() === '' ? null : Number(min.trim());
  const badMin = minNumber != null && (!Number.isInteger(minNumber) || minNumber < 0 || minNumber > 1440);

  async function save(clear = false) {
    if (!place) {
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      const body = clear
        ? ''
        : JSON.stringify({ mode, via: via.trim(), min: minNumber ?? undefined, cost: cost.trim() });
      await api.patch(`/api/places/${place.id}`, { move: body });
      onDone();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  const had = hasLeg(place?.move);

  return (
    <BottomSheet
      visible={place != null}
      title={nextName ? `${place?.name ?? ''} → ${nextName}` : '다음 장소까지'}
      onClose={onClose}
      footer={
        <Row gap={Spacing.s2}>
          {had ? (
            <View style={styles.grow}>
              <Button label="지우기" variant="secondary" onPress={() => save(true)} disabled={busy} />
            </View>
          ) : null}
          <View style={styles.grow}>
            <Button label="저장" onPress={() => save()} busy={busy} disabled={badMin} />
          </View>
        </Row>
      }>
      <Caption tone="secondary">
        역을 장소로 넣지 않아도 돼요. 어떻게 가는지 여기 적어 두면 장소 아래에 한 줄로 보여요.
      </Caption>
      {failed ? <ErrorNote message={failed} /> : null}

      <Row gap={Spacing.s2} style={styles.wrap}>
        {LEG_MODES.map((m) => (
          <Chip
            key={m.key}
            label={m.label}
            selected={mode === m.key}
            onPress={() => setMode(mode === m.key ? null : m.key)}
          />
        ))}
      </Row>
      <Field
        label="가는 길"
        value={via}
        onChangeText={setVia}
        placeholder="야마노테선 → 신주쿠 하차, 3번 출구"
        limit={80}
        maxLength={80}
      />
      <Row gap={Spacing.s2}>
        <View style={styles.grow}>
          <Field
            label="걸리는 시간"
            value={min}
            onChangeText={setMin}
            placeholder="10"
            unit="분"
            keyboardType="number-pad"
            error={badMin ? '0에서 1440 사이 숫자로 적어 주세요' : undefined}
          />
        </View>
        <View style={styles.grow}>
          <Field label="요금" value={cost} onChangeText={setCost} placeholder="170엔" maxLength={40} />
        </View>
      </Row>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s1,
    paddingVertical: Spacing.s1,
    paddingHorizontal: Spacing.s2,
    marginTop: Spacing.s1,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: Colors.fill,
  },
  lineText: {
    flexShrink: 1,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  grow: {
    flex: 1,
  },
});
