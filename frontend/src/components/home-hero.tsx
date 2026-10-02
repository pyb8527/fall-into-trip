import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { Candidate, Going, Spend, TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { TripCard, type TodoChip } from '@/components/trip-card';
import { Spacing } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import { daysBetween, todayIso, type Countdown } from '@/lib/countdown';
import { money } from '@/lib/money';
import { Body, Button, Caption, Row } from '@/ui';

/** 홈 맨 위 카드가 지금 어느 때를 말하는지. */
export type HeroPhase = 'before' | 'going' | 'after';

/**
 * 홈 맨 위의 큰 카드 — 때에 따라 안이 바뀝니다.
 *
 * <h3>시기마다 묻는 것이 다릅니다</h3>
 *
 * <ul>
 *   <li><b>떠나기 전</b> — 무엇이 남았나. 챙길 것, 아직 안 던진 표, 빈 날</li>
 *   <li><b>여행 중</b> — 오늘 다음은 어디고, 오늘 얼마 썼나</li>
 *   <li><b>다녀온 뒤 일주일</b> — 영수증을 보고 여행기로 남길 때</li>
 * </ul>
 *
 * <p>같은 자리에 같은 것만 있으면 홈이 늘 같은 화면입니다. 지금 할 일이
 * 바뀌면 카드도 바뀝니다.
 *
 * <h3>받아 오는 것</h3>
 *
 * <p>목록(/api/trips)에는 사람·챙길 것·후보가 없어 이 카드 하나를 위해 몇
 * 번 더 부릅니다. 카드 하나뿐이라 그 값이 큽니다 — 홈에 여러 장 깔리는
 * 자리라면 서버에 요약 칸을 둘 일입니다(plan-review D).
 *
 * <p>현지 날씨는 안 넣었습니다. 날씨 데이터가 앱에 없고, 외부 API 가 하나
 * 늘어납니다(plan-review Q4). 여행 중 「다음 곳까지 도보 12분」도 안
 * 넣었습니다 — 이동 시간은 구글 경로를 한 번 더 불러야 합니다.
 */
export function HomeHero({
  trip,
  at,
  phase,
}: {
  trip: TripSummary;
  at: Countdown | null;
  phase: HeroPhase;
}) {
  const router = useRouter();
  const id = encodeURIComponent(trip.id);

  /* 「갈게요」 한 사람들. 모임 여행에서만 물을 것이 있습니다. */
  const going = useAsync<{ going: Going[] }>(
    (signal) =>
      trip.groupId ? api.get(`/api/trips/${id}/going`, signal) : Promise.resolve({ going: [] }),
    [trip.id, trip.groupId],
  );
  const detail = useAsync<TripDetail>((signal) => api.get(`/api/trip?trip=${id}`, signal), [trip.id]);
  const items = useAsync<{ items: { done: boolean }[] }>(
    (signal) =>
      phase === 'before' ? api.get(`/api/trips/${id}/items`, signal) : Promise.resolve({ items: [] }),
    [trip.id, phase],
  );
  const candidates = useAsync<{ candidates: Candidate[] }>(
    (signal) =>
      phase === 'before'
        ? api.get(`/api/trips/${id}/candidates`, signal)
        : Promise.resolve({ candidates: [] }),
    [trip.id, phase],
  );
  const spent = useAsync<{ expenses: Spend[] }>(
    (signal) =>
      phase === 'going' ? api.get(`/api/trips/${id}/expenses`, signal) : Promise.resolve({ expenses: [] }),
    [trip.id, phase],
  );

  const faces = (going.data?.going ?? [])
    .filter((g) => g.answer === 'GOING')
    .map((g) => faceOf(g.mark, g.name));

  const open = (pathname: '/trip/[id]' | '/vote/[id]' | '/money/[id]' | '/card/[id]', extra?: object) =>
    router.push({ pathname, params: { id: trip.id, ...extra } });

  /* ---------------------------------------------------------- 떠나기 전 */
  const todos = useMemo<TodoChip[]>(() => {
    if (phase === 'after') {
      return [
        { label: '영수증 보기', onPress: () => open('/card/[id]') },
        { label: '여행기 올리기', onPress: () => open('/trip/[id]', { open: 'publish' }) },
      ];
    }
    if (phase !== 'before') {
      return [];
    }
    const out: TodoChip[] = [];
    const list = items.data?.items ?? [];
    const done = list.filter((i) => i.done).length;
    if (items.data) {
      if (list.length === 0) {
        out.push({ label: '챙길 것 적기', onPress: () => open('/trip/[id]', { open: 'pack' }) });
      } else if (done < list.length) {
        out.push({
          label: `챙길 것 ${done}/${list.length}`,
          onPress: () => open('/trip/[id]', { open: 'pack' }),
        });
      }
    }
    /* 내가 아직 안 던진 표. 정해진 것은 셀 까닭이 없습니다. */
    const waiting = (candidates.data?.candidates ?? []).filter((c) => !c.agreed && c.myVote == null);
    if (waiting.length > 0) {
      out.push({ label: `투표 ${waiting.length}곳`, onPress: () => open('/vote/[id]') });
    }
    const empty = (detail.data?.days ?? []).filter((d) => d.places.length === 0);
    if (empty.length === 1) {
      out.push({
        label: `${empty[0].date ?? empty[0].label} 일정 비어 있음`,
        onPress: () => open('/trip/[id]'),
      });
    } else if (empty.length > 1) {
      out.push({ label: `빈 날 ${empty.length}일`, onPress: () => open('/trip/[id]') });
    }
    return out.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, items.data, candidates.data, detail.data, trip.id]);

  /* ---------------------------------------------------------- 여행 중 */
  const middle = useMemo(() => {
    if (phase === 'after') {
      const ago = trip.endIso ? daysBetween(trip.endIso, todayIso()) : 0;
      return (
        <Body small tone="secondary">
          {ago <= 1 ? '어제 돌아왔어요.' : `다녀온 지 ${ago}일.`} 영수증을 보고 여행기로 남겨 보세요.
        </Body>
      );
    }
    if (phase !== 'going' || !detail.data) {
      return null;
    }
    const days = detail.data.days;
    const at = days.findIndex((d) => d.iso === todayIso());
    if (at < 0) {
      return null;
    }
    const day = days[at];
    /* 지금 시각 뒤로 가장 가까운 곳. 시각을 안 적은 곳만 있으면 첫 곳입니다. */
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const next =
      day.places.find((p) => p.time && p.time >= hhmm) ??
      day.places.find((p) => !p.time) ??
      null;

    /* 오늘 쓴 돈. 통화는 더하지 않고 나란히 둡니다. */
    const sums = new Map<string, { sum: number; decimals: number }>();
    for (const e of spent.data?.expenses ?? []) {
      if (e.dayId !== day.id) {
        continue;
      }
      const was = sums.get(e.currency) ?? { sum: 0, decimals: e.decimals };
      sums.set(e.currency, { sum: was.sum + e.amount, decimals: e.decimals });
    }
    const spentToday = [...sums.entries()].map(([c, t]) => money(t.sum, c, t.decimals)).join(' · ');

    return (
      <View style={styles.today}>
        <Body small strong>
          {`${at + 1}일차`}
          {next ? ` · 다음 ${next.name}${next.time ? ` ${next.time}` : ''}` : ' · 오늘 남은 곳이 없어요'}
        </Body>
        <Row gap={Spacing.s2}>
          {next ? (
            <Button
              label="길찾기"
              icon="navigation"
              variant="secondary"
              compact
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}`,
                )
              }
            />
          ) : null}
          {spentToday ? <Caption tone="secondary">오늘 쓴 돈 {spentToday}</Caption> : null}
        </Row>
      </View>
    );
  }, [phase, detail.data, spent.data, trip.endIso]);

  const nth = phase === 'going' && trip.startIso ? daysBetween(trip.startIso, todayIso()) + 1 : 0;

  return (
    <TripCard
      trip={trip}
      at={at}
      label={phase === 'going' ? `여행 중 ${nth}일째` : undefined}
      faces={faces}
      middle={middle}
      todos={todos}
      actions={[
        { icon: 'thumbs-up', label: '가고 싶은 곳', onPress: () => open('/vote/[id]') },
        { icon: 'credit-card', label: '가계부', onPress: () => open('/money/[id]') },
        { icon: 'book-open', label: '여행 요약', onPress: () => open('/card/[id]') },
      ]}
      onPress={() => open('/trip/[id]')}
    />
  );
}

const styles = StyleSheet.create({
  today: {
    gap: Spacing.s2,
  },
});
