import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Day, Place, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { PlaceForm } from '@/components/place-form';
import { TripMap, type MapPlace } from '@/components/trip-map';
import { Colors, dayColor, Radius, Spacing, Tap } from '@/constants/theme';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  ConfirmDialog,
  Divider,
  Empty,
  ErrorNote,
  IconButton,
  Loading,
  Row,
  Screen,
  Subtitle,
} from '@/ui';

/** 전체를 보는 상태. 특정 날짜가 아니라는 뜻입니다. */
const ALL = -1;

/**
 * 일정 화면.
 *
 * <p>서버가 여행·날짜·장소·내가 다녀온 곳을 한 번에 내려 줍니다. 나눠서
 * 부르면 그 사이에 동행자가 고쳤을 때 앞뒤가 안 맞는 화면이 됩니다.
 *
 * <p>지도와 목록이 같은 것을 가리킵니다. 목록에서 장소를 누르면 지도의
 * 핀이 커지고, 핀을 누르면 목록의 그 줄이 켜집니다. 둘을 따로 두면 어느
 * 쪽을 보고 있었는지 매번 다시 찾아야 합니다.
 */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );

  const [activeDay, setActiveDay] = useState<number>(ALL);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);

  /* 방문 표시는 나만 보는 것이라, 서버 응답을 기다리지 않고 먼저 칠합니다.
     걸으면서 누르는 것이라 매번 기다리게 하면 손이 멎습니다. */
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* 매 렌더마다 새 Set 을 만들면, 그것을 쓰는 지도 목록도 매번 새 배열이
     됩니다. 그러면 핀을 한 번 누른 것만으로 지도가 마커를 다시 그리고 화면을
     다시 맞춰(축소해) 버립니다. */
  const marks = useMemo(
    () => visited ?? new Set(data?.visited ?? []),
    [visited, data?.visited],
  );
  const days = data?.days ?? [];

  /* 지도에 넘길 것만 추립니다. 날짜를 고르면 그 날만 남습니다. */
  const mapPlaces = useMemo<MapPlace[]>(() => {
    const out: MapPlace[] = [];
    days.forEach((day, di) => {
      if (activeDay !== ALL && di !== activeDay) {
        return;
      }
      day.places.forEach((p, i) => {
        out.push({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          dayIndex: di,
          order: i + 1,
          color: day.color || dayColor(di),
          fit: p.fit,
          radius: p.radius,
          detail: {
            time: p.time,
            cat: p.cat,
            cost: p.cost,
            note: p.note,
            sub: p.ja ?? p.en,
            dayLabel: day.label,
            visited: marks.has(p.id),
          },
        });
      });
    });
    return out;
  }, [days, activeDay, marks]);

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
  const shown = activeDay === ALL ? days : days.filter((_, i) => i === activeDay);
  const total = shown.reduce((n, d) => n + d.places.length, 0);
  const done = shown.reduce((n, d) => n + d.places.filter((p) => marks.has(p.id)).length, 0);

  return (
    <Screen
      header={
        <>
          {/* 지도·날짜·진행 상황은 아래 목록을 훑는 내내 붙어 있어야 합니다. */}
          <TripMap
            places={mapPlaces}
            activeId={activePlaceId}
            onSelect={setActivePlaceId}
            height={260}
          />

          {days.length > 1 ? (
            <Row gap={Spacing.sm}>
              <Chip
                label="전체"
                selected={activeDay === ALL}
                onPress={() => {
                  setActiveDay(ALL);
                  setActivePlaceId(null);
                }}
              />
              {days.map((day, i) => (
                <Chip
                  key={day.id}
                  label={day.date || day.shortName || day.label}
                  selected={activeDay === i}
                  onPress={() => {
                    setActiveDay(i);
                    setActivePlaceId(null);
                  }}
                />
              ))}
            </Row>
          ) : null}

          {total > 0 ? <Progress done={done} total={total} /> : null}
        </>
      }>
      <Stack.Screen options={{ title: data.trip.title }} />

      {actionError ? <ErrorNote message={actionError} /> : null}

      {days.length === 0 ? <Empty message="아직 날짜가 없습니다." /> : null}

      {days.map((day, di) =>
        activeDay === ALL || activeDay === di ? (
          <DayCard
            key={day.id}
            day={day}
            index={di}
            visited={marks}
            pending={pending}
            canEdit={canEdit}
            activePlaceId={activePlaceId}
            onToggle={toggle}
            onFocus={setActivePlaceId}
            onChanged={refresh}
            onRemove={remove}
          />
        ) : null,
      )}
    </Screen>
  );
}

