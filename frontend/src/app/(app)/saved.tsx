import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { SavedPlace, TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { IconPicker } from '@/components/icon-picker';
import type { MapPlace } from '@/components/map-types';
import { TripMap } from '@/components/trip-map';
import { PLACE_ICONS, iconOf, labelOf } from '@/constants/place-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import {
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  Empty,
  ErrorNote,
  IconButton,
  ListRow,
  Loading,
  Press,
  Row,
  Screen,
  Subtitle,
} from '@/ui';

/** 그림을 아직 안 고른 곳. 지도에서는 별로 찍힙니다. */
const STAR = '⭐';

/**
 * 보석함.
 *
 * <p>남의 일정에서, 검색에서 눈에 띄는 곳을 담아 두었다가 내 일정 아무 날에나
 * 꺼내 넣습니다.
 *
 * <p><b>지도를 함께 둡니다.</b> 담아 둔 곳은 목록으로만 보면 이름의 나열입니다.
 * "오사카에서 담은 게 뭐였지" 를 알려면 하나씩 눌러 봐야 했습니다.
 *
 * <p>지도에서 <b>점끼리 잇지 않습니다.</b> 담아 둔 곳에는 순서가 없습니다.
 * 이어 놓으면 담은 차례가 무슨 동선인 것처럼 보여, 있지도 않은 길을 그려
 * 놓게 됩니다.
 */
