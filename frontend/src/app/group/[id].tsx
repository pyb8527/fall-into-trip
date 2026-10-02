import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Group, Mate, OpenDate, Trip, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { CountdownBadge } from '@/components/countdown-badge';
import { DatePollSheet } from '@/components/date-poll-sheet';
import { TripCalendar } from '@/components/trip-calendar';
import { useAuth } from '@/auth/auth-provider';
import { FeedList } from '@/components/feed-list';
import { GroupForm } from '@/components/group-form';
import { MatesSheet } from '@/components/mates-sheet';
import { ProfileFace } from '@/components/profile-face';
import { TripForm } from '@/components/trip-form';
import { TripSlot } from '@/components/trip-slot';
import { Colors, Gutter, Radius, Spacing, Tap } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import { formatNights, formatSpan, todayIso } from '@/lib/countdown';
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
type Lane = 'trips' | 'calendar' | 'feed';

const LANES: { value: Lane; label: string }[] = [
  { value: 'trips', label: '여행' },
  { value: 'calendar', label: '달력' },
  { value: 'feed', label: '피드' },
];

/*
  모임 상세가 돌려주는 것.

  <p>응답에는 {@code trips} 도 있습니다 — 번호와 이름만 든 목록입니다. 전에는
  여행 칸이 그것으로 줄을 그렸는데 날짜도 장소 수도 없어서 백지에 글자
  하나였고, 지금은 {@code /api/trips} 쪽을 봅니다. 여행이 있는지 없는지는
  {@code group.tripCount} 가 같은 응답에서 답해 주므로 <b>여기서는 안 받습니다
  </b> — 쓰지 않는 것을 적어 두면 다음 사람이 그것을 쓸 자리를 찾습니다.
*/
type Detail = {
  group: Group;
  members: Mate[];
};

