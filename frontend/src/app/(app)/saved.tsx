import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { SavedPlace, TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Card,
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
 * 꺼내 넣습니다. 여행을 통째로 가져오는 길은 있었지만 "이 집만 갖고 싶다" 가
 * 안 됐습니다.
 */
export default function Saved() {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pouring, setPouring] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync<{ places: SavedPlace[] }>(
    (signal) => api.get('/api/saved', signal),
    [],
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

      {data && data.places.length === 0 ? (
        <Empty message="아직 담아 둔 곳이 없습니다. 남의 일정이나 장소 검색에서 별을 눌러 담아 보세요." />
      ) : null}

      {data?.places.map((place) => {
        const on = picked.has(place.id);
        return (
          <Card key={place.id}>
            <Row style={styles.row}>
              <View style={styles.grow}>
                <ListRow
                  title={place.name}
                  subtitle={place.note ?? place.cat ?? '메모 없음'}
                  right={on ? <Badge label="고름" tone="accent" /> : undefined}
                  onPress={() => toggle(place.id)}
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
 * 어느 날에 넣을지 고릅니다.
 *
 * <p>여행을 고르면 그 안의 날짜를 부릅니다. 날짜까지 한 번에 늘어놓으면
 * 여행이 여럿일 때 목록이 감당이 안 됩니다.
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
      trip ? api.get(`/api/trip?trip=${encodeURIComponent(trip.id)}`, signal) : Promise.resolve(null),
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
      <Caption tone="secondary">고른 {count}곳이 그 날 맨 뒤에 붙습니다. 순서는 넣은 뒤 바꿀 수 있습니다.</Caption>

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
  back: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
