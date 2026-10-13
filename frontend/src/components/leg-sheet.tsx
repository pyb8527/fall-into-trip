import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Move, Place, Station } from '@/api/types';
import { PlaceSearch } from '@/components/place-search';
import { placed, STATION_MODES } from '@/lib/leg-path';
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
 * 구글 지도로 넘기는 길찾기 링크와 다릅니다 — 그쪽은 「몇 분 걸린다」를 구글
 * 지도가 세고, 이쪽은 <b>사람이 정한 길</b>입니다(어느 노선, 몇 번 출구, 스이카 충전).
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

/** 적어 둔 것이 있는지. 다 비었으면 없는 것입니다. */
export function hasLeg(move: Move | null | undefined): move is Move {
  return !!move && !!(move.mode || move.min || move.via || move.cost || move.from || move.to);
}

/** 「신주쿠역 → 시부야역」. 하나만 적었으면 「신주쿠역에서」 · 「시부야역까지」. */
function stationsText(move: Move): string | null {
  const from = move.from?.name;
  const to = move.to?.name;
  if (from && to) {
    return `${from} → ${to}`;
  }
  if (from) {
    return `${from}에서`;
  }
  return to ? `${to}까지` : null;
}

/** 「전철 · 신주쿠역 → 시부야역 · 야마노테선 · 10분 · 170엔」 */
export function legText(move: Move): string {
  const mode = LEG_MODES.find((m) => m.key === move.mode);
  return [mode?.label, stationsText(move), move.via, move.min ? minutes(move.min) : null, move.cost]
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
  const [fromSt, setFromSt] = useState<Station | null>(null);
  const [toSt, setToSt] = useState<Station | null>(null);
  /* 역을 찾는 중인지 — 찾는 동안은 판 안이 장소 검색으로 바뀝니다. 판을 하나 더
     띄우지 않습니다. 판 위에 판이 서면 어느 것을 닫아야 돌아오는지 헷갈립니다. */
  const [finding, setFinding] = useState<'from' | 'to' | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 판을 열 때마다 그 장소에 적힌 것으로 채웁니다. */
  useEffect(() => {
    const m = place?.move ?? null;
    setMode(m?.mode ?? null);
    setVia(m?.via ?? '');
    setMin(m?.min ? String(m.min) : '');
    setCost(m?.cost ?? '');
    setFromSt(m?.from ?? null);
    setToSt(m?.to ?? null);
    setFinding(null);
    setFailed(null);
  }, [place]);

  const stations = mode != null && STATION_MODES.has(mode);
  /* 이름 없는 역은 적은 것이 아닙니다. 수단을 걷기로 바꿨으면 역도 안 보냅니다. */
  const sendable = (st: Station | null) =>
    stations && st && st.name.trim() ? { ...st, name: st.name.trim() } : undefined;

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
        : JSON.stringify({
            mode,
            via: via.trim(),
            min: minNumber ?? undefined,
            cost: cost.trim(),
            from: sendable(fromSt),
            to: sendable(toSt),
          });
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
      {finding ? (
        <View style={styles.finding}>
          <Caption tone="secondary">
            {finding === 'from' ? '타는 역을 찾아 골라 주세요.' : '내리는 역을 찾아 골라 주세요.'}
          </Caption>
          <PlaceSearch
            onPick={(found) => {
              /* 고른 역은 이름과 함께 자리 · 구글 번호까지 둡니다. 지도에 역을
                 세우고 구글 지도 길찾기를 그 역에서 열려면 그것이 있어야 합니다. */
              const st: Station = {
                name: found.name,
                lat: found.lat,
                lng: found.lng,
                ...(found.placeId ? { placeId: found.placeId } : {}),
              };
              if (finding === 'from') {
                setFromSt(st);
              } else {
                setToSt(st);
              }
              setFinding(null);
            }}
          />
          <Button label="돌아가기" variant="ghost" compact onPress={() => setFinding(null)} />
        </View>
      ) : null}
      {/* 찾는 동안 적던 칸을 지우지 않고 가려만 둡니다. 돌아오면 적던 것이 그대로입니다. */}
      <View style={finding ? styles.hidden : styles.form}>
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
        {stations ? (
          <Row gap={Spacing.s2}>
            <View style={styles.grow}>
              <StationField label="타는 역" value={fromSt} onChange={setFromSt} onFind={() => setFinding('from')} />
            </View>
            <View style={styles.grow}>
              <StationField label="내리는 역" value={toSt} onChange={setToSt} onFind={() => setFinding('to')} />
            </View>
          </Row>
        ) : null}
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
      </View>
    </BottomSheet>
  );
}

/**
 * 역 한 칸. 돋보기로 찾아 고르거나, 찾아지지 않으면 이름만 적습니다.
 *
 * <p>이름을 손으로 고치면 골라 둔 자리를 버립니다. 「신주쿠역」 을 골라 놓고
 * 「시부야역」 으로 고쳐 적었는데 자리가 신주쿠에 남으면, 지도와 길찾기가
 * 적힌 이름과 다른 곳을 가리킵니다.
 */
function StationField({
  label,
  value,
  onChange,
  onFind,
}: {
  label: string;
  value: Station | null;
  onChange: (next: Station | null) => void;
  onFind: () => void;
}) {
  return (
    <Field
      label={label}
      value={value?.name ?? ''}
      onChangeText={(name) => onChange(name ? { name } : null)}
      placeholder="신주쿠역"
      maxLength={80}
      hint={placed(value) ? '자리까지 골랐어요' : '찾아 고르면 지도에 서요'}
      action={{ icon: 'search', label: `${label} 찾기`, onPress: onFind }}
    />
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
  /* 판 본문과 같은 간격. 한 겹 감쌌다고 칸 사이가 좁아지면 안 됩니다. */
  finding: {
    gap: Spacing.lg,
  },
  form: {
    gap: Spacing.lg,
  },
  hidden: {
    display: 'none',
  },
});
