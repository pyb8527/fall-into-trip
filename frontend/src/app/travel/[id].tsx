import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';

import { api } from '@/api/client';
import type { Day, DayRoute, Place, PlaceInfo, RouteLeg, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { iconOf } from '@/constants/place-icons';
import { Colors, dayColor, Gutter, Motion, Radius, Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import {
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
 * 여행 중에 보는 화면 — 스탬프첩.
 *
 * <h3>왜 도장인가</h3>
 *
 * <p>일정 화면은 짜는 곳이라 지도·날짜·카드가 다 열려 있습니다. 길 위에서는
 * 그 전부가 방해입니다. 지금 갈 곳 하나만 크게 놓고, 길찾기와 다녀옴만
 * 남깁니다.
 *
 * <p>그런데 "다녀옴" 을 체크 표시로 두었더니 할 일 목록처럼 읽혔습니다.
 * 여행에서 한 곳을 들르는 것은 처리한 일이 아니라 <b>갔다 온 자리</b> 입니다.
 * 그래서 도장으로 바꿨습니다 — 누르면 위에서 쿵 하고 찍히고, 그 자국이 그
 * 날의 종이에 남습니다.
 *
 * <p>도장은 기울어져 찍힙니다. 반듯하면 아이콘이 되고, 조금 비뚤어야 손으로
 * 찍은 것이 됩니다. 기울기는 장소마다 정해져 있습니다 — 다시 그릴 때마다
 * 달라지면 그때부터는 도장이 아니라 애니메이션이 됩니다.
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

  /* 다녀옴은 눌렀을 때 바로 찍고 서버는 뒤따라옵니다. 걸으면서 누르는
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

  /* 도장첩에서 누르면 그 장으로 넘어갑니다. 옆으로 스무 번 쓸어 넘기게 할
     일이 아닙니다. */
  const deck = useRef<ScrollView>(null);

  async function toggle(place: Place) {
    const on = visited.has(place.id);
    if (!on) {
      /* 짧게 한 번. 도장이 종이에 닿는 그 순간에 손끝이 울려야 찍힌 느낌이
         납니다. 안 되는 기기에서는 조용히 넘어갑니다. */
      Vibration.vibrate(18);
    }
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
        <ErrorNote message={error ?? '그런 여행이 없습니다.'} onRetry={reload} />
      </Screen>
    );
  }

  const places = day?.places ?? [];
  const done = places.filter((p) => visited.has(p.id)).length;
  const ink = day?.color || dayColor(dayIndex);
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
          {places.length > 0 ? (
            <Caption tone={done === places.length ? 'success' : 'muted'} strong>
              {done === places.length ? '이 날 다 찍었습니다' : `${done}/${places.length} 찍음`}
            </Caption>
          ) : null}
        </Row>

        {days.length > 1 ? (
          <Row gap={Spacing.xs}>
            {days.map((d, i) => (
              <Chip
                key={d.id}
                label={
                  d.iso === todayIso()
                    ? `오늘 · ${d.date || d.label}`
                    : d.date || d.shortName || d.label
                }
                selected={i === dayIndex}
                onPress={() => setDayIndex(i)}
              />
            ))}
          </Row>
        ) : null}

        {/* 오늘 이 종이가 얼마나 찼는지. 누르면 그 장으로 넘어갑니다. */}
        {places.length > 1 ? (
          <StampBook
            places={places}
            visited={visited}
            ink={ink}
            onJump={(i) =>
              deck.current?.scrollTo({ x: i * (cardWidth + Spacing.md), animated: true })
            }
          />
        ) : null}
      </View>

      {places.length === 0 ? (
        <Empty message="이 날은 아직 비어 있습니다." />
      ) : (
        <ScrollView
          ref={deck}
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
               아래가 잘려 도장 자리에 손이 닿지 않습니다. */
            <ScrollView
              key={place.id}
              style={[styles.slot, { width: cardWidth }]}
              contentContainerStyle={styles.slotInner}
              showsVerticalScrollIndicator={false}>
              <PlaceCard
                place={place}
                order={i + 1}
                ink={ink}
                stampedOn={day?.iso ?? null}
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

/**
 * 오늘 이 종이가 얼마나 찼는지.
 *
 * <p>랠리 수첩의 한 면입니다. 빈 자리는 점선 동그라미로 남아 있어서 "몇 개
 * 더 남았다" 가 세지 않고도 보입니다. 카드를 옆으로 넘기는 것만으로는 전체가
 * 안 보입니다.
 */
function StampBook({
  places,
  visited,
  ink,
  onJump,
}: {
  places: Place[];
  visited: Set<string>;
  ink: string;
  onJump: (index: number) => void;
}) {
  return (
    <Row gap={Spacing.xs} style={styles.book}>
      {places.map((place, i) => {
        const on = visited.has(place.id);
        return (
          <Pressable
            key={place.id}
            onPress={() => onJump(i)}
            accessibilityRole="button"
            accessibilityLabel={`${place.name}${on ? ' 찍음' : ''}`}
            style={[
              styles.chit,
              {
                borderColor: on ? ink : Colors.border,
                borderStyle: on ? 'solid' : 'dashed',
                backgroundColor: on ? withInk(ink) : 'transparent',
                transform: [{ rotate: on ? `${tilt(place.id) / 2}deg` : '0deg' }],
              },
            ]}>
            <Body small strong style={{ color: on ? ink : Colors.textDisabled }}>
              {iconOf(place.icon) || i + 1}
            </Body>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** 지금 갈 곳 하나. 길 위에서 손가락 하나로 쓸 만큼만 둡니다. */
function PlaceCard({
  place,
  order,
  ink,
  stampedOn,
  visited,
  info,
  next,
  onToggle,
}: {
  place: Place;
  order: number;
  /** 이 날의 도장 색. */
  ink: string;
  /** 도장에 찍힐 날짜(YYYY-MM-DD). */
  stampedOn: string | null;
  visited: boolean;
  info?: PlaceInfo;
  /** 다음 장소까지. 마지막 장소 뒤에는 없습니다. */
  next?: RouteLeg;
  onToggle: () => void;
}) {
  return (
    <Card>
      <Row style={styles.cardHead}>
        {place.time ? (
          <Body strong tone="accent">
            {place.time}
          </Body>
        ) : (
          <Caption tone="muted">{order}번째</Caption>
        )}
        {place.cat ? <Caption tone="secondary">{place.cat}</Caption> : null}
      </Row>

      <Subtitle>{place.name}</Subtitle>
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

      {/* 종이의 한가운데. 여기가 이 화면의 주인공입니다. */}
      <Stamp
        place={place}
        order={order}
        ink={ink}
        on={stampedOn}
        stamped={visited}
        onPress={onToggle}
      />

      <Button
        label="길찾기"
        variant="secondary"
        onPress={() =>
          openDirections(
            { name: place.name, lat: place.lat, lng: place.lng, placeId: place.placeId },
            'TRANSIT',
          )
        }
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

/**
 * 도장 자리.
 *
 * <h3>찍히는 동작</h3>
 *
 * <p>위에서 크게 내려와 종이에 닿으며 살짝 눌렸다가 제자리로 돌아옵니다.
 * 그 순간 자국 둘레로 잉크가 한 번 번집니다. 다 합쳐 0.4초쯤이라 걸으면서
 * 눌러도 기다린다는 느낌이 없습니다.
 *
 * <p>처음 그릴 때는 움직이지 않습니다. 이미 찍어 둔 것이 화면을 열 때마다
 * 다시 찍히면, 찍는 일이 특별하지 않게 됩니다.
 *
 * <h3>취소</h3>
 *
 * <p>길게 누르면 지워집니다. 한 번 눌러 지워지게 두면 다음 곳을 찍으려다
 * 방금 찍은 것을 지웁니다 — 도장은 원래 지우기 어려운 것이기도 하고요.
 */
function Stamp({
  place,
  order,
  ink,
  on,
  stamped,
  onPress,
}: {
  place: Place;
  order: number;
  ink: string;
  on: string | null;
  stamped: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(stamped ? 1 : 0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  /* 처음 뜰 때 이미 찍혀 있었는지. 그때는 움직이지 않습니다. */
  const had = useRef(stamped);

  useEffect(() => {
    if (stamped === had.current) {
      return;
    }
    had.current = stamped;

    if (!stamped) {
      Animated.timing(scale, {
        toValue: 0,
        duration: Motion.tap,
        useNativeDriver: true,
      }).start();
      return;
    }

    scale.setValue(1.7);
    ripple.setValue(0);
    Animated.parallel([
      Animated.sequence([
        /* 내려오다 종이에 닿으며 살짝 눌립니다. */
        Animated.timing(scale, { toValue: 0.94, duration: 150, useNativeDriver: true }),
        Animated.spring(scale, {
          toValue: 1,
          damping: Motion.spring.damping,
          stiffness: Motion.spring.stiffness,
          mass: Motion.spring.mass,
          useNativeDriver: true,
        }),
      ]),
      /* 닿은 자리에서 잉크가 한 번 번집니다. */
      Animated.timing(ripple, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [stamped, scale, ripple]);

  const angle = tilt(place.id);

  return (
    <Pressable
      onPress={stamped ? undefined : onPress}
      onLongPress={stamped ? onPress : undefined}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={
        stamped ? `${place.name} 도장 지우기 (길게 누르기)` : `${place.name} 도장 찍기`
      }
      style={styles.pad}>
      {/* 도장이 놓일 자리. 비어 있어도 자리는 남아 있어야 "여기 찍는 거구나"
          가 보입니다. */}
      <View style={[styles.paper, { borderColor: stamped ? 'transparent' : Colors.border }]}>
        {stamped ? null : (
          <Caption tone="muted" strong>
            눌러서 도장
          </Caption>
        )}
      </View>

      {/* 번지는 잉크. 찍는 그 순간에만 보입니다. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            borderColor: ink,
            opacity: ripple.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] }),
            transform: [
              { scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.55] }) },
            ],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.mark,
          {
            borderColor: ink,
            backgroundColor: withInk(ink),
            opacity: scale.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale }, { rotate: `${angle}deg` }],
          },
        ]}>
        {/* 안쪽 테두리 한 줄. 진짜 도장이 대개 두 겹입니다. */}
        <View style={[styles.markInner, { borderColor: ink }]}>
          <Body strong style={[styles.markIcon, { color: ink }]}>
            {iconOf(place.icon) || order}
          </Body>
          {on ? (
            <Body small strong style={[styles.markDate, { color: ink }]}>
              {stampDate(on)}
            </Body>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * 도장이 기울어진 각도.
 *
 * <p>반듯하면 아이콘이 되고, 조금 비뚤어야 손으로 찍은 것이 됩니다. 장소
 * 번호에서 뽑으므로 같은 곳은 늘 같은 각도입니다 — 다시 그릴 때마다
 * 달라지면 그때부터는 도장이 아니라 애니메이션입니다.
 */
function tilt(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) {
    n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  }
  /* -9도에서 9도 사이. 더 기울이면 찍다 만 것처럼 보입니다. */
  return ((n % 19) - 9) * 1;
}

/** 도장에 찍히는 날짜. 2026-11-02 → 11.02 */
function stampDate(iso: string) {
  const [, m, d] = iso.split('-');
  return m && d ? `${m}.${d}` : iso;
}

/**
 * 잉크가 옅게 밴 자리.
 *
 * <p>도장은 테두리만 있는 것이 아니라 안쪽에도 잉크가 조금 묻습니다. 날짜
 * 색에 투명도를 얹어 그 느낌만 냅니다 — 색을 따로 열여섯 개 만들 일이
 * 아닙니다.
 */
function withInk(color: string) {
  return `${color}14`;
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const STAMP = 132;

const styles = StyleSheet.create({
  head: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headRow: {
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  book: {
    flexWrap: 'wrap',
  },
  chit: {
    width: 30,
    height: 30,
    borderRadius: 0,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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

  /* ------------------------------------------------------------- 도장 */
  pad: {
    height: STAMP + Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 빈 자리. 점선이라 "아직 안 찍힘" 이 한눈에 보입니다. */
  paper: {
    position: 'absolute',
    width: STAMP,
    height: STAMP,
    borderRadius: STAMP / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: STAMP,
    height: STAMP,
    borderRadius: STAMP / 2,
    borderWidth: 3,
  },
  mark: {
    width: STAMP,
    height: STAMP,
    borderRadius: STAMP / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    /* 잉크가 종이에 스며든 만큼. 새까맣게 찍히면 스티커처럼 보입니다. */
    opacity: 0.92,
  },
  markInner: {
    width: STAMP - 16,
    height: STAMP - 16,
    borderRadius: (STAMP - 16) / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  markIcon: {
    fontSize: 34,
    lineHeight: 42,
  },
  markDate: {
    letterSpacing: 1.5,
  },
});
