import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { TripForm } from '@/components/trip-form';
import { Spacing } from '@/constants/theme';
import { Badge, Body, Button, Empty, ErrorNote, ListRow, Loading, Screen, Title } from '@/ui';

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
      footer={<Button label="새 여행 만들기" onPress={() => setCreating(true)} />}>
      <View style={styles.headText}>
        <Title>내 여행</Title>
        <Body tone="secondary">
          {user?.name ? `${user.name} 님의 일정` : '함께 짜는 일정'}
        </Body>
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data?.trips.length === 0 ? (
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

      <TripForm
        visible={creating}
        onCancel={() => setCreating(false)}
        onCreated={(trip) => {
          setCreating(false);
          router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
        }}
      />
    </Screen>
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
});
