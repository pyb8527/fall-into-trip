import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Trip, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  Badge,
  Button,
  Caption,
  Card,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

export default function Trips() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, loading, reload } = useAsync<{ trips: TripSummary[] }>(
    (signal) => api.get('/api/trips', signal),
    [],
  );

  return (
    <Screen>
      <Row style={styles.header}>
        <Title>내 여행</Title>
        <Link href="/(app)/settings">
          <Caption tone="accent">{user?.name ?? '내 계정'}</Caption>
        </Link>
      </Row>

      <NewTrip onCreated={(trip) => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })} />

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data?.trips.length === 0 ? (
        <Empty message="아직 여행이 없습니다. 위에서 하나 만들어 보세요." />
      ) : null}

      {data?.trips.map((trip) => (
        <TripRow key={trip.id} trip={trip} mine={trip.ownerId === user?.id} />
      ))}
    </Screen>
  );
}

function TripRow({ trip, mine }: { trip: TripSummary; mine: boolean }) {
  const theme = useTheme();

  return (
    <Link href={{ pathname: '/trip/[id]', params: { id: trip.id } }} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.tripRow,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        <Row style={styles.tripTitle}>
          <Subtitle>{trip.title}</Subtitle>
          {mine ? <Badge label="내 여행" tone="accent" /> : <Badge label="동행" tone="muted" />}
        </Row>
        <Caption>
          {formatRange(trip.startIso, trip.endIso)} · {trip.dayCount}일 · 장소 {trip.placeCount}곳
        </Caption>
      </Pressable>
    </Link>
  );
}

/** 여행 만들기. 시작일과 숙박일만 받으면 서버가 날짜를 채워 줍니다. */
function NewTrip({ onCreated }: { onCreated: (trip: Trip) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startIso, setStartIso] = useState('');
  const [nights, setNights] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return <Button label="새 여행 만들기" variant="secondary" onPress={() => setOpen(true)} />;
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const parsed = Number.parseInt(nights, 10);
      const res = await api.post<{ trip: Trip }>('/api/trips', {
        title: title.trim(),
        startIso: startIso.trim(),
        nights: Number.isNaN(parsed) ? 0 : parsed,
      });
      setOpen(false);
      setTitle('');
      setStartIso('');
      setNights('');
      onCreated(res.trip);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '만들지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Subtitle>새 여행</Subtitle>
      <Field label="이름" value={title} onChangeText={setTitle} placeholder="가을 오사카" maxLength={120} />
      <Field
        label="시작일"
        value={startIso}
        onChangeText={setStartIso}
        placeholder="2026-10-08"
        autoCapitalize="none"
        inputMode="numeric"
        hint="YYYY-MM-DD"
      />
      <Field
        label="숙박"
        value={nights}
        onChangeText={setNights}
        placeholder="3"
        inputMode="numeric"
        keyboardType="number-pad"
        hint="0이면 당일치기입니다."
      />
      {error ? <ErrorNote message={error} /> : null}
      <Row gap={Spacing.two}>
        <Button label="만들기" onPress={submit} busy={busy} disabled={!title || !startIso} />
        <Button label="취소" variant="ghost" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

function formatRange(start: string | null, end: string | null) {
  if (!start) {
    return '날짜 미정';
  }
  if (!end || end === start) {
    return start;
  }
  return `${start} ~ ${end}`;
}

const styles = StyleSheet.create({
  header: {
    justifyContent: 'space-between',
  },
  tripRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  tripTitle: {
    justifyContent: 'space-between',
  },
});
