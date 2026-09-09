import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { SavedPlace, TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import type { MapPlace } from '@/components/map-types';
import { TripMap } from '@/components/trip-map';
import { PLACE_ICONS, iconOf, labelOf } from '@/constants/place-icons';
import { Colors, dayColor, Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Card,
  Chip,
  Empty,
  ErrorNote,
  IconButton,
  ListRow,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

/**
 * 보관함.
 *
 * <p>남의 일정에서, 검색에서 눈에 띄는 곳을 담아 두었다가 내 일정 아무 날에나
 * 꺼내 넣습니다.
 *
 * <p><b>지도를 함께 둡니다.</b> 담아 둔 곳은 목록으로만 보면 이름의 나열입니다.
 * "오사카에서 담은 게 뭐였지" 를 알려면 하나씩 눌러 봐야 했습니다. 지도에
 * 얹으면 어디에 무엇이 모여 있는지가 한눈에 보이고, 그 자체가 다음 일정의
 * 밑그림이 됩니다.
 *
 * <p>갈래로도 거릅니다. 스무 곳이 넘어가면 "밥집만" 이나 "온천만" 을 보고
 * 싶어지는데, 목록을 끝까지 훑어 골라내는 것은 일입니다.
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

  const { data, error, loading, reload } = useAsync<{ places: SavedPlace[] }>(
    (signal) => api.get('/api/saved', signal),
    [],
  );

  const all = useMemo(() => data?.places ?? [], [data]);

  /**
   * 담아 둔 것에 실제로 있는 갈래만 늘어놓습니다.
   *
   * <p>열여섯 개를 다 보여 주면 대부분 눌러도 아무것도 안 걸립니다. 있는
   * 것만, 그리고 담아 둔 순서가 아니라 정해 둔 순서(밥·카페가 먼저)로.
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
        emoji: iconOf(place.icon),
        /* 보관함에는 날짜가 없습니다. 갈래마다 색을 돌려 써서, 지도만 봐도
           밥집이 모인 곳과 명소가 모인 곳이 갈라 보이게 합니다. */
        color: colorOfKind(place.icon),
        fit: true,
        radius: null,
        detail: {
          time: null,
          cat: place.cat ?? null,
          cost: null,
          note: place.note ?? null,
          sub: null,
          dayLabel: labelOf(place.icon) || '담아 둔 곳',
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
      setFailed(e instanceof ApiError ? e.message : '지우지 못했습니다.');
    }
  }

  return (
    <Screen
      footer={
        picked.size > 0 ? (
          <Button label={`${picked.size}곳 일정에 넣기`} onPress={() => setPouring(true)} />
        ) : undefined
      }>
      <View style={styles.head}>
        <Title>보관함</Title>
        <Body tone="secondary">담아 둔 곳을 골라 일정에 넣습니다.</Body>
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && all.length === 0 ? (
        <Empty message="아직 담아 둔 곳이 없습니다. 여행 이야기나 장소 찾기에서 별을 누르면 여기 쌓입니다." />
      ) : null}

      {/* 어디에 무엇이 모여 있는지. 목록보다 이쪽이 먼저 답이 됩니다. */}
      {pins.length > 0 ? (
        <TripMap
          places={pins}
          activeId={activeId}
          onSelect={setActiveId}
          height={240}
        />
      ) : null}

      {/* 갈래가 둘 이상일 때만 거르기를 둡니다. 하나뿐이면 누를 것이 없습니다. */}
      {kinds.length > 1 ? (
        <Row gap={Spacing.xs}>
          <Chip label={`전체 ${all.length}`} selected={kind === null} onPress={() => setKind(null)} />
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
        <Empty message="이 갈래로 담아 둔 곳이 없습니다." />
      ) : null}

      {shown.map((place) => {
        const on = picked.has(place.id);
        return (
          <Card key={place.id} style={activeId === place.id ? styles.lit : undefined}>
            <Row style={styles.row}>
              <View style={styles.grow}>
                <ListRow
                  title={`${iconOf(place.icon)} ${place.name}`.trim()}
                  subtitle={place.note ?? place.cat ?? labelOf(place.icon) ?? '메모 없음'}
                  right={on ? <Badge label="고름" tone="accent" /> : undefined}
                  onPress={() => {
                    setActiveId(place.id);
                    toggle(place.id);
                  }}
                />
              </View>
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
                label={`${place.name} 지우기`}
                tone="danger"
                onPress={() => drop(place.id)}
              />
            </Row>
          </Card>
        );
      })}

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
 * 갈래마다 다른 색.
 *
 * <p>보관함에는 날짜가 없어 날짜 색을 쓸 수 없습니다. 대신 갈래 순서로 같은
 * 색표를 돌려 씁니다. 밥집은 늘 같은 색, 온천은 늘 같은 색이라 지도만 봐도
 * 무엇이 어디에 모여 있는지 갈라 보입니다.
 *
 * <p>갈래가 없는 곳은 첫 색으로 둡니다. 회색으로 두면 "덜 중요한 것" 처럼
 * 보이는데, 그냥 아직 그림을 안 고른 것뿐입니다.
 */
function colorOfKind(icon: string | null | undefined) {
  const at = PLACE_ICONS.findIndex((k) => k.key === icon);
  return dayColor(at < 0 ? 0 : at);
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
      setFailed(e instanceof ApiError ? e.message : '넣지 못했습니다.');
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
  head: {
    gap: Spacing.xs,
  },
  row: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
  /* 지도에서 핀을 누른 곳. 목록에서 어느 줄인지 바로 보여야 둘이 이어집니다. */
  lit: {
    borderColor: Colors.accent,
  },
  back: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
