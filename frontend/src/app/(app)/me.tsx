import Constants from 'expo-constants';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { PostPage, Profile, Spend, TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { FeedList } from '@/components/feed-list';
import { TipSheet } from '@/components/tip-sheet';
import { TripCalendar } from '@/components/trip-calendar';
import { TripThumb } from '@/components/trip-thumb';
import { glyphOf } from '@/constants/place-icons';
import { formatNights, formatSpan, todayIso } from '@/lib/countdown';
import { money } from '@/lib/money';
import { Colors, Radius, Spacing, Tap, Type } from '@/constants/theme';
import { markOf } from '@/constants/user-marks';
import {
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  ErrorNote,
  Field,
  Grow,
  Icon,
  ListRow,
  Mark,
  Press,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Split,
  Tabs,
  Title,
} from '@/ui';
import { LogoSymbol } from '@/ui/logo';

/** 어느 묶음을 보고 있나. */
/*
  여행기 · 피드 · 리뷰 · 달력.

  <p>내 피드 · 달력 · 리뷰였습니다. 「무엇을 다녀왔나」가 어디에도 없어서,
  여행을 다섯 번 다녀온 사람의 마이페이지도 피드가 비면 빈 화면이었습니다.
  내놓은 여행기와 다녀온 여행을 맨 앞 칸에 둡니다.
*/
type Lane = 'trips' | 'feed' | 'reviews' | 'calendar';

/**
 * 마이페이지 (G-10).
 *
 * <h3>내 것과 남의 것이 같은 화면입니다</h3>
 *
 * <p>화면을 둘 두지 않습니다. 내 것에만 「내 계정」 줄이 붙고 나머지는
 * 같습니다 — 둘로 가르면 같은 묶음(피드·리뷰)을 두 군데서 그리게 되고,
 * 한쪽을 고칠 때 다른 쪽이 남습니다.
 *
 * <p>남의 것은 <b>같은 모임 사람에게만</b> 보입니다. 서버가 404 로 막고,
 * 화면은 그 404 를 그대로 보여 줍니다 — 「볼 수 없어요」라고 적으면
 * 「그런 사람이 있다」가 새어 나갑니다.
 *
 * <h3>내 피드가 여기 삽니다</h3>
 *
 * <p>그룹 없이 올린 글은 둘러보기에도 모임에도 안 섭니다. 그래서 올려 두고
 * 다시 볼 자리가 없었습니다 — 2단계에서 피드를 만들 때 비워 둔 자리입니다.
 */
export default function Me() {
  const router = useRouter();
  const { user } = useAuth();
  /* 남의 것을 볼 때만 번호가 옵니다. 내 것은 번호 없이 들어옵니다. */
  const { id } = useLocalSearchParams<{ id?: string }>();
  const whose = typeof id === 'string' && id.length > 0 ? id : null;

  const profile = useAsync<Profile>(
    (signal) =>
      api.get(whose ? `/api/users/${encodeURIComponent(whose)}/profile` : '/api/me/profile', signal),
    [whose],
  );

  const [lane, setLane] = useState<Lane>('trips');
  const [editing, setEditing] = useState(false);
  /* 달력에서 누른 날. 그날 장소와 쓴 돈을 달력 아래에 그립니다. */
  const [picked, setPicked] = useState<string | null>(null);
  const me = profile.data;

  /*
    내 여행 전부.

    <p>달력 칸만 씁니다. 내 것일 때만 받아 옵니다 — 남의 여행 목록을 받는
    길은 없고, 있어도 보여 줄 것이 아닙니다.

    <p>{@code /api/trips} 가 여행마다 날짜와 모임 이름을 이미 돌려줍니다.
    달력을 위해 새로 받는 것이 없습니다.
  */
  const trips = useAsync<{ trips: TripSummary[] }>(
    (signal) => (whose ? Promise.resolve({ trips: [] }) : api.get('/api/trips', signal)),
    [whose],
  );

  return (
    <Screen>
      {/* 남의 페이지면 막대 제목이 그 사람 이름입니다. */}
      {me?.mine === false ? <Stack.Screen options={{ title: me.name ?? '프로필' }} /> : null}

      {/*
        처음 받는 동안 — 이름이 올 자리를 미리 세웁니다.

        <p>{@link Loading} 이 섰습니다. 점 셋이 돌다가 얼굴과 이름과 숫자 줄과
        띠가 한꺼번에 들어서서, 마이페이지를 열면 화면이 한 번 들썩였습니다.

        <p>{@link Skeleton} 의 첫 칸은 바로 아래 윗머리와 꼴이 같습니다 — 48
        짜리 얼굴 하나에 이름과 한 줄 소개. 셋을 세워 그 아래 숫자 줄과 띠가
        올 만큼까지 잡아 둡니다.
      */}
      {profile.loading && !me ? <Skeleton rows={3} /> : null}
      {profile.error ? <ErrorNote message={profile.error} onRetry={profile.reload} /> : null}

      {me ? (
        <>
          {/*
            누구인지.

            <p>표식을 골라 둔 사람은 그 이모지가, 안 고른 사람은 로고가
            섭니다. 이름의 첫 글자는 쓰지 않습니다 — 「박」이 든 동그라미는
            남의 얼굴과 구별이 안 됩니다.
          */}
          <Row gap={Spacing.s4} style={styles.who}>
            <View style={styles.face}>
              {me.mark ? (
                <Text style={styles.faceEmoji}>{markOf(me.mark)}</Text>
              ) : (
                <LogoSymbol size={34} />
              )}
            </View>
            <Grow gap={Spacing.s1}>
              <Title>{me.name}</Title>
              {/* 한 줄 소개. 내 것인데 비어 있으면 적을 자리라고 알립니다. */}
              {me.bio ? (
                <Body small tone="secondary">
                  {me.bio}
                </Body>
              ) : me.mine ? (
                <Caption tone="muted">한 줄 소개를 적어 보세요</Caption>
              ) : null}
              {/* 가입한 달 대신 기록. 가입한 달은 그 사람에 대해 아무것도 말하지
                  않습니다. */}
              <Caption tone="secondary">
                {me.mine
                  ? `여행 ${me.counts.trips}번 · 함께한 사람 ${me.companions ?? 0}명`
                  : /* 우리 사이 한 줄. 남의 페이지에서 먼저 궁금한 것은 그 사람의 전체가
                       아니라 나와의 관계입니다. */
                    `우리 사이 · 같은 모임 ${me.between?.groups.length ?? 0}개 · 함께한 여행 ${me.between?.trips.length ?? 0}번`}
              </Caption>
            </Grow>
            {me.mine ? (
              <Button label="프로필 편집" variant="secondary" compact onPress={() => setEditing(true)} />
            ) : null}
          </Row>

          {/*
            해 온 것.

            <p>네 숫자를 한 줄에 둡니다. 여행과 글은 「얼마나 다녔나」이고
            리뷰와 모임은 「얼마나 나눴나」입니다 — 둘씩 짝이라 넷을 고르게
            늘어놓습니다.
          */}
          <Row style={styles.counts}>
            <Tally n={me.counts.trips} what="여행" onPress={() => setLane('trips')} />
            <Tally n={me.counts.posts} what="글" onPress={() => setLane('feed')} />
            <Tally n={me.counts.reviews} what="리뷰" onPress={() => setLane('reviews')} />
            <Tally
              n={me.counts.groups}
              what="모임"
              onPress={me.mine ? () => router.push('/(app)/groups') : undefined}
            />
          </Row>

          {me.mine ? <Footprint /> : null}

          <Band />

          <Tabs
            items={[
              { value: 'trips' as Lane, label: '여행기' },
              { value: 'feed' as Lane, label: '피드' },
              { value: 'reviews' as Lane, label: '리뷰' },
              ...(me.mine ? [{ value: 'calendar' as Lane, label: '달력' }] : []),
            ]}
            value={lane}
            onChange={setLane}
          />

          {lane === 'trips' ? (
            me.mine ? (
              /* 아직 안 온 것을 빈 배열로 눌러 넘기지 않습니다 — 그러면 저
                 안에서 「여행이 없다」와 같아집니다. */
              <Journals mine trips={trips.data?.trips ?? null} tripsLoading={trips.loading} />
            ) : (
              <Between between={me.between ?? null} />
            )
          ) : lane === 'calendar' ? (
            /*
              나는 언제 어디 가지.

              <p>혼자 여행과 모든 모임 여행이 한 달력에 섞입니다. 그래서
              모임 이름을 줄에 붙입니다 — 모임 캘린더와 달리 여기서는
              어느 모임 것인지가 안 보이면 「이게 뭐였지」가 됩니다.

              <p>그날 올린 글 수도 여기서만 켭니다({@code onPost}). 세는 것이
              내가 올린 글이라 <b>내 달력</b>에서만 뜻이 있습니다 — 모임
              달력에 적으면 「이 모임에 올린 글」로 읽히는데 그 수가 아닙니다.

              <p>띠가 달력일 때만 이 부품이 섭니다. 여행기나 피드를 보고 있는
              동안은 글 수를 묻는 왕복이 아예 없습니다.
            */
            <>
              <TripCalendar
                trips={trips.data?.trips ?? []}
                showGroup
                onOpen={(t) => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
                onPick={setPicked}
                onPost={(id) => router.push({ pathname: '/feed/[id]', params: { id } })}
              />
              {picked ? <DayDetail iso={picked} trips={trips.data?.trips ?? []} /> : null}
            </>
          ) : lane === 'feed' ? (
            /*
              내 것일 때만 FeedList 를 씁니다.

              <p>그 부품은 「내 피드」(mine=true)를 받아 오고 글을 쓰는
              자리까지 들고 있습니다. 남의 피드를 보는 길은 서버에 아직
              없습니다 — 그룹 없이 올린 글은 올린 사람 것이고, 남에게
              보이려면 어느 모임을 통해 보이는지부터 정해야 합니다.
            */
            /* 남의 피드는 나와 함께 속한 모임에 올린 글만입니다(서버가 거릅니다). */
            me.mine ? <FeedList compact /> : <FeedList authorId={me.id} />
          ) : (
            <MyReviews whose={whose} count={me.counts.reviews} />
          )}

          {/* 내 것에만 붙습니다. 남의 계정 설정을 열 수는 없습니다. */}
          {/*
            설정 묶음.

            <p>「내 계정」 한 줄뿐이었습니다. 알림 · 기기 안에서 처리하기 ·
            보석함이 어디 있는지는 내 계정 안을 열어 봐야 알았습니다. 자주
            찾는 것을 여기 줄로 늘어놓습니다 — 들어가면 같은 설정 화면입니다.
          */}
          {me.mine ? (
            <>
              <Band />
              <ListRow
                left={<Icon name="settings" size={24} tone="secondary" />}
                title="내 계정"
                subtitle={user?.email ?? undefined}
                right={<Icon name="chevron-right" size={20} tone="muted" />}
                onPress={() => router.push('/(app)/settings')}
              />
              <ListRow
                left={<Icon name="bell" size={24} tone="secondary" />}
                title="알림 · 기기 안에서 처리하기"
                right={<Icon name="chevron-right" size={20} tone="muted" />}
                onPress={() => router.push('/(app)/settings')}
              />
              <ListRow
                left={<Icon name="bookmark" size={24} tone="secondary" />}
                title="보석함"
                right={<Icon name="chevron-right" size={20} tone="muted" />}
                last={user?.role !== 'ADMIN'}
                onPress={() => router.push('/(app)/saved')}
              />
              {user?.role === 'ADMIN' ? (
                <ListRow
                  left={<Icon name="users" size={24} tone="secondary" />}
                  title="운영 관리"
                  subtitle="계정 관리 · 감사 로그"
                  right={<Icon name="chevron-right" size={20} tone="muted" />}
                  last
                  onPress={() => router.push('/admin')}
                />
              ) : null}
              <Caption tone="muted">FIT {Constants.expoConfig?.version ?? ''}</Caption>
            </>
          ) : null}

          {me.mine ? (
            <ProfileSheet
              visible={editing}
              profile={me}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                profile.reload();
              }}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}


/** 숫자 하나. */
/**
 * 숫자 하나. 누르면 그 목록으로 갑니다.
 *
 * <p>누를 수 있다는 것을 옅은 회색 면으로 말합니다. 맨 숫자만 있으면 그냥
 * 적힌 값으로 읽혀서 아무도 안 눌렀습니다.
 */
function Tally({ n, what, onPress }: { n: number; what: string; onPress?: () => void }) {
  const body = (
    <>
      <Text style={styles.tallyNum}>{n}</Text>
      <Caption tone="secondary">{what}</Caption>
    </>
  );
  return onPress ? (
    <Press onPress={onPress} scale={0.96} accessibilityLabel={`${what} ${n}`} style={[styles.tally, styles.tallyOn]}>
      {body}
    </Press>
  ) : (
    <View style={styles.tally}>{body}</View>
  );
}

type Reviews = {
  reviews: { placeId: string; name?: string | null; stars?: number | null; text?: string | null; at: string }[];
  unreviewed: { placeId: string; name: string; icon?: string | null }[];
};

/**
 * 남긴 리뷰들 — 장소 이름 · 별 · 한 줄.
 *
 * <p>이름은 서버가 내 일정의 장소에서 같은 구글 번호로 이어 붙여 줍니다.
 * 구글에 묻지 않습니다(MyRecordService). 일정에도 보석함에도 없는 곳이면
 * 「이름 모르는 곳」입니다.
 *
 * <p>아래에 <b>다녀온 곳 중 아직 안 남긴 곳</b>. 누르면 그 자리에서 별을
 * 남깁니다 — 빈 탭을 채우는 길이 그대로 리뷰를 늘리는 길입니다.
 */
function MyReviews({ whose, count }: { whose: string | null; count: number }) {
  const { data, loading, reload } = useAsync<Reviews>(
    (signal) => (whose ? Promise.resolve({ reviews: [], unreviewed: [] }) : api.get('/api/me/reviews', signal)),
    [whose],
  );
  const [tipFor, setTipFor] = useState<{ placeId: string; name: string } | null>(null);
  if (whose) {
    return <Caption tone="secondary">남이 남긴 리뷰는 장소에서 볼 수 있어요.</Caption>;
  }
  const reviews = data?.reviews ?? [];
  const rest = data?.unreviewed ?? [];
  return (
    <>
      <SectionHeader title="내가 남긴 것" tight note={`별점을 준 것 ${count}개`} />

      {/*
        받기 전에 「없어요」라고 적고 있었습니다.

        <h3>길이 0 은 두 가지입니다</h3>

        <p>{@code reviews.length === 0} 하나로 가렸습니다. 그런데 이 부품은 띠를
        옮길 때마다 <b>통째로 새로 섭니다</b> — 띠가 바뀌면 이 함수가 내려가고
        {@link useAsync} 도 처음부터입니다. 그래서 「리뷰」를 누른 직후에는 늘
        {@code data} 가 없고, 그때도 길이는 0 입니다.

        <p>리뷰를 열 개 남긴 사람이 그 칸을 누르면 <b>「장소 상세에서 남긴
        별점과 한 줄이 여기 모여요」</b>가 먼저 한 박자 떴습니다. 바로 위
        머리글이 「별점을 준 것 10개」라고 적고 있는 채로입니다 — 한 화면이 제
        안에서 서로 다른 말을 했습니다. 아직 안 온 것과 없는 것은 다릅니다.

        <p>그래서 <b>받고 나서만</b> 적습니다. 비어 있다는 말은 다 받아 보고
        비었을 때만 할 수 있는 말입니다.

        <p>기다리는 자리에는 회색 칸을 세웁니다. 몇 줄인지는 <b>머리글이 이미
        말한 개수</b>로 정합니다 — 늘 셋을 세우면 리뷰가 하나인 사람에게 셋을
        약속하고, 그 약속이 틀리는 것이 이 화면이 방금 고친 그 잘못입니다.
        하나도 없는 사람에게는 칸도 안 세웁니다.

        <p>리뷰 줄에는 앞에 그림이 없으니 그림 칸은 끕니다.

        <p>못 받아 왔으면 걷힙니다({@code loading} 을 같이 봅니다) — 안 그러면
        회색 칸이 영원히 숨을 쉽니다.
      */}
      {loading && !data && count > 0 ? (
        <Skeleton rows={Math.min(3, count)} thumb={false} />
      ) : null}
      {data && reviews.length === 0 ? (
        <Caption tone="secondary">장소 상세에서 남긴 별점과 한 줄이 여기 모여요.</Caption>
      ) : null}
      {reviews.map((rv, i) => (
        <View key={`${rv.placeId}-${i}`} style={styles.review}>
          <Split>
            <Body strong numberOfLines={1}>
              {rv.name ?? '이름 모르는 곳'}
            </Body>
            {rv.stars ? <Caption tone="brand">{'★'.repeat(rv.stars)}</Caption> : null}
          </Split>
          {rv.text ? <Body small tone="secondary">{rv.text}</Body> : null}
        </View>
      ))}
      <TipReach />

      {rest.length > 0 ? (
        <>
          <SectionHeader title="다녀온 곳 중 아직 안 남긴 곳" tight />
          {rest.map((v, i) => (
            <ListRow
              key={v.placeId}
              left={<Mark icon={glyphOf(v.icon)} />}
              title={v.name}
              right={<Caption tone="brand" strong>별점 남기기</Caption>}
              last={i === rest.length - 1}
              onPress={() => setTipFor({ placeId: v.placeId, name: v.name })}
            />
          ))}
        </>
      ) : null}

      {tipFor ? (
        <TipSheet
          visible
          placeId={tipFor.placeId}
          placeName={tipFor.name}
          onClose={() => {
            setTipFor(null);
            reload();
          }}
          onChanged={reload}
        />
      ) : null}
    </>
  );
}

/**
 * 다녀온 곳 — 끝난 여행에서 일정에 넣었던 곳.
 *
 * <p>도장(다녀옴 표시)은 뺐습니다. 그래서 세는 것은 <b>일정에 넣었던 곳</b>이고,
 * 안 간 곳도 섞입니다. 그 말을 카드에 그대로 적습니다(plan-review Q10).
 * 도시 · 나라 이름은 좌표만으로는 안 나와서 안 셉니다.
 *
 * <p>지도는 누를 때만 폅니다. 마이페이지를 열 때마다 지도를 받으면 그 값이
 * 열 때마다 듭니다.
 */
function Footprint() {
  const router = useRouter();
  const { data } = useAsync<{ places: number; trips: number }>(
    (signal) => api.get('/api/me/visited', signal),
    [],
  );
  if (!data || data.trips === 0) {
    return null;
  }
  return (
    <Press onPress={() => router.push('/(app)/trips')} scale={0.99} style={styles.footprint}>
      <Mark icon="map-pin" />
      <Grow gap={2}>
        <Body strong>{`다녀온 여행 ${data.trips}번 · 일정에 넣었던 곳 ${data.places}곳`}</Body>
        <Caption tone="muted">일정에 넣고 안 간 곳도 함께 세요.</Caption>
      </Grow>
      <Icon name="chevron-right" size={18} tone="muted" />
    </Press>
  );
}

/**
 * 여행기 칸 — 내놓은 여행기와 다녀온 여행.
 *
 * <p>내놓은 것은 둘러보기에서 남이 보는 것이고, 다녀온 것은 나만 보는
 * 영수증입니다. 둘을 한 칸에 둡니다 — 「내가 어디를 다녀왔나」의 두 얼굴입니다.
 */
function Journals({
  mine,
  trips,
  tripsLoading,
}: {
  mine: boolean;
  /**
   * 내 여행 전부. <b>아직 안 받았으면 {@code null} 입니다.</b>
   *
   * <p>빈 배열로 받고 있었습니다. 그러면 여행이 없는 사람과 아직 안 온 것이
   * 이 안에서 같아지고, 실제로 그랬습니다 — 화면이 열릴 때 프로필이 여행
   * 목록보다 먼저 닿으면 이 칸은 다녀온 여행 열 번을 가진 사람에게도
   * <b>「다녀온 여행이 생기면 여기 영수증으로 모여요」</b>를 한 박자 보여
   * 주었습니다.
   *
   * <p>그 둘을 바깥에서 가를 수 있는 쪽은 받아 오는 쪽뿐입니다. 그래서 여기로
   * {@code null} 이 들어옵니다 — 빈 배열로 눌러 두면 이 함수 안에서는 다시
   * 가릴 길이 없습니다.
   */
  trips: TripSummary[] | null;
  /**
   * 그 목록이 아직 오는 중인지.
   *
   * <p>{@code trips == null} 만으로는 <b>오는 중</b>과 <b>못 받아 왔음</b>이
   * 안 갈립니다. 둘을 같이 두면 받아 오기가 실패한 날에 회색 칸이 영원히
   * 숨을 쉽니다 — 기다리는 모양은 기다릴 것이 있을 때만 서야 합니다.
   *
   * <p>실패하면 머리글만 남고 아래가 빕니다. 「없다」고 적지 않는 것이
   * 여기서 중요한 쪽입니다.
   */
  tripsLoading: boolean;
}) {
  const router = useRouter();
  const posted = useAsync<PostPage>(
    (signal) => (mine ? api.get('/api/posts/mine', signal) : Promise.resolve(null as unknown as PostPage)),
    [mine],
  );
  if (!mine) {
    return <Caption tone="secondary">이 사람이 내놓은 여행기는 둘러보기에서 볼 수 있어요.</Caption>;
  }
  const today = todayIso();
  const done = (trips ?? [])
    .filter((t) => t.endIso != null && t.endIso < today)
    .sort((a, b) => (b.endIso ?? '').localeCompare(a.endIso ?? ''));
  const posts = posted.data?.posts ?? [];
  return (
    <>
      {/*
        띠를 옮길 때마다 새로 받습니다.

        <p>이 부품은 띠가 바뀌면 통째로 내려갔다 다시 섭니다. 그래서
        {@code posted} 도 매번 처음부터 받는데, 그동안 이 자리는 아무 말 없이
        비어 있다가 줄들이 한꺼번에 들어섰습니다 — 아래의 「다녀온 여행」이
        그만큼 한 번에 밀려 내려갔습니다.

        <p>둘입니다. 여행기 줄은 앞에 표지가 서므로 그림 칸을 켭니다 —
        {@code journalThumb} 자리입니다.
      */}
      {posted.loading && !posted.data ? <Skeleton rows={2} /> : null}
      {posts.length > 0 ? <SectionHeader title="내놓은 여행기" tight /> : null}
      {posts.map((p, i) => (
        <Press
          key={p.id}
          onPress={() => router.push({ pathname: '/community/[id]', params: { id: p.id } })}
          scale={0.99}
          style={styles.journal}>
          {/*
            썸네일은 제 폭을 모릅니다.

            <p>{@link TripThumb} 의 바탕은 {@code width: '100%'} 입니다 —
            카드로 홀로 서는 자리를 전제로 만든 것이라, 가로 줄에 그냥 놓으면
            <b>줄 폭을 전부 가져갑니다.</b> 옆의 글자 칸은 {@code flex: 1} 이라
            0 까지 밀리고, 그래서 제목이 오른쪽 끝에서 깨져 보였습니다.

            <p>폭을 가진 칸으로 감싸서 그 {@code 100%} 가 <b>이 칸</b>을 가리키게
            둡니다. {@code trip-thumb} 쪽을 고치지 않는 까닭은 그 폭이 카드로
            서는 자리(둘러보기·내 여행)에서는 맞는 값이라서입니다 — 거기를
            고치면 이 한 줄 때문에 여섯 화면이 틀어집니다.

            <p><b>감싸는 칸을 걷으면 다시 깨집니다.</b>
          */}
          <View style={styles.journalThumb}>
            <TripThumb
              postId={p.id}
              coverPhotoId={p.coverPhotoId}
              firstPhotoId={p.firstPhotoId}
              height={64}
              label={p.title}
            />
          </View>
          <Grow gap={2}>
            <Body strong numberOfLines={1}>
              {p.title}
            </Body>
            <Caption tone="muted">
              {[p.region, formatNights(p.dayCount), `${p.placeCount}곳`].filter(Boolean).join(' · ')}
            </Caption>
          </Grow>
        </Press>
      ))}
      <SectionHeader title="다녀온 여행" tight={posts.length === 0} />

      {/*
        여기도 받고 나서만 적습니다.

        <p>{@code done.length === 0} 하나로 가렸습니다. 그런데 여행 목록은
        프로필과 <b>따로</b> 옵니다 — 프로필이 먼저 닿으면 띠와 이 칸이 이미
        서 있고 {@code trips} 는 아직 없습니다. 그때 길이는 0 이라, 다녀온
        여행이 열 번인 사람에게 「생기면 모여요」라고 적고 있었습니다.

        <p>{@code trips} 가 {@code null} 인 동안은 회색 칸입니다. 줄은
        {@link ListRow} 에 {@link Mark} 가 서는 꼴이라 그림 칸을 켭니다.
      */}
      {tripsLoading && trips == null ? <Skeleton rows={2} /> : null}
      {trips != null && done.length === 0 ? (
        <Caption tone="secondary">다녀온 여행이 생기면 여기 영수증으로 모여요.</Caption>
      ) : null}
      {done.map((t, i) => (
        <ListRow
          key={t.id}
          left={<Mark icon="book-open" />}
          title={t.title}
          subtitle={`${formatSpan(t.startIso, t.endIso)} · ${t.placeCount}곳`}
          last={i === done.length - 1}
          onPress={() => router.push({ pathname: '/card/[id]', params: { id: t.id } })}
        />
      ))}
    </>
  );
}

/**
 * 남의 페이지의 여행기 칸 — 우리 사이.
 *
 * <p>그 사람이 다닌 여행 전부가 아니라 <b>함께 속한 모임과 그 모임의 여행</b>
 * 입니다. 그 사람이 다른 모임에서 다닌 것은 그 모임 사람의 것입니다.
 */
function Between({ between }: { between: NonNullable<Profile['between']> | null }) {
  const router = useRouter();
  if (!between) {
    return null;
  }
  return (
    <>
      <SectionHeader title="함께 속한 모임" tight />
      {between.groups.map((g, i) => (
        <ListRow
          key={g.id}
          left={<Mark emoji={g.emoji ?? '🧳'} />}
          title={g.name}
          last={i === between.groups.length - 1}
          onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
        />
      ))}
      <SectionHeader title="함께한 여행" tight />
      {between.trips.length === 0 ? (
        <Caption tone="secondary">아직 같이 짠 여행이 없어요.</Caption>
      ) : null}
      {between.trips.map((t, i) => (
        <ListRow
          key={t.id}
          left={<Mark icon="calendar" />}
          title={t.title}
          subtitle={formatSpan(t.startIso ?? null, t.endIso ?? null)}
          last={i === between.trips.length - 1}
          onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
        />
      ))}
    </>
  );
}

/**
 * 달력에서 누른 날 — 그날 일정 장소와 쓴 돈.
 *
 * <p>달력 쪽은 그날 동선을 그림 한 장으로 보여 줍니다({@code trip-calendar}).
 * 여기 글자는 그 그림이 못 적는 것을 적습니다 — 몇 시에 어디, 그리고 쓴 돈.
 * 둘 중 하나만 두지 않습니다. 그림만으로는 이름을 모르고, 글자만으로는 그것이
 * 한 동네 안인지 알 수 없습니다.
 *
 * <h3>한 날에 여행이 둘일 수 있습니다</h3>
 *
 * <p>혼자 여행과 모든 모임 여행이 한 달력에 섞이므로 같은 날에 둘이 걸칠 수
 * 있습니다. 첫 번째 것만 그렸습니다 — 그런데 달력은 걸치는 여행을 <b>다</b>
 * 줄로 세우니, 줄은 둘인데 아래 글자는 하나였습니다. 걸치는 것을 다 적습니다.
 *
 * <p>여행마다 일정과 가계부를 한 번씩 받습니다. 한 날에 둘이 겹치는 일이
 * 드물고, 겹치는 그 날에만 네 번이 됩니다 — 달력을 여는 값은 그대로입니다.
 */
function DayDetail({ iso, trips }: { iso: string; trips: TripSummary[] }) {
  const on = trips.filter(
    (t) => t.startIso != null && t.startIso <= iso && (t.endIso ?? t.startIso) >= iso,
  );
  return (
    <>
      {on.map((t) => (
        <TripDay key={t.id} iso={iso} trip={t} />
      ))}
    </>
  );
}

/** 그 여행의 그날 — 넣어 둔 곳들과 쓴 돈. */
function TripDay({ iso, trip }: { iso: string; trip: TripSummary }) {
  const detail = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(trip.id)}`, signal),
    [trip.id],
  );
  const spent = useAsync<{ expenses: Spend[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(trip.id)}/expenses`, signal),
    [trip.id],
  );
  const day = detail.data?.days.find((d) => d.iso === iso) ?? null;
  const sums = new Map<string, { sum: number; decimals: number }>();
  for (const e of spent.data?.expenses ?? []) {
    if (day && e.dayId === day.id) {
      const was = sums.get(e.currency) ?? { sum: 0, decimals: e.decimals };
      sums.set(e.currency, { sum: was.sum + e.amount, decimals: e.decimals });
    }
  }
  return (
    <View style={styles.dayDetail}>
      <Caption tone="secondary">{`${trip.title}${day ? ` · ${day.label}` : ''}`}</Caption>
      {/*
        받고 나서만 「없어요」라고 적습니다.

        <p>{@code day} 가 없으면 곧바로 그 말을 적고 있었습니다. 그런데 일정은
        날을 누른 <b>다음에</b> 받으므로, 닿기 전에는 넣어 둔 곳이 다섯인 날도
        {@code day} 가 없습니다 — 누를 때마다 「이날 넣어 둔 곳이 없어요」가
        먼저 한 박자 떴다가 장소들이 들어섰습니다. 비었다는 말은 다 받아 보고
        비었을 때만 할 수 있습니다.

        <p>기다리는 동안은 여행 이름 한 줄만 섭니다. 여기에 {@link Skeleton} 을
        세우지 않는 까닭은 올 것이 <b>글자 두세 줄</b>이라서입니다 — 72 짜리
        회색 칸은 올 것보다 크고, 자리를 맞추려고 세우는 것이 자리를 틀어
        놓습니다.
      */}
      {day && day.places.length > 0 ? (
        day.places.map((pl) => (
          <Body key={pl.id} small>
            {pl.time ? `${pl.time}  ` : ''}
            {pl.name}
          </Body>
        ))
      ) : detail.data ? (
        <Caption tone="muted">이날 넣어 둔 곳이 없어요.</Caption>
      ) : null}
      {sums.size > 0 ? (
        <Caption tone="secondary">
          쓴 돈 {[...sums.entries()].map(([c, t]) => money(t.sum, c, t.decimals)).join(' · ')}
        </Caption>
      ) : null}
    </View>
  );
}

/** 이름과 한 줄 소개 고치기. 얼굴(표식)은 내 계정 화면에서 고릅니다. */
function ProfileSheet({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setFailed(null);
    try {
      await api.patch('/api/me/profile', { name, bio });
      onSaved();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="프로필 편집"
      onClose={onClose}
      footer={<Button label="저장" busy={busy} onPress={save} />}>
      <Field label="이름" value={name} onChangeText={setName} maxLength={80} />
      <Field
        label="한 줄 소개"
        value={bio}
        onChangeText={setBio}
        placeholder="먹으러 다니는 여행러"
        limit={80}
      />
      {failed ? <ErrorNote message={failed} /> : null}
      <Button
        label="지도에 쓰는 얼굴 고르기"
        variant="ghost"
        onPress={() => {
          onClose();
          router.push('/(app)/settings');
        }}
      />
    </BottomSheet>
  );
}

/**
 * 내가 남긴 한 줄이 얼마나 쓰였나.
 *
 * <p>알림함 맨 아래에 있었습니다. 알림은 읽으면 지나가는 것인데 이것은
 * 쌓이는 숫자라, 알림함을 열 때마다 같은 줄을 또 읽었습니다. 「내가 해 온
 * 것」이 모이는 자리가 여기입니다.
 *
 * <p>한 줄도 안 남겼으면 안 그립니다. 0 을 보여 주면 「너는 아무것도 안
 * 했다」가 됩니다(서버가 그때 {@code mine} 을 비워 보냅니다).
 */
function TipReach() {
  const { data } = useAsync<{ mine?: { tipCount: number; viewCount: number } | null }>(
    (signal) => api.get('/api/news', signal),
    [],
  );
  const mine = data?.mine;
  if (!mine) {
    return null;
  }
  return (
    <Body small>
      {mine.viewCount > 0
        ? `남긴 한 줄 ${mine.tipCount}개가 ${mine.viewCount}번 쓰였어요.`
        : `남긴 한 줄 ${mine.tipCount}개. 아직 읽은 사람이 없어요.`}
    </Body>
  );
}


const styles = StyleSheet.create({
  /* 누를 수 있는 숫자. 옅은 회색 면이 「눌린다」를 말합니다. */
  tallyOn: {
    backgroundColor: Colors.fill,
    borderRadius: Radius.r2,
    paddingVertical: Spacing.s2,
  },
  footprint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    padding: Spacing.s3,
    borderRadius: 12,
    backgroundColor: Colors.accentSoft,
  },
  review: {
    gap: 2,
    paddingVertical: Spacing.s2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  journal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    paddingVertical: Spacing.s2,
  },
  /*
    썸네일이 설 칸. 96 × 64 — 3:2 입니다.

    <p>폭을 안 적으면 {@link TripThumb} 의 {@code width: '100%'} 가 줄 전체를
    가리킵니다. 높이 64 에 세로로 길지도 않고, 글자 칸에 240 남짓을 남겨
    제목이 한 줄에 드는 값입니다.
  */
  journalThumb: {
    width: 96,
  },
  dayDetail: {
    gap: Spacing.s1,
    padding: Spacing.s3,
    borderRadius: 12,
    backgroundColor: Colors.fill,
  },
  who: {
    minHeight: 88,
    alignItems: 'center',
  },
  face: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceEmoji: {
    fontSize: 30,
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  counts: {
    paddingVertical: Spacing.s3,
  },
  /*
    갈래를 옮기는 숫자 칸.

    <p>높이를 {@link Tap.min} 으로 묶어 둡니다. 지금 보이는 키는 글꼴의 줄
    높이가 쌓여서 나온 값이라(제목 26 + 2 + 설명 18), <b>아무도 고른 적이
    없는 숫자</b>입니다 — {@code Type} 를 한 단 내리거나 {@code tallyOn} 의
    여백을 걷으면 조용히 44 아래로 내려갑니다. 보이는 모습은 그대로 두고
    바닥만 적어 둡니다.
  */
  tally: {
    flex: 1,
    minHeight: Tap.min,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tallyNum: {
    ...Type.title3,
    color: Colors.text,
  },
});
