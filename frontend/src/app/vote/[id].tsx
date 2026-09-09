import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Candidate, SavedPlace, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { PlaceSearch } from '@/components/place-search';
import { iconOf } from '@/constants/place-icons';
import { Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Card,
  ConfirmDialog,
  Divider,
  Empty,
  ErrorNote,
  IconButton,
  ListRow,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

/**
 * 가고 싶은 곳 고르기.
 *
 * <p>일정에 바로 넣으면 아직 정하지도 않은 것이 확정처럼 보이고, 나중에 빼자고
 * 말하기도 어려워집니다. 여기 올려 두고 각자 좋다·아니다를 누른 뒤, 다 좋다고
 * 한 것만 일정으로 옮깁니다.
 *
 * <p>정해지는 기준은 <b>동행자 전원</b>입니다. 표를 안 던진 사람이 있으면 아직
 * 정해지지 않은 것으로 봅니다 — 안 본 사람을 반대로 세면 한 명이 늦었다는
 * 이유로 확정됩니다.
 */
export default function Vote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, error, loading, reload } = useAsync<{ candidates: Candidate[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/candidates`, signal),
    [id],
  );
  const { data: trip } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );

  const [adding, setAdding] = useState(false);
  const [pouring, setPouring] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /* 내리는 것은 되돌릴 수 없고, 남이 올린 것도 내릴 수 있습니다. 다른
     화면과 마찬가지로 한 번 묻습니다 — 여기만 곧장 지워지고 있었습니다. */
  const [dropping, setDropping] = useState<Candidate | null>(null);

  const agreed = useMemo(() => (data?.candidates ?? []).filter((c) => c.agreed), [data]);

  async function vote(candidate: Candidate, yes: boolean | null) {
    setFailed(null);
    try {
      await api.put(`/api/candidates/${candidate.id}/vote`, { yes });
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  async function drop(candidate: Candidate) {
    setFailed(null);
    try {
      await api.delete(`/api/candidates/${candidate.id}`);
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <Screen
      footer={
        agreed.length > 0 ? (
          <Button label={`정해진 ${agreed.length}곳 일정에 넣기`} onPress={() => setPouring(true)} />
        ) : (
          <Button label="가고 싶은 곳 올리기" onPress={() => setAdding(true)} />
        )
      }>
      <Stack.Screen options={{ title: trip?.trip.title ?? '가고 싶은 곳' }} />

      <View style={styles.head}>
        <Title>가고 싶은 곳</Title>
        <Body tone="secondary">
          다 좋다고 한 곳만 일정으로 옮깁니다. 아직 안 누른 사람이 있으면 정해지지 않습니다.
        </Body>
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && data.candidates.length === 0 ? (
        <Empty message="아직 올라온 곳이 없습니다. 가고 싶은 데를 먼저 던져 보세요." />
      ) : null}

      {data?.candidates.map((candidate) => (
        <Card key={candidate.id}>
          <Row style={styles.cardHead}>
            <View style={styles.grow}>
              <Subtitle>{`${iconOf(candidate.icon)} ${candidate.name}`.trim()}</Subtitle>
              {candidate.note || candidate.cat ? (
                <Caption tone="secondary">{candidate.note ?? candidate.cat}</Caption>
              ) : null}
            </View>
            {candidate.agreed ? <Badge label="정해짐" tone="success" /> : null}
          </Row>

          <Row gap={Spacing.md}>
            <Caption tone="secondary">
              좋아요 {candidate.yes}/{candidate.memberCount}
            </Caption>
            {candidate.no > 0 ? <Caption tone="danger">아니요 {candidate.no}</Caption> : null}
          </Row>

          <Row gap={Spacing.sm}>
            <Button
              label={candidate.myVote === true ? '좋아요 무르기' : '좋아요'}
              variant={candidate.myVote === true ? 'secondary' : 'primary'}
              compact
              onPress={() => vote(candidate, candidate.myVote === true ? null : true)}
            />
            <Button
              label={candidate.myVote === false ? '아니요 무르기' : '아니요'}
              variant="secondary"
              compact
              onPress={() => vote(candidate, candidate.myVote === false ? null : false)}
            />
            <IconButton
              name="trash-2"
              label={`${candidate.name} 내리기`}
              tone="danger"
              onPress={() => setDropping(candidate)}
            />
          </Row>
        </Card>
      ))}

      {data && data.candidates.length > 0 ? (
        <>
          <Divider />
          <Button label="가고 싶은 곳 올리기" variant="secondary" onPress={() => setAdding(true)} />
        </>
      ) : null}

      <AddSheet
        visible={adding}
        tripId={id}
        onCancel={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          reload();
        }}
      />

      <ConfirmDialog
        visible={dropping !== null}
        title="목록에서 내릴까요?"
        message={
          dropping
            ? `${dropping.name} 과(와) 지금까지 받은 표가 사라집니다. 되돌릴 수 없습니다.`
            : undefined
        }
        confirmLabel="내리기"
        danger
        onCancel={() => setDropping(null)}
        onConfirm={() => {
          const target = dropping;
          setDropping(null);
          if (target) {
            drop(target);
          }
        }}
      />

      <PourSheet
        visible={pouring}
        days={trip?.days ?? []}
        candidateIds={agreed.map((c) => c.id)}
        onCancel={() => setPouring(false)}
        onDone={() => {
          setPouring(false);
          router.replace({ pathname: '/trip/[id]', params: { id } });
        }}
      />
    </Screen>
  );
}

/**
 * 후보 올리기.
 *
 * <p>보석함에서 꺼내거나 바로 검색합니다. 담아 둔 것을 다시 적게 하면 같은
 * 일을 두 번 합니다.
 */
function AddSheet({
  visible,
  tripId,
  onAdded,
  onCancel,
}: {
  visible: boolean;
  tripId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const { data: saved } = useAsync<{ places: SavedPlace[] }>(
    (signal) => (visible ? api.get('/api/saved', signal) : Promise.resolve({ places: [] })),
    [visible],
  );

  async function add(body: unknown) {
    setFailed(null);
    try {
      await api.post(`/api/trips/${tripId}/candidates`, body);
      onAdded();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <BottomSheet visible={visible} title="가고 싶은 곳 올리기" onClose={onCancel}>
      <PlaceSearch
        onPick={(found) =>
          add({ name: found.name, lat: found.lat, lng: found.lng, placeId: found.placeId })
        }
      />

      {failed ? <ErrorNote message={failed} /> : null}

      {saved && saved.places.length > 0 ? (
        <>
          <Divider />
          <Caption tone="secondary">보석함에서</Caption>
          {saved.places.map((place) => (
            <ListRow
              key={place.id}
              title={`${iconOf(place.icon)} ${place.name}`.trim()}
              subtitle={place.note ?? place.cat ?? '메모 없음'}
              onPress={() => add({ savedId: place.id })}
            />
          ))}
        </>
      ) : null}
    </BottomSheet>
  );
}

/** 정해진 것을 어느 날에 넣을지. */
function PourSheet({
  visible,
  days,
  candidateIds,
  onDone,
  onCancel,
}: {
  visible: boolean;
  days: TripDetail['days'];
  candidateIds: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function pour(dayId: string) {
    setFailed(null);
    setBusy(true);
    try {
      await api.post(`/api/days/${dayId}/places/from-candidates`, { candidateIds });
      onDone();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} title="어느 날에 넣을까요?" onClose={onCancel}>
      <Caption tone="secondary">
        정해진 {candidateIds.length}곳이 그 날 맨 뒤에 붙고, 여기 목록에서는 사라집니다.
      </Caption>
      {failed ? <ErrorNote message={failed} /> : null}
      {days.map((day) => (
        <ListRow
          key={day.id}
          title={day.date || day.label}
          subtitle={`장소 ${day.places.length}곳`}
          onPress={() => (busy ? undefined : pour(day.id))}
        />
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.xs,
  },
  cardHead: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
});