export default function GroupScreen() {
  /* invite — 모임 목록에서 이 모임을 골라 「초대 링크 만들기」를 눌렀거나,
     모임을 새로 만든 직후. 사람들 판을 바로 엽니다 — 다음에 할 일이 사람을
     부르는 것입니다. */
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data, error, loading, reload } = useAsync<Detail>(
    (signal) => api.get(`/api/groups/${encodeURIComponent(id)}`, signal),
    [id],
  );

  const [lane, setLane] = useState<Lane>('trips');

  /*
    이 모임의 여행을 날짜와 함께.

    <h3>왜 모임 응답을 안 쓰는가</h3>

    <p>모임 상세가 돌려주는 여행에는 <b>번호와 이름만</b> 있습니다. 달력은
    날짜가 있어야 그리고, 여행 목록도 날짜·며칠·장소 수가 있어야 줄이
    내 여행 목록과 같은 꼴로 섭니다.

    <p>모임 응답에 그것들을 더하는 길도 있지만, {@code /api/trips} 가 이미
    여행마다 날짜·장소 수·모임 번호를 돌려줍니다. 그것을 모임으로 거르면
    서버를 안 고치고 끝납니다 — 화면 하나 때문에 길을 바꾸지 않습니다.

    <p>거르는 것이 빠뜨리는 것은 없습니다. {@code /api/trips} 는 내가 든
    모임의 여행을 전부 싣고(TripAccessPolicy), 모임 상세는 그 모임 것만
    고르므로 <b>같은 것을 두 길로 세는 셈</b>입니다. 쪽 나눔도 없습니다.

    <h3>두 번째 요청이라는 것</h3>

    <p>그래서 여행은 모임보다 늦게 옵니다. 그 틈에 「아직 짠 여행이 없어요」를
    띄우면 여행이 있는 모임에 없다고 말하는 것이 되므로, 있는지 없는지는
    {@code group.tripCount} 에게 묻습니다 — 첫 응답에 이미 들어 있습니다.
  */
  const all = useAsync<{ trips: TripSummary[] }>(
    (signal) => api.get('/api/trips', signal),
    [],
  );
  const ours = (all.data?.trips ?? []).filter((t) => t.groupId === id);
  /* 이 모임에서 아직 날짜를 정하는 중인 후보. 달력에 속 빈 점으로 찍습니다. */
  const polls = useAsync<{ options: OpenDate[] }>(
    (signal) => api.get(`/api/groups/${encodeURIComponent(id)}/dates`, signal),
    [id],
  );
  const [dating, setDating] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [mates, setMates] = useState(invite === '1');
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
              {/* 얼굴은 이모지 한 글자를 글줄에 그냥 세운 것이었습니다. 사진은
                  글자가 아니라, 동그란 칸이 섭니다({@link ProfileFace}) — 그
                  칸 덕에 기기마다 다르던 이모지 높이도 한 자리에 맞습니다. */}
              <Row gap={Spacing.s1} style={styles.name}>
                {data.members.slice(0, 6).map((m) => (
                  <ProfileFace
                    key={m.id}
                    photoId={m.photoId}
                    mark={faceOf(m.mark, m.name)}
                    size={28}
                    label={`${m.name}의 얼굴`}
                  />
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

          {lane === 'calendar' ? (
            /* 우리 모임은 언제 뭐 하지. 모임 이름은 안 붙입니다 — 여기
               있는 것이 전부 이 모임 것입니다. */
            <TripCalendar
              trips={ours}
              onOpen={(t) => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
              polls={polls.data?.options ?? []}
              onPoll={setDating}
            />
          ) : lane === 'trips' ? (
            <>
              {group.tripCount === 0 ? (
                <Empty
                  icon="map-pin"
                  message="아직 짠 여행이 없어요."
                  /* 단추를 또 달지 않습니다. 「여행 만들기」가 바로 위
                     머리 구역에 이미 서 있어서, 같은 것이 한 화면에 둘
                     보이면 둘 다 주 동작으로 안 읽힙니다. */
                  note="위 「여행 만들기」로 첫 줄을 그어 보세요."
                />
              ) : all.error ? (
                <ErrorNote message={all.error} onRetry={all.reload} />
              ) : ours.length === 0 ? (
                /* 모임은 왔고 여행은 아직입니다. 여행이 있다는 것은 이미
                   아니까(위 {@code tripCount}) 비었다고 말하지 않고 기다리는
                   것을 보입니다. */
                <Loading label="여행을 가져오고 있어요" />
              ) : (
                /*
                  내 여행 목록과 같은 줄입니다 — 앞 칸 · 이름 · 날짜 · 며칠 ·
                  장소 수 · D-day.

                  <p>전에는 이름 하나만 넘겼습니다. 같은 여행이 내 여행에서는
                  색 표식과 날짜를 갖고 모임에서는 글자 한 줄이라, 화면을
                  옮기면 다른 것으로 보였습니다. 부품은 {@link TripSlot} 과
                  {@link CountdownBadge} — 내 여행 줄이 쓰는 그것들입니다.
                  <b>두 화면이 같은 칸을 세우는 것이 이 줄의 요점입니다.</b>

                  <h3>첫 사진 번호가 왔고, 칸이 바뀌었습니다</h3>

                  <p>여기 적혀 있던 것: 「{@code TripSummary} 에 사진 번호가
                  없어서 {@link TripThumb} 를 쓰면 줄마다 구글 지도를 한 번씩
                  부르게 된다. 서버가 첫 사진 번호를 실어 보내면 그때 이 자리도
                  바뀐다.」 번호는 왔고({@code firstPhotoId}) 칸은 바뀌었는데,
                  <b>{@link TripThumb} 로 바뀐 것이 아닙니다</b> — 그 예측은
                  틀렸으므로 여기 남겨 두지 않습니다.

                  <p>그 부품은 표지 → 첫 사진 → <b>동선 그림</b> 으로 떨어지는
                  것이 제 일이고, 마지막 칸이 바로 그 구글 호출입니다. 사진이
                  없는 여행에서는 번호가 와도 그 칸까지 떨어집니다 — 피하려던
                  값이 그대로 남습니다. 그래서 사진이 있으면 사진, 없으면 표식
                  으로 가릅니다({@link TripSlot}). 쓰는 것은 목록에 이미 실려
                  온 번호뿐이라 호출이 하나도 안 늡니다.

                  <p>사진을 깔고 표식을 배지로 얹는 쪽은 안 됩니다. 48 에서
                  배지가 작아지는 것보다, <b>셈이 어긋나는 쪽</b>이 더 센
                  까닭입니다 — 배지가 뜻을 갖는 것은 색이나 이모지를 정한
                  여행이고 새 호출을 치르는 것은 사진이 없는 여행이라, 그 두
                  묶음은 서로 상관이 없습니다. 자세한 것은 {@link TripSlot} 에
                  적어 두었습니다.

                  <p>모임 이름표는 안 답니다 — 여기 있는 것이 전부 이 모임
                  것입니다. 내 여행이 모임이 둘 이상일 때만 그 이름표를 내는
                  것과 같은 셈입니다.
                */
                upcomingFirst(ours).map((t, i, rows) => (
                  <ListRow
                    key={t.id}
                    left={<TripSlot theme={t.theme} emoji={t.emoji} firstPhotoId={t.firstPhotoId} />}
                    title={t.title}
                    subtitle={[
                      formatSpan(t.startIso, t.endIso),
                      /* 날짜를 안 정한 여행에 「당일」을 붙이면 하루짜리라는
                         뜻이 됩니다. 날짜가 없으면 며칠인지도 없습니다. */
                      t.dayCount > 0 ? formatNights(t.dayCount) : null,
                      `장소 ${t.placeCount}곳`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={<CountdownBadge startIso={t.startIso} endIso={t.endIso} />}
                    /* 마지막 줄에는 아래 선을 안 긋습니다. 목록이 끝났는데
                       선이 하나 더 있으면 아래에 뭔가 더 있는 줄 압니다. */
                    last={i === rows.length - 1}
                    onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
                  />
                ))
              )}
            </>
          ) : (
            <FeedList groupId={group.id} groupName={group.name} />
          )}

          <GroupForm
            visible={editing}
            group={group}
            onDelete={
              amOwner
                ? () => {
                    setEditing(false);
                    setDeleting(true);
                  }
                : undefined
            }
            onClose={() => setEditing(false)}
            onDone={() => {
              setEditing(false);
              reload();
            }}
          />

          {dating ? (
            <DatePollSheet
              visible
              tripId={dating}
              onClose={() => {
                setDating(null);
                polls.reload();
              }}
              onConfirmed={() => {
                polls.reload();
                all.reload();
              }}
            />
          ) : null}

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

/**
 * 다가오는 것부터.
 *
 * <p>모임을 다시 여는 이유가 「다음에 언제 가지」입니다. 서버가 주는 순서는
 * <b>만든 때</b>라, 그대로 깔면 작년에 다녀온 것이 다음 주 여행 위에 섭니다.
 *
 * <p>셋으로 가릅니다 — 아직 안 끝난 것, 날짜를 안 정한 것, 다녀온 것. 날짜
 * 없는 것을 다가오는 것에 섞으면 언제인지 모르는 여행이 맨 위를 차지하고,
 * 다녀온 것 뒤로 보내면 지금 짜고 있는 여행이 작년 것보다 아래로 내려갑니다.
 * 그래서 가운데입니다.
 *
 * <p>내 여행 목록은 같은 순서를 <b>머리글 넷</b>으로 가릅니다
 * ({@code (app)/trips.tsx} 의 {@code byWhen}). 여기서는 안 가릅니다 — 모임
 * 하나의 여행은 대개 몇 개여서, 줄 하나마다 머리글이 하나 붙으면 목록이
 * 아니라 목차로 읽힙니다.
 */
function upcomingFirst(trips: TripSummary[]): TripSummary[] {
  const today = todayIso();
  /** 아직 안 끝난 것 0, 날짜 미정 1, 다녀온 것 2. */
  const rank = (t: TripSummary) => {
    if (!t.startIso) {
      return 1;
    }
    return (t.endIso ?? t.startIso) < today ? 2 : 0;
  };
  /* 받은 것을 그대로 뒤집지 않습니다 — 달력도 같은 배열을 봅니다. */
  return [...trips].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) {
      return ra - rb;
    }
    /* 다녀온 것은 최근 것부터, 나머지는 가까운 날짜부터입니다. */
    return ra === 2
      ? (b.endIso ?? '').localeCompare(a.endIso ?? '')
      : (a.startIso ?? '').localeCompare(b.startIso ?? '');
  });
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
