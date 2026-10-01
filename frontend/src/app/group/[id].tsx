import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Group, Mate, Trip } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { FeedList } from '@/components/feed-list';
import { GroupForm } from '@/components/group-form';
import { MatesSheet } from '@/components/mates-sheet';
import { TripForm } from '@/components/trip-form';
import { Spacing } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import {
  Body,
  Button,
  Caption,
  Card,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Press,
  Row,
  Screen,
  Section,
  SegmentedTabs,
  Split,
  Title,
} from '@/ui';
import { stackHeader } from '@/ui/nav';

/**
 * 모임 하나.
 *
 * <h3>사람과 여행이 한 화면에 섭니다</h3>
 *
 * <p>모임에 들어와서 하는 일은 둘입니다 — 누가 있는지 보고, 여행을 짭니다.
 * 그 둘을 다른 화면으로 가르면 모임 화면이 이름만 띄우는 빈 방이 됩니다.
 *
 * <h3>여행이 첫 칸입니다</h3>
 *
 * <p>모임을 다시 여는 이유가 대개 「다음에 언제 가지」입니다. 피드를 먼저
 * 두면 모임이 게시판처럼 읽히고, 그러면 이미 쓰고 있는 메신저와 겹칩니다.
 *
 * <h3>지울 때 여행은 안 지웁니다</h3>
 *
 * <p>모임을 지우면 여행은 만든 사람의 혼자 여행으로 남습니다. 방을
 * 정리하려다 지난 여행이 통째로 사라지면 안 됩니다. 그 말을 묻기 전에
 * 해 줘야 합니다 — 안 그러면 「여행도 없어지나?」 를 사람이 눌러 보고
 * 알게 됩니다.
 */
/** 모임 안에서 볼 것. 여행이 먼저입니다. */
type Lane = 'trips' | 'feed';

const LANES: { value: Lane; label: string }[] = [
  { value: 'trips', label: '여행' },
  { value: 'feed', label: '피드' },
];

type Detail = {
  group: Group;
  members: Mate[];
  /** 모임의 여행들. 목록에 쓸 것만 옵니다. */
  trips: { id: string; title: string }[];
};

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data, error, loading, reload } = useAsync<Detail>(
    (signal) => api.get(`/api/groups/${encodeURIComponent(id)}`, signal),
    [id],
  );

  const [lane, setLane] = useState<Lane>('trips');
  const [editing, setEditing] = useState(false);
  const [mates, setMates] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const group = data?.group;
  const amOwner = group != null && group.ownerId === user?.id;

  async function drop() {
    setBusy(true);
    setFailed(null);
    try {
      await api.delete(`/api/groups/${encodeURIComponent(id)}`);
      router.replace('/(app)/groups');
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        group && lane === 'trips' ? (
          <Button label="이 모임에서 여행 만들기" onPress={() => setAdding(true)} />
        ) : undefined
      }>
      {/* 받아 온 뒤에는 모임 이름이 머리글입니다. 「모임」 이라고만 적혀
          있으면 어느 모임인지 위에서 알 수 없습니다. */}
      <Stack.Screen
        options={stackHeader(group?.name ?? '모임', { up: '/(app)/groups' })}
      />

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {group ? (
        <>
          <Card style={styles.head}>
            <View style={styles.headBody}>
              <Split gap={Spacing.md}>
                <Row gap={Spacing.sm} style={styles.name}>
                  <Body>{group.emoji ?? '🧳'}</Body>
                  <Title>{group.name}</Title>
                </Row>
                {amOwner ? (
                  <Row gap={Spacing.xs}>
                    <IconButton
                      name="settings"
                      label="모임 고치기"
                      bare
                      onPress={() => setEditing(true)}
                    />
                  </Row>
                ) : null}
              </Split>

              {group.about ? <Caption tone="secondary">{group.about}</Caption> : null}

              {/*
                사람들을 얼굴로 늘어놓고, 누르면 판이 열립니다.

                <p>이름을 죽 적어 두면 열 명만 넘어가도 모임 화면의 절반이
                이름입니다. 여기서 보고 싶은 것은 「누가 있나」 이고, 부르고
                내보내는 일은 그때 가서 합니다.
              */}
              <Press
                onPress={() => setMates(true)}
                accessibilityLabel="모임 사람들 보기"
                style={styles.faces}>
                <Row gap={Spacing.xs} style={styles.name}>
                  {data.members.slice(0, 6).map((m) => (
                    <Body key={m.id}>{faceOf(m.mark, m.name)}</Body>
                  ))}
                  <Caption tone="secondary">
                    {data.members.length}명
                    {data.members.length > 6 ? ' 모두 보기' : ''}
                  </Caption>
                </Row>
                <Icon name="chevron-right" size={18} tone="muted" />
              </Press>
            </View>
          </Card>

          <SegmentedTabs items={LANES} value={lane} onChange={setLane} />

          {lane === 'trips' ? (
            <Section title="모임의 여행" flush>
              <View style={styles.body}>
                {data.trips.length === 0 ? (
                  <Empty message="아직 짠 여행이 없어요. 아래에서 첫 줄을 그어 보세요." />
                ) : null}
                {data.trips.map((t) => (
                  <ListRow
                    key={t.id}
                    title={t.title}
                    onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
                  />
                ))}
              </View>
            </Section>
          ) : (
            <FeedList groupId={group.id} groupName={group.name} />
          )}

          {amOwner && lane === 'trips' ? (
            <Button label="모임 지우기" variant="danger" onPress={() => setDeleting(true)} />
          ) : null}

          <GroupForm
            visible={editing}
            group={group}
            onClose={() => setEditing(false)}
            onDone={() => {
              setEditing(false);
              reload();
            }}
          />

          <MatesSheet
            visible={mates}
            groupId={group.id}
            mates={data.members}
            amOwner={amOwner}
            onClose={() => setMates(false)}
            onChanged={reload}
            onLeft={() => router.replace('/(app)/groups')}
          />

          {/* 여행은 이 모임 것으로 만들어집니다. 모임 화면에서 누른 것이라
              「어느 모임?」 을 다시 물을 이유가 없습니다. */}
          <TripForm
            visible={adding}
            groupId={group.id}
            onCancel={() => setAdding(false)}
            onCreated={(trip: Trip) => {
              setAdding(false);
              router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
            }}
          />

          <ConfirmDialog
            visible={deleting}
            title="모임을 지울까요?"
            message="모임 사람들이 이 모임의 여행을 더 볼 수 없게 돼요. 여행은 지워지지 않고, 만든 사람의 혼자 여행으로 남아요."
            confirmLabel="지우기"
            danger
            busy={busy}
            onCancel={() => setDeleting(false)}
            onConfirm={() => {
              setDeleting(false);
              drop();
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* 머리 칸. 여백은 안쪽 묶음이 쥐고, 판은 자리만 잡습니다. */
  head: {
    gap: 0,
  },
  headBody: {
    gap: Spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    paddingVertical: Spacing.xs,
  },
  body: {
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
});