export default function Saved() {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pouring, setPouring] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /** 거르고 있는 갈래. 비우면 전부 봅니다. */
  const [kind, setKind] = useState<string | null>(null);
  /** 지도에서 켜 둔 곳. 목록의 그 줄도 함께 켜집니다. */
  const [activeId, setActiveId] = useState<string | null>(null);
  /** 그림을 바꾸려고 열어 둔 곳. */
  const [tagging, setTagging] = useState<SavedPlace | null>(null);

  const { data, error, loading, reload, setData } = useAsync<{ places: SavedPlace[] }>(
    (signal) => api.get('/api/saved', signal),
    [],
  );

  const all = useMemo(() => data?.places ?? [], [data]);

  /**
   * 담아 둔 것에 실제로 있는 갈래만 늘어놓습니다.
   *
   * <p>열여섯 개를 다 보여 주면 대부분 눌러도 아무것도 안 걸립니다.
   */
  const kinds = useMemo(() => {
    const have = new Set(all.map((p) => p.icon).filter((k): k is string => !!k));
    return PLACE_ICONS.filter((k) => have.has(k.key));
  }, [all]);

  const shown = useMemo(
    () => (kind === null ? all : all.filter((p) => p.icon === kind)),
    [all, kind],
  );

  /** 지도에 얹을 것. 거른 것만 올립니다 — 지도와 목록이 어긋나면 안 됩니다. */
  const pins = useMemo<MapPlace[]>(
    () =>
      shown.map((place, i) => ({
        id: place.id,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        dayIndex: 0,
        order: i + 1,
        /* 지도에서는 그림도 번호도 얹지 않습니다. 아래 shape="star" 가
           전부 같은 동그라미에 별 하나로 그립니다. */
        emoji: '',
        color: Colors.accent,
        fit: true,
        radius: null,
        detail: {
          time: null,
          cat: place.cat ?? null,
          cost: null,
          note: place.note ?? null,
          sub: null,
          dayLabel: labelOf(place.icon) || '주워 둔 곳',
          visited: false,
        },
      })),
    [shown],
  );

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function drop(id: string) {
    setFailed(null);
    try {
      await api.delete(`/api/saved/${id}`);
      setPicked((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /** 그림을 바꿉니다. 서버를 기다리지 않고 먼저 칠합니다 — 고르는 맛이 있어야 합니다. */
  async function retag(place: SavedPlace, icon: string | null) {
    setData((prev) =>
      prev
        ? { ...prev, places: prev.places.map((p) => (p.id === place.id ? { ...p, icon } : p)) }
        : prev,
    );
    setTagging(null);
    try {
      await api.patch(`/api/saved/${place.id}`, { icon: icon ?? '' });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      reload();
    }
  }

  return (
    <Screen
      footer={
        picked.size > 0 ? (
          <Button label={`${picked.size}곳 일정에 넣기`} onPress={() => setPouring(true)} />
        ) : undefined
      }>
      {/* 위 막대가 이미 이름을 적고 있습니다. 두 번 쓰면 볼 것이 그만큼
          아래로 밀립니다. */}
      <Body tone="secondary">주워 둔 곳을 골라 일정에 얹습니다.</Body>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && all.length === 0 ? (
        <Empty message="아직 주워 둔 보석이 없습니다. 여행 둘러보기나 장소 찾기에서 별을 누르면 여기 쌓입니다." />
      ) : null}

      {/* 어디에 무엇이 모여 있는지. 목록보다 이쪽이 먼저 답이 됩니다. */}
      {pins.length > 0 ? (
        <TripMap
          places={pins}
          activeId={activeId}
          onSelect={setActiveId}
          link={false}
          /* 전부 같은 동그라미에 별 하나. 담아 둔 곳에는 순서가 없고, 갈래는
             아래 목록과 거르기가 이미 말해 줍니다. */
          shape="star"
          height={240}
        />
      ) : null}

      {/* 갈래가 둘 이상일 때만 거르기를 둡니다. 하나뿐이면 누를 것이 없습니다. */}
      {kinds.length > 1 ? (
        <Row gap={Spacing.xs}>
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

      {data && all.length > 0 && shown.length === 0 ? (
        <Empty message="이 갈래에는 아직 없습니다." />
      ) : null}

      {/*
        한 줄에 한 곳.

        전에는 카드 안에 줄이 들어 있고 그 안에 "고름" 이라는 표가 또 붙었습니다.
        층이 셋이면 한 곳을 읽는 데 눈이 세 번 멈춥니다. 고른 것은 글자로 적지
        않고 바탕색으로 말합니다 — 고른 것과 안 고른 것을 나란히 놓으면 표가
        없어도 어느 쪽인지 압니다.
      */}
      <View style={styles.list}>
        {shown.map((place) => {
          const on = picked.has(place.id);
          return (
            /* 누르는 자리를 겹쳐 두지 않습니다. 큰 것 안에 작은 것을 넣으면
               웹에서는 둘 다 눌려, 그림을 바꾸려다 고르기까지 됩니다. */
            <View
              key={place.id}
              style={[
                styles.row,
                on ? styles.rowOn : null,
                activeId === place.id && !on ? styles.rowLit : null,
              ]}>
              {/* 그림을 누르면 바꿀 수 있습니다. 지우고 다시 담게 하지 않습니다. */}
              <Press
                onPress={() => setTagging(place)}
                scale={0.9}
                accessibilityLabel={`${place.name} 그림 바꾸기`}
                style={styles.mark}>
                <Body style={styles.emoji}>{iconOf(place.icon) || STAR}</Body>
              </Press>

              <Press
                onPress={() => {
                  setActiveId(place.id);
                  toggle(place.id);
                }}
                scale={0.99}
                accessibilityLabel={`${place.name} ${on ? '고르기 취소' : '고르기'}`}
                accessibilityState={{ selected: on }}
                style={styles.grow}>
                <Body strong numberOfLines={1}>
                  {place.name}
                </Body>
                {place.note || place.cat ? (
                  <Caption tone="secondary" numberOfLines={1}>
                    {place.note ?? place.cat}
                  </Caption>
                ) : null}
              </Press>

              <IconButton
                name="navigation"
                label={`${place.name} 길찾기`}
                onPress={() =>
                  openDirections(
                    { name: place.name, lat: place.lat, lng: place.lng, placeId: place.placeId },
                    null,
                  )
                }
              />
              <IconButton
                name="trash-2"
                label={`${place.name} 보석함에서 빼기`}
                tone="danger"
                onPress={() => drop(place.id)}
              />
            </View>
          );
        })}
      </View>

      {tagging ? (
        <BottomSheet
          visible
          title={`${tagging.name} 그림`}
          onClose={() => setTagging(null)}>
          <Caption tone="secondary">
            지도에 이 그림으로 찍힙니다. 일정에 넣을 때도 그대로 따라갑니다.
          </Caption>
          <IconPicker
            value={tagging.icon ?? null}
            onChange={(next) => retag(tagging, next)}
            noneLabel="별"
          />
        </BottomSheet>
      ) : null}

      <PourSheet
        visible={pouring}
        count={picked.size}
        onCancel={() => setPouring(false)}
        onDone={(tripId) => {
          setPouring(false);
          setPicked(new Set());
          router.push({ pathname: '/trip/[id]', params: { id: tripId } });
        }}
        savedIds={[...picked]}
      />
    </Screen>
  );
}

/**
 * 어느 날에 넣을지 고릅니다.
 *
 * <p>여행을 고르면 그 안의 날짜를 부릅니다. 날짜까지 한 번에 늘어놓으면 여행이
 * 여럿일 때 목록이 감당이 안 됩니다.
 */
function PourSheet({
  visible,
  count,
  savedIds,
  onDone,
  onCancel,
}: {
  visible: boolean;
  count: number;
  savedIds: string[];
  onDone: (tripId: string) => void;
  onCancel: () => void;
}) {
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const { data: trips } = useAsync<{ trips: TripSummary[] }>(
    (signal) => (visible ? api.get('/api/trips', signal) : Promise.resolve({ trips: [] })),
    [visible],
  );
  const { data: detail } = useAsync<TripDetail | null>(
    (signal) =>
      trip
        ? api.get(`/api/trip?trip=${encodeURIComponent(trip.id)}`, signal)
        : Promise.resolve(null),
    [trip],
  );

  async function pour(dayId: string) {
    setFailed(null);
    setBusy(true);
    try {
      await api.post(`/api/days/${dayId}/places/from-saved`, { savedIds });
      onDone(trip!.id);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={trip ? '어느 날에 넣을까요?' : '어느 여행에 넣을까요?'}
      onClose={() => {
        setTrip(null);
        onCancel();
      }}>
      <Caption tone="secondary">
        고른 {count}곳이 그 날 맨 뒤에 붙습니다. 순서는 넣은 뒤 바꿀 수 있습니다.
      </Caption>

      {failed ? <ErrorNote message={failed} /> : null}

      {trip === null
        ? trips?.trips.map((t) => (
            <ListRow
              key={t.id}
              title={t.title}
              subtitle={`${t.dayCount}일 · 장소 ${t.placeCount}곳`}
              onPress={() => setTrip(t)}
            />
          ))
        : null}

      {trip !== null ? (
        <>
          <Row style={styles.back}>
            <Subtitle>{trip.title}</Subtitle>
            <Button label="다른 여행" variant="ghost" compact onPress={() => setTrip(null)} />
          </Row>
          {detail?.days.map((day) => (
            <ListRow
              key={day.id}
              title={day.date || day.label}
              subtitle={`장소 ${day.places.length}곳`}
              onPress={() => (busy ? undefined : pour(day.id))}
            />
          ))}
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
  },
  /* 고른 것. 글자로 적지 않고 색으로 말합니다. */
  rowOn: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  /* 지도에서 핀만 누른 것. 고른 것과는 다르게, 실선만 옅게. */
  rowLit: {
    borderColor: Colors.border,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  emoji: {
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  grow: {
    flex: 1,
    gap: 2,
    /* 누르는 자리가 좁으면 손가락으로 맞추기 어렵습니다. 세로로 채웁니다. */
    justifyContent: 'center',
    minHeight: 36,
  },
  back: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
