import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Day, Place, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { PlaceForm } from '@/components/place-form';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ConfirmButton,
  Empty,
  ErrorNote,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

/**
 * 일정 화면.
 *
 * 서버가 여행·날짜·장소·내가 다녀온 곳을 한 번에 내려 줍니다. 나눠서
 * 부르면 그 사이에 동행자가 고쳤을 때 앞뒤가 안 맞는 화면이 됩니다.
 */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );

  /* 방문 표시는 나만 보는 것이라, 서버 응답을 기다리지 않고 먼저 칠합니다.
     실패하면 되돌립니다. */
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const marks = visited ?? new Set(data?.visited ?? []);

  const toggle = useCallback(
    async (placeId: string) => {
      const was = marks.has(placeId);
      const next = new Set(marks);
      if (was) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      setVisited(next);
      setActionError(null);
      setPending((p) => new Set(p).add(placeId));

      try {
        if (was) {
          await api.delete(`/api/visits/${placeId}`);
        } else {
          await api.put(`/api/visits/${placeId}`);
        }
      } catch (e) {
        /* 되돌립니다. 다녀왔다고 칠해 놓고 서버에 없으면 다음에 열 때 사라집니다. */
        setVisited(marks);
        setActionError(e instanceof ApiError ? e.message : '표시하지 못했습니다.');
      } finally {
        setPending((p) => {
          const copy = new Set(p);
          copy.delete(placeId);
          return copy;
        });
      }
    },
    [marks],
  );

  /* 장소가 바뀌면 방문 표시도 서버 것으로 다시 맞춥니다. */
  const refresh = useCallback(() => {
    setVisited(null);
    reload();
  }, [reload]);

  const remove = useCallback(
    async (placeId: string) => {
      setActionError(null);
      try {
        await api.delete(`/api/places/${placeId}`);
        refresh();
      } catch (e) {
        setActionError(e instanceof ApiError ? e.message : '지우지 못했습니다.');
      }
    },
    [refresh],
  );

  if (loading && !data) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <ErrorNote message={error} onRetry={reload} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Empty message="여행을 찾지 못했습니다." />
      </Screen>
    );
  }

  const canEdit = data.myRole === 'EDITOR';

  return (
    <Screen>
      <Stack.Screen options={{ title: data.trip.title }} />
      <Row style={styles.header}>
        <Title>{data.trip.title}</Title>
        <Badge label={roleLabel(data.myRole)} tone={canEdit ? 'accent' : 'muted'} />
      </Row>

      {actionError ? <ErrorNote message={actionError} /> : null}

      {data.days.length === 0 ? <Empty message="아직 날짜가 없습니다." /> : null}

      {data.days.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          visited={marks}
          pending={pending}
          canEdit={canEdit}
          onToggle={toggle}
          onChanged={refresh}
          onRemove={remove}
        />
      ))}
    </Screen>
  );
}

function DayCard({
  day,
  visited,
  pending,
  canEdit,
  onToggle,
  onChanged,
  onRemove,
}: {
  day: Day;
  visited: Set<string>;
  pending: Set<string>;
  canEdit: boolean;
  onToggle: (placeId: string) => void;
  onChanged: () => void;
  onRemove: (placeId: string) => void;
}) {
  /* null 이면 닫힘, '' 이면 새로 넣는 중, 그 밖에는 그 장소를 고치는 중. */
  const [editing, setEditing] = useState<string | null>(null);
  const done = day.places.filter((p) => visited.has(p.id)).length;

  return (
    <Card>
      <Row style={styles.dayHeader}>
        <View style={styles.dayTitle}>
          <Subtitle>{day.label}</Subtitle>
          {day.date ? <Caption>{day.date}</Caption> : null}
        </View>
        {day.places.length > 0 ? (
          <Caption tone={done === day.places.length ? 'success' : 'muted'}>
            {done}/{day.places.length}
          </Caption>
        ) : null}
      </Row>

      {day.theme ? <Body tone="secondary">{day.theme}</Body> : null}

      {day.places.length === 0 ? (
        <Caption>이 날에는 아직 장소가 없습니다.</Caption>
      ) : (
        day.places.map((place) =>
          editing === place.id ? (
            <PlaceForm
              key={place.id}
              dayId={day.id}
              place={place}
              onDone={() => {
                setEditing(null);
                onChanged();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <PlaceRow
              key={place.id}
              place={place}
              visited={visited.has(place.id)}
              busy={pending.has(place.id)}
              canEdit={canEdit}
              onToggle={() => onToggle(place.id)}
              onEdit={() => setEditing(place.id)}
              onRemove={() => onRemove(place.id)}
            />
          ),
        )
      )}

      {canEdit && editing === '' ? (
        <PlaceForm
          dayId={day.id}
          onDone={() => {
            setEditing(null);
            onChanged();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {canEdit && editing === null ? (
        <Button label="장소 넣기" variant="secondary" compact onPress={() => setEditing('')} />
      ) : null}

      {day.budget ? <Caption tone="secondary">예산 {day.budget}</Caption> : null}
    </Card>
  );
}

function PlaceRow({
  place,
  visited,
  busy,
  canEdit,
  onToggle,
  onEdit,
  onRemove,
}: {
  place: Place;
  visited: boolean;
  busy: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.place,
        {
          backgroundColor: visited ? theme.backgroundSelected : 'transparent',
          borderColor: theme.border,
          opacity: busy ? 0.5 : 1,
        },
      ]}>
      {/* 줄 전체를 누르면 다녀온 표시가 켜지고 꺼집니다. */}
      <Pressable onPress={onToggle} disabled={busy}>
        <Row style={styles.placeHead}>
          <View style={styles.placeName}>
            <Body>
              {place.time ? `${place.time}  ` : ''}
              {place.name}
            </Body>
            {place.ja || place.en ? <Caption>{place.ja ?? place.en}</Caption> : null}
          </View>
          {visited ? <Badge label="다녀옴" tone="success" /> : null}
        </Row>

        {place.note ? <Caption tone="secondary">{place.note}</Caption> : null}

        <Row gap={Spacing.two}>
          {place.cat ? <Caption>{place.cat}</Caption> : null}
          {place.cost ? <Caption>{place.cost}</Caption> : null}
          {place.move?.min ? <Caption>이동 {place.move.min}분</Caption> : null}
        </Row>
      </Pressable>

      {canEdit ? (
        <Row gap={Spacing.one}>
          <Button label="고치기" variant="ghost" compact onPress={onEdit} />
          <ConfirmButton label="지우기" confirmLabel="정말 지우기" onConfirm={onRemove} />
        </Row>
      ) : null}
    </View>
  );
}

function roleLabel(role: TripDetail['myRole']) {
  return { EDITOR: '편집 가능', VIEWER: '보기 전용', NONE: '권한 없음' }[role] ?? role;
}

const styles = StyleSheet.create({
  header: {
    justifyContent: 'space-between',
  },
  dayHeader: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayTitle: {
    gap: 2,
  },
  place: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    padding: Spacing.two + 2,
    gap: Spacing.half,
  },
  placeHead: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  placeName: {
    flexShrink: 1,
    gap: 2,
  },
});
