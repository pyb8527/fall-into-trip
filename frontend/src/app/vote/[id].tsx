import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { PathTitle } from '@/ui/nav';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Candidate, SavedPlace, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { DayPicker } from '@/components/day-picker';
import { PlaceDetailSheet, type Looked } from '@/components/place-detail-sheet';
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
  Mark,
  Press,
  Row,
  Screen,
  SearchField,
  Split,
  Subtitle,
  Title,
} from '@/ui';
import { TripTabs } from '@/ui/tab-bar';
import { WANT } from '@/constants/words';

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
  /* 눌러서 보고 있는 곳. 판이 이걸로 열립니다. */
  const [looking, setLooking] = useState<Looked | null>(null);
  /* 방금 보석함에 담은 것. 같은 곳을 두 번 담게 두지 않습니다. */
  const [kept, setKept] = useState<Set<string>>(new Set());
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

  /*
    보석함에 담습니다.

    <p>담은 것은 이름으로 기억해 둡니다. 서버에 다시 물으면 판을 열 때마다
    한 번씩 더 불러야 하고, 여기서 알아야 하는 것은 <b>방금 내가 담았는지</b>
    뿐입니다 — 화면을 나갔다 오면 다시 담을 수 있는 것이 맞습니다.
  */
  async function keep(place: Looked) {
    setFailed(null);
    try {
      await api.post('/api/saved', {
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId,
        icon: place.icon,
      });
      setKept((was) => new Set(was).add(place.name));
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <Screen
      tabs={<TripTabs tripId={id} active="vote" />}
      footer={
        agreed.length > 0 ? (
          <Button label={`정해진 ${agreed.length}곳 일정에 넣기`} onPress={() => setPouring(true)} />
        ) : (
          <Button label="가고 싶은 곳 올리기" onPress={() => setAdding(true)} />
        )
      }>
      <Stack.Screen
        options={{
          title: trip?.trip.title ?? WANT,
          headerTitle: () => (
            <PathTitle parent={trip?.trip.title ?? '여행'} title="가고 싶은 곳" />
          ),
        }}
      />

      <View style={styles.head}>
        <Title>가고 싶은 곳</Title>
        <Body tone="secondary">
          다 좋다고 한 곳만 일정으로 옮겨요. 아직 안 누른 사람이 있으면 정해지지 않아요.
        </Body>
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && data.candidates.length === 0 ? (
        <Empty message="아직 올라온 곳이 없어요. 가고 싶은 데를 먼저 던져 보세요." />
      ) : null}

      {data?.candidates.map((candidate) => (
        <Card key={candidate.id}>
          {/*
            눌러서 어떤 데인지 봅니다.

            <p>이름과 갈래만 있었습니다. 그런데 여기서 하는 일은 <b>좋다·아니다를
            고르는 것</b>이라, 어떤 데인지 모르면 고를 수가 없습니다 — 남이 올린
            곳이면 더욱 그렇습니다. 사진도 평점도 영업시간도 없이 이름만 보고
            좋다고 누를 사람은 없습니다.

            <p>고르는 단추는 밖에 둡니다. 판을 열어야 표를 던질 수 있으면 이미
            아는 곳까지 한 번씩 더 들어가야 합니다.
          */}
          <Press
            onPress={() =>
              setLooking({
                name: candidate.name,
                lat: candidate.lat,
                lng: candidate.lng,
                placeId: candidate.placeId,
                icon: candidate.icon,
              })
            }
            scale={0.99}
            accessibilityLabel={`${candidate.name} 자세히 보기`}>
            <Split align="start" gap={Spacing.md}>
              <View style={styles.grow}>
                <Mark emoji={iconOf(candidate.icon)} fallback="📍" />
                <Subtitle>{candidate.name}</Subtitle>
                {candidate.note || candidate.cat ? (
                  <Caption tone="secondary">{candidate.note ?? candidate.cat}</Caption>
                ) : null}
              </View>
              {candidate.agreed ? <Badge label="정해짐" tone="success" /> : null}
            </Split>
          </Press>

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

      {/*
        올리기 단추가 둘이었습니다.

        <p>아래 고정 줄에 하나, 목록 끝에 하나. 그런데 아래 줄은 정해진 곳이
        생기면 「일정에 넣기」로 바뀌므로, 목록 끝의 것은 <b>그때를 위한</b>
        것이었습니다. 아직 아무것도 안 정해졌을 때는 같은 단추가 한 화면에
        둘이었습니다.

        <p>아래 줄이 비어 있을 때는 그것 하나로 충분합니다. 여기는 아래 줄이
        다른 일에 쓰이는 동안에만 섭니다.
      */}
      {data && data.candidates.length > 0 && agreed.length > 0 ? (
        <>
          <Divider />
          <Button label="가고 싶은 곳 올리기" variant="secondary" onPress={() => setAdding(true)} />
        </>
      ) : null}

      {/*
        판에서 보석함에 담습니다.

        <p>여기 올라온 곳은 누군가 가 보고 싶어 한 데입니다. 표에서 떨어져도
        <b>내 마음에는 든</b> 곳일 수 있는데, 지금은 내려가면 그대로 사라집니다 —
        다시 찾으려면 이름을 기억해 뒀다가 검색해야 합니다.

        <p>찾기 화면과 같은 자리, 같은 말입니다.
      */}
      <PlaceDetailSheet
        place={looking}
        onClose={() => setLooking(null)}
        actions={
          looking && !kept.has(looking.name) ? (
            <Press
              onPress={() => {
                const target = looking;
                setLooking(null);
                keep(target);
              }}
              accessibilityLabel={`${looking.name} 보석함에 줍기`}
              scale={0.98}>
              <Caption tone="brand" strong>
                보석함에 줍기
              </Caption>
            </Press>
          ) : null
        }
      />

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
            ? `${dropping.name} 과(와) 지금까지 받은 표가 사라져요. 되돌릴 수 없어요.`
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

      <DayPicker
        visible={pouring}
        note={`정해진 ${agreed.length}곳이 그 날 맨 뒤에 붙고, 여기 목록에서는 사라져요.`}
        days={trip?.days ?? []}
        onPour={(dayId) =>
          api.post(`/api/days/${dayId}/places/from-candidates`, {
            candidateIds: agreed.map((c) => c.id),
          })
        }
        onCancel={() => setPouring(false)}
        onDone={() => {
          setPouring(false);
          reload();
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
  /** 보석함에서 고를 때 이름으로 거르기. */
  const [pick, setPick] = useState('');
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
          {/* 담아 둔 것이 여럿이면 여기서도 훑어 내려가야 합니다. */}
          {saved.places.length > 5 ? (
            <SearchField
              label="보석함에서 찾기"
              value={pick}
              onChangeText={setPick}
              placeholder="국밥, 온천"
            />
          ) : null}
          {saved.places
            .filter((place) =>
              [place.name, place.cat, place.note]
                .filter(Boolean)
                .some((f) => String(f).toLowerCase().includes(pick.trim().toLowerCase())),
            )
            .map((place) => (
            <ListRow
              key={place.id}
              title={place.name}
              left={<Mark emoji={iconOf(place.icon)} fallback="📍" />}
              subtitle={place.note ?? place.cat ?? '메모 없음'}
              onPress={() => add({ savedId: place.id })}
            />
            ))}
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.xs,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
});
