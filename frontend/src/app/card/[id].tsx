import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, API_BASE } from '@/api/client';
import type { Companion, DayRoute, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { TripMap } from '@/components/trip-map';
import type { RouteLine } from '@/components/map-types';
import { Colors, dayColor, Radius, Spacing } from '@/constants/theme';
import { iconOf } from '@/constants/place-icons';
import { decodePolyline } from '@/lib/polyline';
import { shareLink } from '@/lib/share';
import {
  Body,
  Button,
  Caption,
  Divider,
  ErrorNote,
  Loading,
  Row,
  Screen,
  SegmentedTabs,
  Subtitle,
  Title,
} from '@/ui';

/**
 * 다녀온 여행을 한 장으로.
 *
 * <p>두 가지로 봅니다.
 *
 * <ul>
 *   <li><b>영수증</b> — 들른 곳과 거리를 고정폭 글자로 늘어놓습니다. 사진이
 *       없어도 성립하고, 지어낸 수치를 쓰지 않습니다.</li>
 *   <li><b>다시 보기</b> — 동선이 지도 위에 순서대로 그려집니다. 영상으로
 *       만들면 인코딩이 필요한데, 그릴 것을 늘려 가며 보여 주면 같은 것을
 *       훨씬 가볍게 할 수 있습니다.</li>
 * </ul>
 */
type Face = 'receipt' | 'replay';

const FACES: { value: Face; label: string }[] = [
  { value: 'receipt', label: '영수증' },
  { value: 'replay', label: '다시 보기' },
];

export default function Card() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [face, setFace] = useState<Face>('receipt');

  const { data, error, loading } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );
  const { data: mates } = useAsync<{ members: Companion[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/members`, signal),
    [id],
  );

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
        <ErrorNote message={error ?? '여행을 찾을 수 없습니다.'} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: data.trip.title }} />

      <SegmentedTabs items={FACES} value={face} onChange={setFace} />

      {face === 'receipt' ? (
        <Receipt trip={data} mates={mates?.members ?? []} />
      ) : (
        <Replay trip={data} />
      )}

      <Button
        label="링크 보내기"
        variant="secondary"
        onPress={() => shareLink(sharableUrl(id), data.trip.title)}
      />
      <Caption tone="muted">
        그림으로 저장하는 것은 다음 앱 빌드에서 열립니다. 지금은 링크를 보내거나 화면을 찍어
        주세요.
      </Caption>
    </Screen>
  );
}

/**
 * 웹 주소를 만듭니다.
 *
 * <p>앱에서는 API_BASE 가 곧 웹 주소입니다. 앱에도 window 는 있지만
 * window.location 은 없어서, 그것부터 읽으면 "링크 보내기" 를 누르는 순간
 * 화면이 죽습니다. API_BASE 를 먼저 봅니다.
 */
function sharableUrl(id: string) {
  const site =
    API_BASE ||
    (typeof window === 'undefined' || !window.location ? '' : window.location.origin);
  return `${site}/card/${id}`;
}

/**
 * 영수증.
 *
 * <p>고정폭 글자와 점선뿐입니다. 사진이 없어도 성립하고, 지어낸 점수 대신
 * 실제로 눌러 표시한 "다녀옴" 을 씁니다.
 */
function Receipt({ trip, mates }: { trip: TripDetail; mates: Companion[] }) {
  const visited = new Set(trip.visited);
  const places = trip.days.flatMap((d) => d.places);
  const done = places.filter((p) => visited.has(p.id)).length;

  return (
    <View style={styles.paper}>
      <View style={styles.center}>
        <Title>FIT</Title>
        <Caption tone="secondary">FALL INTO TRIP</Caption>
        <Subtitle>{trip.trip.title}</Subtitle>
        <Caption tone="secondary">
          {trip.days[0]?.date ?? ''} — {trip.days[trip.days.length - 1]?.date ?? ''}
        </Caption>
      </View>

      <Divider />

      {trip.days.map((day, i) => (
        <Row key={day.id} style={styles.line}>
          <Body small>{day.date || day.label}</Body>
          <Body small>{day.places.length}곳</Body>
        </Row>
      ))}

      <Divider />

      <Row style={styles.line}>
        <Caption>들른 곳</Caption>
        <Caption>{places.length}곳</Caption>
      </Row>
      <Row style={styles.line}>
        <Caption>다녀옴</Caption>
        <Caption>
          {done} / {places.length}
        </Caption>
      </Row>
      {mates.length > 1 ? (
        <Row style={styles.line}>
          <Caption>함께한 사람</Caption>
          <Caption>{mates.length}명</Caption>
        </Row>
      ) : null}

      <Divider />

      <View style={styles.center}>
        <Caption tone="muted">* * *</Caption>
        <Caption tone="muted">FIT.WEENIE-BEENIE.NET</Caption>
      </View>
    </View>
  );
}

/**
 * 다시 보기.
 *
 * <p>동선이 순서대로 그려집니다. 영상으로 만들면 인코딩이 필요한데, 그릴 것을
 * 늘려 가며 보여 주면 같은 것을 훨씬 가볍게 할 수 있습니다.
 */
function Replay({ trip }: { trip: TripDetail }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* 날짜별 경로를 미리 받아 둡니다. 그릴 때마다 부르면 재생이 끊깁니다. */
  const { data: routes } = useAsync<DayRoute[]>(
    async (signal) => {
      const out: DayRoute[] = [];
      for (const day of trip.days) {
        try {
          const res = await api.get<{ route: DayRoute }>(
            `/api/days/${day.id}/route?mode=TRANSIT`,
            signal,
          );
          out.push(res.route);
        } catch {
          /* 한 날을 못 받아도 나머지는 보여 줍니다. */
        }
      }
      return out;
    },
    [trip.trip.id],
  );

  /** 그릴 수 있는 선을 날짜 순서대로 늘어놓습니다. */
  const lines = useMemo<RouteLine[]>(() => {
    const out: RouteLine[] = [];
    (routes ?? []).forEach((route, dayIndex) => {
      const color = trip.days[dayIndex]?.color || dayColor(dayIndex);
      route.legs.forEach((leg) => {
        if (leg.polyline) {
          out.push({
            id: `${leg.fromId}-${leg.toId}`,
            color,
            points: decodePolyline(leg.polyline),
          });
        }
      });
    });
    return out;
  }, [routes, trip.days]);

  useEffect(() => {
    if (!playing || lines.length === 0) {
      return;
    }
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= lines.length) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 700);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [playing, lines.length]);

  const places = trip.days.flatMap((day, dayIndex) =>
    day.places.map((p, i) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      order: i + 1,
      emoji: iconOf(p.icon),
      dayIndex,
      color: day.color || dayColor(dayIndex),
      fit: p.fit,
      radius: p.radius,
      detail: {
        time: p.time,
        cat: p.cat,
        cost: p.cost,
        note: p.note,
        sub: p.ja ?? p.en,
        dayLabel: day.date || day.label,
        visited: trip.visited.includes(p.id),
      },
    })),
  );

  return (
    <View style={styles.replay}>
      <TripMap
        places={places}
        activeId={null}
        onSelect={() => {}}
        routes={lines.slice(0, step)}
        height={320}
      />

      <Row gap={Spacing.sm}>
        <Button
          label={playing ? '멈추기' : step >= lines.length ? '처음부터' : '이어서'}
          variant="secondary"
          compact
          onPress={() => {
            if (step >= lines.length) {
              setStep(0);
            }
            setPlaying((v) => !v);
          }}
        />
        <Caption tone="secondary">
          {step} / {lines.length} 구간
        </Caption>
      </Row>

      {routes === null ? <Caption tone="secondary">동선을 불러오는 중…</Caption> : null}
      {routes !== null && lines.length === 0 ? (
        <Caption tone="secondary">
          그릴 동선이 없습니다. 일정 화면에서 이동 수단을 한 번 골라 두면 경로가 생깁니다.
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  center: {
    alignItems: 'center',
    gap: 2,
  },
  line: {
    justifyContent: 'space-between',
  },
  replay: {
    gap: Spacing.md,
  },
});