/** 얼마나 다녀왔는지 한 줄로. 숫자만 있으면 잘 안 읽힙니다. */
function Progress({ done, total }: { done: number; total: number }) {
  const ratio = total === 0 ? 0 : done / total;
  return (
    <View style={styles.progress}>
      <Row style={styles.progressLabel}>
        <Caption tone="secondary">다녀온 곳</Caption>
        <Caption tone={done === total ? 'success' : 'secondary'} strong>
          {done} / {total}
        </Caption>
      </Row>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(ratio * 100)}%`,
              backgroundColor: done === total ? Colors.success : Colors.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

function DayCard({
  day,
  index,
  visited,
  pending,
  canEdit,
  activePlaceId,
  onToggle,
  onFocus,
  onChanged,
  onRemove,
}: {
  day: Day;
  index: number;
  visited: Set<string>;
  pending: Set<string>;
  canEdit: boolean;
  activePlaceId: string | null;
  onToggle: (placeId: string) => void;
  onFocus: (placeId: string) => void;
  onChanged: () => void;
  onRemove: (placeId: string) => void;
}) {
  /* null 이면 닫힘, '' 이면 새로 넣는 중, 그 밖에는 그 장소를 고치는 중. */
  const [editing, setEditing] = useState<string | null>(null);
  const done = day.places.filter((p) => visited.has(p.id)).length;
  const color = day.color || dayColor(index);

  return (
    <Card>
      <Row style={styles.dayHeader}>
        <Row gap={Spacing.md} style={styles.dayTitle}>
          <View style={[styles.dayDot, { backgroundColor: color }]} />
          {/* 위 칩이 이미 날짜로 고르게 하므로 'Day 1' 은 같은 말을 한 번 더
              하는 셈입니다. 날짜만 남깁니다. */}
          <Subtitle>{day.date || day.label}</Subtitle>
        </Row>
        {day.places.length > 0 ? (
          <Caption tone={done === day.places.length ? 'success' : 'muted'} strong>
            {done}/{day.places.length}
          </Caption>
        ) : null}
      </Row>

      {day.theme ? (
        <Body small tone="secondary">
          {day.theme}
        </Body>
      ) : null}

      {day.places.length === 0 ? (
        <Caption>이 날에는 아직 장소가 없습니다.</Caption>
      ) : (
        <View style={styles.places}>
          {day.places.map((place, i) =>
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
                order={i + 1}
                color={color}
                visited={visited.has(place.id)}
                busy={pending.has(place.id)}
                active={activePlaceId === place.id}
                canEdit={canEdit}
                onToggle={() => onToggle(place.id)}
                onFocus={() => onFocus(place.id)}
                onEdit={() => setEditing(place.id)}
                onRemove={() => onRemove(place.id)}
              />
            ),
          )}
        </View>
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
        <>
          <Divider />
          <Button label="장소 넣기" variant="secondary" onPress={() => setEditing('')} />
        </>
      ) : null}

      {day.budget ? <Caption tone="secondary">예산 {day.budget}</Caption> : null}
    </Card>
  );
}

function PlaceRow({
  place,
  order,
  color,
  visited,
  busy,
  active,
  canEdit,
  onToggle,
  onFocus,
  onEdit,
  onRemove,
}: {
  place: Place;
  order: number;
  color: string;
  visited: boolean;
  busy: boolean;
  active: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View
      style={[
        styles.place,
        { backgroundColor: active ? Colors.accentSoft : Colors.fill, opacity: busy ? 0.6 : 1 },
        active && { borderColor: color },
      ]}>
      <Pressable onPress={onFocus} style={styles.placeTap}>
        <View style={styles.placeMain}>
          {/* 지도 핀에 적힌 번호와 같은 번호입니다. */}
          <View style={[styles.order, { backgroundColor: color }]}>
            <OrderLabel n={order} />
          </View>

          <View style={styles.placeText}>
            <Row gap={Spacing.sm}>
              {place.time ? (
                <Body small strong tone="accent">
                  {place.time}
                </Body>
              ) : null}
              <Body strong numberOfLines={2}>
                {place.name}
              </Body>
            </Row>
            {place.ja || place.en ? <Caption>{place.ja ?? place.en}</Caption> : null}
            {place.note ? <Caption tone="secondary">{place.note}</Caption> : null}
            {place.cat || place.cost || place.move?.min ? (
              <Row gap={Spacing.sm}>
                {place.cat ? <Caption>{place.cat}</Caption> : null}
                {place.cost ? <Caption>{place.cost}</Caption> : null}
                {place.move?.min ? <Caption>이동 {place.move.min}분</Caption> : null}
              </Row>
            ) : null}
          </View>

          {visited ? <Badge label="다녀옴" tone="success" /> : null}
        </View>
      </Pressable>

      <Row gap={Spacing.xs} style={styles.placeActions}>
        <IconButton
          name="check"
          label={visited ? '다녀옴 취소' : '다녀옴으로 표시'}
          tone="success"
          active={visited}
          disabled={busy}
          onPress={onToggle}
        />
        {canEdit ? (
          <>
            <IconButton name="edit-2" label="장소 고치기" onPress={onEdit} />
            <IconButton
              name="trash-2"
              label="장소 지우기"
              tone="danger"
              onPress={() => setConfirming(true)}
            />
          </>
        ) : null}
      </Row>

      <ConfirmDialog
        visible={confirming}
        title="이 장소를 지울까요?"
        message={`${place.name} 이(가) 일정에서 사라집니다. 되돌릴 수 없습니다.`}
        confirmLabel="지우기"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemove();
        }}
      />
    </View>
  );
}

/** 핀 번호. 색 위에 흰 글자로 올립니다. */
function OrderLabel({ n }: { n: number }) {
  return <Body small strong style={styles.orderText}>{n}</Body>;
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.lg,
  },
  progress: {
    gap: Spacing.sm,
  },
  progressLabel: {
    justifyContent: 'space-between',
  },
  track: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.fillPressed,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  dayHeader: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  dayTitle: {
    flexShrink: 1,
    alignItems: 'center',
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },

  places: {
    gap: Spacing.sm,
  },
  place: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  placeTap: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    minHeight: Tap.min,
  },
  placeMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  order: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  orderText: {
    color: '#FFFFFF',
  },
  placeText: {
    flex: 1,
    gap: Spacing.xs,
  },
  placeActions: {
    /* 내용은 왼쪽에서 읽고, 손대는 것은 오른쪽 아래에 모읍니다. */
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
});
