import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Day, DayRoute, Place, PlaceInfo, RouteLeg } from '@/api/types';
import { useAsync } from '@/api/use-async';
import type { TripDetail } from '@/api/types';
import { iconOf } from '@/constants/place-icons';
import { Colors, dayColor, Gutter, Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Empty,
  ErrorNote,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

/**
 * 여행 중에 보는 화면.
 *
 * <p>일정 화면은 짜는 곳이라 지도·날짜·카드가 다 열려 있습니다. 길 위에서는
 * 그 전부가 방해입니다. 지금 갈 곳 하나만 크게 놓고, 길찾기와 다녀옴만
 * 남깁니다.
 *
 * <p>가로로 넘겨 다음 장소를 봅니다. 세로로 늘어놓으면 결국 일정 화면과 같은
 * 것이 됩니다.
 */
export default function Travel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data, error, loading, reload } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );

  const days = data?.days ?? [];
  const [dayIndex, setDayIndex] = useState(0);
  const jumped = useRef(false);

  /* 여행 중에 열면 오늘로 맞춥니다. 이 화면은 애초에 그러라고 있는 것입니다. */
  useEffect(() => {
    if (jumped.current || days.length === 0) {
      return;
    }
    jumped.current = true;
    const at = days.findIndex((d) => d.iso === todayIso());
    if (at >= 0) {
      setDayIndex(at);
    }
  }, [days]);

  const day: Day | undefined = days[dayIndex];

  /* 다녀옴은 눌렀을 때 바로 칠하고 서버는 뒤따라옵니다. 걸으면서 누르는
     것이라 매번 왕복을 기다리면 손이 멎습니다. */
  const [marks, setMarks] = useState<Set<string> | null>(null);
  const visited = marks ?? new Set(data?.visited ?? []);

  const { data: route } = useAsync<DayRoute | null>(
    (signal) =>
      day
        ? api
            .get<{ route: DayRoute }>(`/api/days/${day.id}/route?mode=TRANSIT`, signal)
            .then((res) => res.route)
        : Promise.resolve(null),
    [day?.id],
  );
  const { data: info } = useAsync<PlaceInfo[]>(
    (signal) =>
      day
        ? api
            .get<{ info: PlaceInfo[] }>(`/api/days/${day.id}/places-info`, signal)
            .then((res) => res.info)
        : Promise.resolve([]),
    [day?.id],
  );

  const legAfter = useMemo(
    () => new Map((route?.legs ?? []).map((leg) => [leg.fromId, leg])),
    [route],
  );
  const infoOf = useMemo(() => new Map((info ?? []).map((i) => [i.id, i])), [info]);

  async function toggle(place: Place) {
    const on = visited.has(place.id);
    setMarks((prev) => {
      const next = new Set(prev ?? data?.visited ?? []);
      on ? next.delete(place.id) : next.add(place.id);
      return next;
    });
    try {
      on ? await api.delete(`/api/visits/${place.id}`) : await api.put(`/api/visits/${place.id}`);
    } catch {
      /* 서버가 못 받았으면 되돌립니다. 안 그러면 다녀온 줄 알고 지나칩니다. */
      setMarks((prev) => {
        const next = new Set(prev ?? []);
        on ? next.add(place.id) : next.delete(place.id);
        return next;
      });
    }
  }

  if (loading && !data) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorNote message={error ?? '여행을 찾을 수 없습니다.'} onRetry={reload} />
      </Screen>
    );
  }

  const places = day?.places ?? [];
  const done = places.filter((p) => visited.has(p.id)).length;
  /* 카드 하나가 화면을 거의 채우되 옆 카드가 살짝 보여야 넘길 수 있다는 것을
     압니다. */
  const cardWidth = Math.min(width - Gutter * 2, 420);

  return (
    <Screen scroll={false}>
      <Stack.Screen
        options={{
          title: data.trip.title,
          headerRight: () => (
            <Button
              label="일정 전체"
              variant="ghost"
              compact
              onPress={() => router.replace({ pathname: '/trip/[id]', params: { id } })}
            />
          ),
        }}
      />

      <View style={styles.head}>
        <Row style={styles.headRow}>
          <Title>{day ? day.date || day.label : '날짜 없음'}</Title>
          <Caption tone={done === places.length && places.length > 0 ? 'success' : 'muted'} strong>
            {done}/{places.length}
          </Caption>
        </Row>

        {days.length > 1 ? (
          <Row gap={Spacing.xs}>
            {days.map((d, i) => (
              <Chip
                key={d.id}
                label={
                  d.iso === todayIso() ? `오늘 · ${d.date || d.label}` : d.date || d.shortName || d.label
                }
                selected={i === dayIndex}
                onPress={() => setDayIndex(i)}
              />
            ))}
          </Row>
        ) : null}
      </View>

      {places.length === 0 ? (
        <Empty message="이 날은 아직 비어 있습니다." />
      ) : (
        <ScrollView
          horizontal
          /* pagingEnabled 는 화면 폭 단위로 넘깁니다. 카드는 그보다 좁아
             (옆 카드가 살짝 보이도록) 한 장씩 넘길수록 어긋납니다. 카드
             한 장 + 사이 간격을 눈금으로 삼아야 딱딱 맞습니다. */
          snapToInterval={cardWidth + Spacing.md}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deck}>
          {places.map((place, i) => (
            /* 카드 안은 세로로도 흐릅니다. 영업시간·메모가 길면 작은 폰에서
               아래가 잘려 "다녀왔어요" 에 손이 닿지 않습니다. */
            <ScrollView
              key={place.id}
              style={[styles.slot, { width: cardWidth }]}
              contentContainerStyle={styles.slotInner}
              showsVerticalScrollIndicator={false}>
              <PlaceCard
                place={place}
                order={i + 1}
                color={day?.color || dayColor(dayIndex)}
                visited={visited.has(place.id)}
                info={infoOf.get(place.id)}
                next={legAfter.get(place.id)}
                onToggle={() => toggle(place)}
              />
            </ScrollView>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

/** 지금 갈 곳 하나. 길 위에서 손가락 하나로 쓸 만큼만 둡니다. */
function PlaceCard({
  place,
  order,
  color,
  visited,
  info,
  next,
  onToggle,
}: {
  place: Place;
  order: number;
  color: string;
  visited: boolean;
  info?: PlaceInfo;
  /** 다음 장소까지. 마지막 장소 뒤에는 없습니다. */
  next?: RouteLeg;
  onToggle: () => void;
}) {
  return (
    <Card>
      <Row style={styles.cardHead}>
        <Row gap={Spacing.sm}>
          <View style={[styles.order, { backgroundColor: color }]}>
            <Body small strong style={styles.orderText}>
              {iconOf(place.icon) || order}
            </Body>
          </View>
          {place.time ? (
            <Body strong tone="accent">
              {place.time}
            </Body>
          ) : null}
        </Row>
        {visited ? <Badge label="다녀옴" tone="success" /> : null}
      </Row>

      <Title>{place.name}</Title>
      {place.ja || place.en ? <Caption>{place.ja ?? place.en}</Caption> : null}

      {info?.permanentlyClosed ? (
        <Caption tone="danger" strong>
          문을 닫은 곳입니다
        </Caption>
      ) : info?.closedOnDay ? (
        <Caption tone="danger" strong>
          이 날은 휴무입니다
        </Caption>
      ) : info && info.spans.length > 0 ? (
        <Caption tone="secondary">
          {info.spans.map((s) => (s.end ? `${s.start}~${s.end}` : `${s.start}~`)).join(' · ')}
        </Caption>
      ) : null}

      {place.note ? <Body tone="secondary">{place.note}</Body> : null}

      <Row gap={Spacing.sm}>
        {place.cat ? <Caption>{place.cat}</Caption> : null}
        {place.cost ? <Caption>{place.cost}</Caption> : null}
      </Row>

      {/* 길 위에서 제일 자주 누르는 둘만 크게 둡니다. */}
      <Button
        label="길찾기"
        onPress={() =>
          openDirections(
            { name: place.name, lat: place.lat, lng: place.lng, placeId: place.placeId },
            'TRANSIT',
          )
        }
      />
      <Button
        label={visited ? '다녀옴 취소' : '다녀왔어요'}
        variant="secondary"
        onPress={onToggle}
      />

      {next ? (
        <Caption tone="secondary">
          다음까지{' '}
          {next.reachable
            ? `${Math.max(1, Math.round(next.seconds / 60))}분 · ${
                next.meters < 1000 ? `${next.meters}m` : `${(next.meters / 1000).toFixed(1)}km`
              }`
            : '길을 찾지 못했습니다'}
        </Caption>
      ) : null}

      {info ? <Caption tone="muted">영업시간 제공: Google</Caption> : null}
    </Card>
  );
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headRow: {
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  deck: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  slot: {
    flexGrow: 0,
  },
  slotInner: {
    paddingBottom: Spacing.lg,
  },
  cardHead: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  order: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    /* 날짜 색이 파스텔이라 흰 글자는 읽히지 않습니다. 짙게 씁니다. */
    color: Colors.onDay,
  },
});
