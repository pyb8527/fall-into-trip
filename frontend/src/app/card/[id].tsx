import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, API_BASE } from '@/api/client';
import type { Companion, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { TripMap } from '@/components/trip-map';
import { Colors, dayColor, Radius, Spacing } from '@/constants/theme';
import { iconOf } from '@/constants/place-icons';
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
 * <p>일정에 넣어 둔 순서대로 한 곳씩 훑습니다. 지도가 따라 움직이고 핀이
 * 하나씩 커졌다가, 마지막에 뒤로 물러나 다녀온 곳 전부를 한 화면에 담습니다.
 *
 * <p>전에는 실제 이동 경로를 받아 와 선을 늘려 가며 그렸습니다. 그런데 경로는
 * 일정 화면에서 수단을 한 번 골라 둬야 생기는 것이라, 대개는 "그릴 동선이
 * 없습니다" 만 나왔습니다. 돌아보려고 연 화면에서 "가서 수단부터 고르고
 * 오세요" 라고 하는 셈이었습니다.
 *
 * <p>이제 아무것도 받아 오지 않습니다. 넣어 둔 곳과 그 순서만으로 됩니다.
 * 구글에 묻지 않으니 요금도 들지 않습니다.
 */
function Replay({ trip }: { trip: TripDetail }) {
  /** 지금 몇 번째를 보고 있는지. 곳의 수와 같아지면 다 본 것입니다. */
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  /** 뒤로 물러나 전부 보여 달라는 신호. 값이 바뀌면 지도가 맞춥니다. */
  const [fitAt, setFitAt] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const places = useMemo(
    () =>
      trip.days.flatMap((day, dayIndex) =>
        day.places
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p, i) => ({
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
      ),
    [trip],
  );

  useEffect(() => {
    if (!playing || places.length === 0) {
      return;
    }
    timer.current = setInterval(() => {
      setStep((at) => {
        if (at >= places.length - 1) {
          /* 마지막 곳까지 갔으면 멈추고 뒤로 물러납니다. 한 곳에 붙어 끝나면
             무엇을 다녀왔는지가 아니라 마지막 한 곳만 남습니다. */
          setPlaying(false);
          setFitAt((n) => n + 1);
          return places.length;
        }
        return at + 1;
      });
    }, 1100);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [playing, places.length]);

  const done = step >= places.length;
  const now = done ? null : places[step];

  return (
    <View style={styles.replay}>
      <TripMap
        places={places}
        /* 지금 보고 있는 곳으로 지도가 따라갑니다. 다 보고 나면 아무것도
           고르지 않아, 전부가 같은 크기로 남습니다. */
        activeId={now?.id ?? null}
        onSelect={() => {}}
        fitAt={fitAt}
        height={320}
      />

      <Row gap={Spacing.sm}>
        <Button
          label={playing ? '멈추기' : done ? '처음부터' : '이어서'}
          variant="secondary"
          compact
          onPress={() => {
            if (done) {
              setStep(0);
            }
            setPlaying((v) => !v);
          }}
        />
        <Caption tone="secondary">
          {done ? `${places.length}곳 다 봤습니다` : `${step + 1} / ${places.length}`}
        </Caption>
      </Row>

      {now ? (
        <Row gap={Spacing.sm}>
          <Body strong>
            {now.emoji ? `${now.emoji} ` : ''}
            {now.name}
          </Body>
          <Caption tone="secondary">{now.detail.dayLabel}</Caption>
        </Row>
      ) : null}

      {places.length === 0 ? (
        <Caption tone="secondary">지도에 찍을 곳이 아직 없습니다.</Caption>
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
