import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Trip, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  ListRow,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

export default function Trips() {
  const { user } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const { data, error, loading, reload } = useAsync<{ trips: TripSummary[] }>(
    (signal) => api.get('/api/trips', signal),
    [],
  );

  return (
    <Screen
      safeTop
      /* 주 동작은 아래에 붙입니다. 한 손으로 쥐었을 때 엄지가 닿는 자리입니다. */
      footer={
        creating ? undefined : <Button label="새 여행 만들기" onPress={() => setCreating(true)} />
      }>
      <View style={styles.headText}>
        <Title>내 여행</Title>
        <Body tone="secondary">
          {user?.name ? `${user.name} 님의 일정` : '함께 짜는 일정'}
        </Body>
      </View>

      {creating ? (
        <NewTrip
          onCancel={() => setCreating(false)}
          onCreated={(trip) => {
            setCreating(false);
            router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
          }}
        />
      ) : null}

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data?.trips.length === 0 && !creating ? (
        <Empty message="아직 여행이 없습니다. 아래에서 하나 만들어 보세요." />
      ) : null}

      {data?.trips.map((trip) => (
        <ListRow
          key={trip.id}
          title={trip.title}
          subtitle={`${formatRange(trip.startIso, trip.endIso)} · ${trip.dayCount}일 · 장소 ${trip.placeCount}곳`}
          right={
            trip.ownerId === user?.id ? (
              <Badge label="내 여행" tone="accent" />
            ) : (
              <Badge label="동행" tone="muted" />
            )
          }
          onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
        />
      ))}
    </Screen>
  );
}

/** 여행 만들기. 시작일과 숙박일만 받으면 서버가 날짜를 채워 줍니다. */
function NewTrip({
  onCreated,
  onCancel,
}: {
  onCreated: (trip: Trip) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [startIso, setStartIso] = useState('');
  const [nights, setNights] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* 서버도 형식을 보지만, 왕복 한 번 없이 여기서 먼저 걸러 줍니다. */
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(startIso.trim());
  const dateError = startIso.length > 0 && !dateOk ? 'YYYY-MM-DD 로 적어 주세요.' : undefined;
  const ready = !!title.trim() && dateOk;

  async function submit() {
    if (!ready || busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const parsed = Number.parseInt(nights, 10);
      const res = await api.post<{ trip: Trip }>('/api/trips', {
        title: title.trim(),
        startIso: startIso.trim(),
        nights: Number.isNaN(parsed) ? 0 : parsed,
      });
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
      <Field
        label="이름"
        value={title}
        onChangeText={setTitle}
        placeholder="가을 오사카"
        maxLength={120}
        returnKeyType="next"
      />
      <Field
        label="시작일"
        value={startIso}
        onChangeText={setStartIso}
        placeholder="2026-10-08"
        autoCapitalize="none"
        autoCorrect={false}
        inputMode="numeric"
        keyboardType="numbers-and-punctuation"
        hint="YYYY-MM-DD"
        error={dateError}
        returnKeyType="next"
      />
      <Field
        label="숙박"
        value={nights}
        onChangeText={setNights}
        placeholder="3"
        inputMode="numeric"
        keyboardType="number-pad"
        hint="0이면 당일치기입니다."
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error ? <ErrorNote message={error} /> : null}
      <Row gap={Spacing.sm}>
        <View style={styles.grow}>
          <Button label="만들기" onPress={submit} busy={busy} disabled={!ready} />
        </View>
        <Button label="취소" variant="secondary" onPress={onCancel} />
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
  headText: {
    flexShrink: 1,
    gap: Spacing.sm,
  },
  grow: {
    flexGrow: 1,
    flexBasis: 140,
  },
});
