import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Group, Mate, Trip } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { FeedList } from '@/components/feed-list';
import { GroupForm } from '@/components/group-form';
import { MatesSheet } from '@/components/mates-sheet';
import { TripForm } from '@/components/trip-form';
import { Colors, Gutter, Radius, Spacing, Tap } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import {
  Band,
  Body,
  Button,
  Caption,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Grow,
  Icon,
  ListRow,
  Loading,
  Press,
  Row,
  Screen,
  Split,
  Tabs,
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
 * <h3>머리는 카드를 벗었습니다</h3>
 *
 * <p>모임 이름·소개·사람들을 흰 판에 담아 두었습니다. 그런데 바닥도 흰색이
 * 되었으니 판은 아무것도 가르지 못하고 <b>안쪽 여백만큼 글자를 안으로
 * 밀어 넣는</b> 일만 했습니다. 판을 벗기면 모임 이름이 화면 왼쪽 선에
 * 바로 붙습니다 — 이 화면에서 가장 먼저 읽어야 할 글자입니다.
 *
 * <p>머리와 아래 목록은 8픽셀 띠가 가릅니다. 판 하나에 담는 것보다 어디까지가
 * 머리인지가 더 분명합니다.
 *
 * <h3>지울 때 여행은 안 지웁니다</h3>
 *
 * <p>모임을 지우면 여행은 만든 사람의 혼자 여행으로 남습니다. 방을
 * 정리하려다 지난 여행이 통째로 사라지면 안 됩니다. 그 말을 묻기 전에
 * 해 줘야 합니다 — 안 그러면 「여행도 없어지나?」 를 사람이 눌러 보고
 * 알게 됩니다.
 *
 * <h3>지우기는 줄로 낮췄습니다</h3>
 *
 * <p>빨간 단추가 목록 끝에 꽉 찬 폭으로 서 있었습니다. 그러면 화면에서
 * 가장 눈에 띄는 것이 <b>가장 하면 안 되는 일</b>이 됩니다. 맨 아래 띠
 * 아래로 내려 글자만 빨간 줄로 둡니다 — 찾는 사람은 찾고, 찾지 않는
 * 사람 눈에는 안 걸립니다.
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
    <Screen>
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
          <View style={styles.head}>
            {/*
              모임 이름은 위 막대가 적습니다.

              <p>여기 한 번 더 큰 제목으로 적어 두었습니다. 그래서 한 화면에
              같은 말이 두 번 있었고, 무엇보다 <b>상세 화면마다 제목이 서는
              자리가 달랐습니다</b> — 여행 요약과 여행기는 막대에만 적고
              모임만 본문에도 적었습니다. 상세 화면의 제목은 늘 막대입니다.

              <p>남은 것은 이 모임이 무엇인지 말하는 것들뿐입니다 — 표식,
              소개, 사람들, 그리고 여기서 바로 하는 일 둘.
            */}
            <Split>
              <View style={styles.crest}>
                <Text style={styles.crestEmoji}>{group.emoji ?? '🧳'}</Text>
              </View>
              {amOwner ? (
                <Button label="편집" variant="ghost" compact onPress={() => setEditing(true)} />
              ) : null}
            </Split>

            {group.about ? (
              <Body tone="secondary" small>
                {group.about}
              </Body>
            ) : null}

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
              <Row gap={Spacing.s1} style={styles.name}>
                {data.members.slice(0, 6).map((m) => (
                  <Body key={m.id}>{faceOf(m.mark, m.name)}</Body>
                ))}
                <Caption tone="secondary">{data.members.length}명</Caption>
              </Row>
              <Icon name="chevron-right" size={20} tone="muted" />
            </Press>

            {/* 이 화면에서 하려던 일 둘입니다 — 사람을 부르는 것과 여행을
                시작하는 것. 나란히 두고 오른쪽만 채웁니다. */}
            <Split gap={Spacing.s2}>
              <Grow>
                <Button
                  label="초대하기"
                  variant="secondary"
                  compact
                  onPress={() => setMates(true)}
                />
              </Grow>
              <View style={styles.lead}>
                <Button label="여행 만들기" compact onPress={() => setAdding(true)} />
              </View>
            </Split>
          </View>

          <Band />

          <Tabs items={LANES} value={lane} onChange={setLane} />

          {lane === 'trips' ? (
            <>
              {data.trips.length === 0 ? (
                <Empty message="아직 짠 여행이 없어요. 위에서 첫 줄을 그어 보세요." />
              ) : null}
              {data.trips.map((t, i) => (
                <ListRow
                  key={t.id}
                  title={t.title}
                  last={i === data.trips.length - 1}
                  onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
                />
              ))}
            </>
          ) : (
            <FeedList groupId={group.id} groupName={group.name} />
          )}

          {amOwner ? (
            <>
              <Band />
              {/* 손으로 그린 줄이었습니다. 목록 줄 부품을 쓰면 위 여행 목록과
                  높이·여백이 같아져 「맨 아래에 있는 또 하나의 줄」 로
                  읽힙니다 — 단추가 아니라 줄이어야 하는 자리입니다. */}
              <ListRow
                left={<Icon name="trash-2" size={20} tone="danger" />}
                title={<Body strong tone="danger">모임 지우기</Body>}
                last
                onPress={() => setDeleting(true)}
              />
            </>
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
  /*
    탭 아래 선은 좌우 여백을 뚫고 나갑니다.

    <p>여백 안에 가두면 선이 양쪽에서 20픽셀씩 모자라, 화면을 가르는
    가닥이 아니라 내용 위에 얹힌 상자의 밑변으로 보입니다.
  */
  /* 머리 구역. 판이 아니라 그냥 흐름입니다 — 사이만 벌려 둡니다. */
  head: {
    gap: Spacing.s3,
    paddingBottom: Spacing.s6,
  },
  /* 모임을 가리키는 이모지. 목록의 40짜리보다 커서 「이 모임」 이 됩니다. */
  crest: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestEmoji: {
    fontSize: 30,
  },
  name: {
    flexShrink: 1,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    /* 줄 전체가 눌리는 자리라 손가락이 닿을 높이를 채웁니다. */
    minHeight: Tap.min,
  },
  /* 주 동작은 보조의 두 배 폭을 먹습니다. */
  lead: {
    flex: 2,
  },
});
