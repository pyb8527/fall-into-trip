import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { api } from '@/api/client';
import type {
  News,
  PopularPlace,
  PostPage,
  TripDetail,
  TripSummary,
} from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { PlaceDetailSheet, type Looked } from '@/components/place-detail-sheet';
import { TripMark } from '@/components/trip-mark';
import { TripThumb } from '@/components/trip-thumb';
import { iconOf, labelOf } from '@/constants/place-icons';
import {
  Colors,
  Elevation,
  Gutter,
  MaxContentWidth,
  Radius,
  Spacing,
  Tap,
  Type,
  Weight,
} from '@/constants/theme';
import type { Countdown } from '@/lib/countdown';
import {
  countdownLabel,
  countdownOf,
  daysBetween,
  formatSpan,
  todayIso,
} from '@/lib/countdown';
import {
  Band,
  Button,
  Caption,
  ErrorNote,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Mark,
  Press,
  Row,
  Screen,
  Split,
} from '@/ui';
import { LogoMark } from '@/ui/logo';
import { AppTabs } from '@/ui/tab-bar';

/**
 * 첫 화면.
 *
 * <h3>카드 다섯 장이 같은 무게로 쌓여 있었습니다</h3>
 *
 * <p>회색 바닥 위에 흰 카드가 다섯 장 있었습니다. 다섯이 모두 같은 크기,
 * 같은 모서리, 같은 그림자라서 <b>무엇부터 봐야 하는지</b>가 화면에 안
 * 적혀 있었습니다 — 메뉴판과 내 여행과 남의 여행이 한 줄로 서 있었습니다.
 *
 * <p>맨 위에 <b>히어로 하나</b>를 둡니다. 가장 가까운 여행입니다 — 이 앱을
 * 여는 가장 흔한 까닭이고, 사람들은 여행 전에 날짜를 셉니다. 그 아래는
 * 회색 띠로 가른 구역들이고, 구역끼리는 위에서 아래로 중요한 순서입니다.
 *
 * <p>카드는 <b>눌러서 들어가는 물건</b>에만 남깁니다 — 여행 하나, 남의
 * 여행기 하나. 구역을 담는 상자는 없습니다.
 */
export default function Home() {
  const router = useRouter();
  /* 「지금 뜨는 곳」에서 누른 곳. 판이 이걸로 열립니다. */
  const [looking, setLooking] = useState<Looked | null>(null);
  const { user } = useAuth();

  /* 여행이 하나도 없는 사람에게는 구역만으로 부족합니다. 그 판단에 필요한
     것이 개수 하나뿐이라 목록을 그대로 받아 씁니다. */
  const {
    data: mine,
    error: mineError,
    reload: reloadMine,
  } = useAsync<{ trips: TripSummary[] }>((signal) => api.get('/api/trips', signal), []);

  /*
    소식이 와 있는지.

    숫자는 안 씁니다. 점 하나면 "들어가 볼 것이 있다" 는 말이 되고, 몇
    건인지는 열기 전에 할 일이 아닙니다.

    못 받아 와도 조용히 넘어갑니다 — 첫 화면이 소식 때문에 멈추면, 소식이
    없는 사람에게도 앱이 느려집니다.
  */
  const { data: news } = useAsync<News>((signal) => api.get('/api/news', signal), []);

  /*
    남들이 다녀온 길, 그리고 지금 뜨는 여행지.

    둘 다 로그인 없이 열리는 것이라 갓 들어온 사람에게도 보입니다. 못 받아
    와도 조용히 넘어갑니다 — 구역이 통째로 안 뜰 뿐 홈은 멉니다.
  */
  const { data: shared } = useAsync<PostPage>(
    (signal) => api.get('/api/posts?sort=hot', signal),
    [],
  );
  const { data: top } = useAsync<{ places: PopularPlace[] }>(
    (signal) => api.get('/api/popular/places', signal),
    [],
  );

  /*
    가장 가까운 여행 하나.

    사람들은 여행 전에 날짜를 셉니다. 앱이 없어도 하는 행동이라, 그 답이
    첫 화면에 있으면 그것만으로 열어 볼 이유가 됩니다.

    하나만 답니다. 둘 이상을 세로로 늘어놓으면 그것은 목록이고, 목록은
    「내 여행」 이 이미 하는 일입니다.

    시작일이 이른 것부터 봅니다 — 이미 떠난 여행이 아직 안 떠난 것보다
    앞서므로, 여행 중인 것이 저절로 먼저 잡힙니다.
  */
  const next = useMemo(() => {
    const rows = (mine?.trips ?? [])
      .map((trip) => ({ trip, at: countdownOf(trip.startIso, trip.endIso) }))
      .filter((row): row is { trip: TripSummary; at: Countdown } => row.at !== null);
    rows.sort((a, b) => (a.trip.startIso ?? '').localeCompare(b.trip.startIso ?? ''));
    return rows[0] ?? null;
  }, [mine]);

  /*
    길 위에 있으면 오늘이 어떻게 돼 가는지.

    <p>여행 중일 때만 한 번 더 부릅니다. 목록(`/api/trips`)에는 장소가 없고,
    여행 중인 사람은 하루에 여러 번 여는데 그때 알고 싶은 것이 정확히
    "오늘 몇 곳" 입니다. 여행 중이 아니면 한 번도 안 부릅니다.

    <p>실패해도 조용히 넘어갑니다. 이것 때문에 홈이 멈추면 여행 안 가는
    사람까지 느려집니다.
  */
  const goingId = next?.at.kind === 'going' ? next.trip.id : null;
  const { data: today } = useAsync<TripDetail | null>(
    (signal) =>
      goingId
        ? api.get(`/api/trip?trip=${encodeURIComponent(goingId)}`, signal)
        : Promise.resolve(null),
    [goingId],
  );

  /** 오늘 갈 곳이 몇 군데인지. 여행 사이의 빈 날이면 비어 있습니다. */
  const todayCount = useMemo(() => {
    if (!today) {
      return null;
    }
    const day = today.days.find((d) => d.iso === todayIso()) ?? null;
    return day && day.places.length > 0 ? day.places.length : null;
  }, [today]);

  /*
    히어로에 이미 선 여행은 아래 목록에서 뺍니다.

    <p>같은 제목에 같은 배지가 한 화면에 두 번 있으면 둘 중 무엇이 진짜인지
    잠깐 헷갈리고, 무엇보다 자리가 아깝습니다.

    <p>가장 최근에 만든 것부터 봅니다 — 서버는 만든 차례대로 주므로 뒤에서
    자릅니다. 마흔 개를 가진 사람에게 삼 년 전 여행부터 보여 줄 이유가
    없습니다.
  */
  const rest = useMemo(() => {
    const all = mine?.trips ?? [];
    return all.filter((t) => t.id !== next?.trip.id).reverse();
  }, [mine, next]);

  /*
    혼자 짠 것과 모임 것을 가릅니다.

    <p>섞어 놓으면 어느 것이 나만 보는 것이고 어느 것이 모임 사람들에게도
    보이는 것인지 알 수 없습니다. 그 둘은 <b>고치면 누가 보는가</b>가 달라서,
    섞여 있으면 안 됩니다.

    <p>모임 것은 가로로 흘립니다. 세로로 두 묶음을 쌓으면 홈이 그만큼
    길어지고, 홈이 목록이 되면 홈이 아닙니다.
  */
  const crew = useMemo(() => rest.filter((t) => t.groupId != null).slice(0, 6), [rest]);
  const solo = useMemo(() => rest.filter((t) => t.groupId == null).slice(0, 3), [rest]);

  return (
    /*
      로고와 단추 줄은 고정합니다.

      <p>굴러가는 본문 안에 있었습니다. 그래서 목록을 조금만 내려도 로고가
      화면 밖으로 나가고, 찾기·소식이 <b>어느 화면에도 없는 것</b>이
      되었습니다 — 다시 맨 위로 올라와야 눌렀습니다.
    */
    <Screen
      safeTop
      tabs={<AppTabs />}
      header={
        <Split>
          {/* 줄 높이는 그 안에서 가장 큰 것이 정합니다. 로고는 막대 안에서
              22 입니다 — 더 키우면 막대가 그만큼 높아집니다. */}
          <LogoMark size={22} />
          {/*
            오른쪽에 둘입니다.

            <p>셋이었습니다 — 찾기·소식·내 계정. 막대에 그림이 셋 서면
            어느 것도 안 읽히고, 그중 <b>내 계정은 하루에 한 번도 안
            누르는 것</b>입니다. 그것은 아래 「내 계정」 줄로 내려보냈습니다.
          */}
          <Row gap={Spacing.s1}>
            {/* 찾기가 화면마다 흩어져 있었습니다 — 장소는 여행 안에서,
                남의 일정은 둘러보기에서. 여행을 짜기 전에 하는 일이라
                홈에서 바로 닿아야 합니다. */}
            <IconButton
              name="search"
              label="찾기"
              bare
              onPress={() => router.push('/(app)/search')}
            />
            <IconButton
              name="bell"
              label={news?.unseen ? `알림 ${news.unseen}건` : '알림'}
              dot={!!news?.unseen}
              bare
              onPress={() => router.push('/(app)/news')}
            />
          </Row>
        </Split>
      }>
      {/*
        히어로 — 가장 가까운 여행.

        <p>여기만 사진(동선 그림)이 깔립니다. 화면에 한 장이면 그것이 무엇을
        보라는 말인지가 분명하고, 둘이 되면 둘 다 장식이 됩니다.
      */}
      {/*
        아직 못 받았으면 빈자리로 두지 않습니다.

        <p>여행 목록이 오기 전에는 이 자리가 통째로 비어서, 홈을 열면
        <b>「지금 뜨는 곳」부터</b> 시작하는 화면이 한 박자 보였습니다 —
        내 것이 하나도 없는 화면입니다.

        <p>못 받아 왔으면 그렇다고 말하고 다시 받을 길을 줍니다. 조용히
        비워 두면 여행이 없는 것과 못 받아 온 것이 같아 보입니다.
      */}
      {mineError ? (
        <ErrorNote message={mineError} onRetry={reloadMine} />
      ) : next ? (
        <Hero
          trip={next.trip}
          at={next.at}
          todayCount={todayCount}
          onPress={() => router.push(`/trip/${next.trip.id}`)}
        />
      ) : mine ? (
        <FirstSteps />
      ) : (
        <Loading />
      )}

      {/*
        히어로 아래 바로가기.

        <p>여행 안에 들어가서 아래 갈래 띠로 옮겨야 닿던 것들입니다. 길 위에
        있는 사람이 하루에 몇 번씩 가는 자리라 한 번에 닿는 편이 맞습니다.

        <p>「챙길 것」과 「공유」는 아직 여행 안에서만 열립니다 — 바깥에서
        가리킬 주소가 없어서 넣지 않았습니다. 주소가 생기면 여기 붙습니다.
      */}
      {next ? (
        <Row gap={Spacing.s2} style={styles.shortcuts}>
          <Shortcut
            icon="thumbs-up"
            label="가고 싶은 곳"
            onPress={() => router.push({ pathname: '/vote/[id]', params: { id: next.trip.id } })}
          />
          <Shortcut
            icon="credit-card"
            label="가계부"
            onPress={() => router.push({ pathname: '/money/[id]', params: { id: next.trip.id } })}
          />
          <Shortcut
            icon="book-open"
            label="여행 요약"
            onPress={() => router.push({ pathname: '/card/[id]', params: { id: next.trip.id } })}
          />
        </Row>
      ) : null}

      {crew.length > 0 ? (
        <>
          <Band />
          <SectionHead title="모임 여행" action="전체보기" onAction={() => router.push('/(app)/trips')} />
          <Carousel>
            {(cardWidth) =>
              crew.map((trip) => (
                <Press
                  key={trip.id}
                  onPress={() => router.push(`/trip/${trip.id}`)}
                  scale={0.98}
                  accessibilityLabel={`${trip.title} 열기`}
                  style={[styles.tripCard, { width: cardWidth }]}>
                  <Row gap={Spacing.s3}>
                    <TripMark theme={trip.theme} emoji={trip.emoji} />
                    <View style={styles.grow}>
                      {/* 어느 모임의 것인지가 이 칸의 뜻입니다. 제목보다
                          먼저 둡니다 — 같은 이름의 여행이 둘일 수 있어도
                          모임은 안 겹칩니다. */}
                      <Caption tone="muted" numberOfLines={1}>
                        {trip.groupName ?? '모임'}
                      </Caption>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {trip.title}
                      </Text>
                      <Caption tone="muted" numberOfLines={1}>
                        {[formatSpan(trip.startIso, trip.endIso), `${trip.placeCount}곳`]
                          .filter(Boolean)
                          .join(' · ')}
                      </Caption>
                    </View>
                  </Row>
                </Press>
              ))
            }
          </Carousel>
        </>
      ) : null}

      {solo.length > 0 ? (
        <>
          <Band />
          <SectionHead title="내 여행" action="전체보기" onAction={() => router.push('/(app)/trips')} />
          {solo.map((trip) => {
            const at = countdownOf(trip.startIso, trip.endIso);
            return (
              <ListRow
                key={trip.id}
                left={<TripMark theme={trip.theme} emoji={trip.emoji} />}
                title={trip.title}
                subtitle={[formatSpan(trip.startIso, trip.endIso), `${trip.placeCount}곳`]
                  .filter(Boolean)
                  .join(' · ')}
                right={
                  at ? (
                    <DayBadge label={countdownLabel(at)} />
                  ) : (
                    <Icon name="chevron-right" size={20} tone="muted" />
                  )
                }
                onPress={() => router.push(`/trip/${trip.id}`)}
              />
            );
          })}
        </>
      ) : null}

      {/*
        남이 짜 둔 여행.

        <p>「다양한 경험들」 이라고 적어 두었습니다. 무엇이 있는지는 말하는데
        <b>왜 봐야 하는지</b>는 안 말합니다. 여기 있는 것은 남의 여행이고,
        보는 사람이 얻는 것은 <b>내 여행의 밑그림</b>입니다.
      */}
      {shared && shared.posts.length > 0 ? (
        <>
          <Band />
          <SectionHead
            title="이런 여행은 어때요?"
            action="전체보기"
            onAction={() => router.push('/community')}
          />
          <Carousel>
            {(cardWidth) =>
              shared.posts.slice(0, 6).map((post) => (
                <Press
                  key={post.id}
                  onPress={() => router.push(`/community/${post.id}`)}
                  scale={0.98}
                  accessibilityLabel={`${post.title} 보기`}
                  style={[styles.postCard, { width: cardWidth }]}>
                  <TripThumb
                    postId={post.id}
                    height={Math.round((cardWidth * 9) / 16)}
                    label={post.title}
                  />
                  <View style={styles.postText}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {post.title}
                    </Text>
                    <Caption tone="muted" numberOfLines={1}>
                      {[post.region, `${post.dayCount}일`, `${post.placeCount}곳`]
                        .filter(Boolean)
                        .join(' · ')}
                      {post.likeCount > 0 ? ` · ♥ ${post.likeCount}` : ''}
                    </Caption>
                  </View>
                </Press>
              ))
            }
          </Carousel>
        </>
      ) : null}

      {/*
        지금 뜨는 곳.

        <p>순위는 위아래로 견주며 읽는 것이라 한 자리에 붙어 있어야 합니다.
        줄마다 카드로 떼어 놓으면 1위와 5위가 서로 다른 것처럼 보입니다.

        <p>다섯 줄만 냅니다. 나머지와 갈래별로 거르는 것은 저쪽 화면이 하고,
        홈은 있다는 것만 알립니다.
      */}
      {top && top.places.length > 0 ? (
        <>
          <Band />
          <SectionHead title="지금 뜨는 곳" />
          {top.places.slice(0, 5).map((place, i) => {
            /*
              누르면 그 곳이 어떤 데인지 봅니다.

              <p>좌표가 없으면 안 엽니다. 판이 하는 일의 절반이 지도와
              영업시간인데, 그 둘이 다 좌표에서 나옵니다.
            */
            const canLook = place.lat != null && place.lng != null;
            return (
              <ListRow
                key={place.key}
                left={
                  <Row gap={Spacing.s3}>
                    {/* 1~3위만 브랜드색입니다. 다 물들이면 순위가 아니라
                        색칠이 되고, 위에서 세 번째까지가 사람들이 실제로
                        눈여겨보는 자리입니다. */}
                    <Text style={[styles.rank, i < 3 ? styles.rankTop : null]}>{i + 1}</Text>
                    <Mark emoji={iconOf(place.icon)} fallback="📍" />
                  </Row>
                }
                title={place.name}
                subtitle={[labelOf(place.icon), `여행 ${place.posts}개에 담김`]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={
                  canLook
                    ? () =>
                        setLooking({
                          name: place.name,
                          lat: place.lat as number,
                          lng: place.lng as number,
                          placeId: place.placeId,
                          icon: place.icon,
                        })
                    : () => router.push('/(app)/popular')
                }
              />
            );
          })}
          <View style={styles.more}>
            <Button
              label="더 보러가기"
              variant="secondary"
              onPress={() => router.push('/(app)/popular')}
            />
          </View>
        </>
      ) : null}

      {/*
        내 계정과 운영은 맨 아래입니다.

        <p>여행을 짜는 것들과 같은 자리에 두면 같은 무게로 읽힙니다. 둘 다
        쓸 일이 있을 때 찾아 내려오는 것이고, 특히 운영은 운영자에게만
        보입니다.
      */}
      <Band />
      <ListRow
        left={<Icon name="settings" size={24} tone="secondary" />}
        title="내 계정"
        subtitle={user?.name ?? undefined}
        right={<Icon name="chevron-right" size={20} tone="muted" />}
        onPress={() => router.push('/(app)/settings')}
      />
      {user?.role === 'ADMIN' ? (
        <ListRow
          left={<Icon name="users" size={24} tone="secondary" />}
          title="운영 관리"
          subtitle="계정 관리 · 감사 로그"
          right={<Icon name="chevron-right" size={20} tone="muted" />}
          onPress={() => router.push('/admin')}
        />
      ) : null}

      <PlaceDetailSheet place={looking} onClose={() => setLooking(null)} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ 조각 */

/**
 * 구역의 이름.
 *
 * <p>오른쪽의 「전체보기」는 큰 단추가 아니라 작은 글자입니다. 이 구역에서
 * 가장 굵은 것은 그 안의 여행 이름들이어야 합니다 — 전에는 카드 안 맨
 * 아래에 큰 단추로 두어, 제일 안 중요한 것이 제일 커 보였습니다.
 */
function SectionHead({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Split align="baseline" style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Press
          onPress={onAction}
          hitSlop={Spacing.s3}
          scale={0.96}
          accessibilityLabel={`${title} ${action}`}
          style={styles.sectionAction}>
          <Text style={styles.sectionActionLabel}>{action}</Text>
          <Icon name="chevron-right" size={16} tone="muted" />
        </Press>
      ) : null}
    </Split>
  );
}

/**
 * 가로로 흘리는 띠.
 *
 * <h3>카드 폭을 화면에서 뺍니다</h3>
 *
 * <p>184·208 로 못박아 두었습니다. 그래서 좁은 폰에서는 다음 카드가 반쯤
 * 보이고 넓은 화면에서는 세 장이 어중간하게 섰습니다. 화면 폭에서 여백과
 * <b>다음 카드가 비칠 만큼</b>을 빼면 어느 기기에서나 같은 모양이 됩니다.
 *
 * <p>다음 카드가 48 보입니다. 아예 안 보이면 더 있는지 모르고, 반쯤 보이면
 * 잘린 것처럼 보입니다.
 */
function Carousel({ children }: { children: (cardWidth: number) => React.ReactNode }) {
  const { width } = useWindowDimensions();
  /* 넓은 화면에서는 본문 폭이 묶여 있습니다. 그 안에서 재야 카드가 본문
     밖으로 나가지 않습니다. */
  const inner = Math.min(width, MaxContentWidth);
  const cardWidth = Math.max(160, inner - Gutter - 48);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.strip}
      /* 손을 떼면 카드가 자리에 붙습니다. 어중간하게 멈춰 있으면 지금 보고
         있는 것이 어느 카드인지 모릅니다. */
      snapToInterval={cardWidth + Spacing.s3}
      decelerationRate="fast">
      {children(cardWidth)}
    </ScrollView>
  );
}

/**
 * 가장 가까운 여행 한 장.
 *
 * <h3>왜 이것만 큰가</h3>
 *
 * <p>홈에서 가장 흔한 일이 이 여행을 여는 것입니다. 목록의 한 줄로 두면
 * 다른 줄들과 같은 무게가 되어, 가장 자주 하는 일이 가장 찾기 어려운
 * 자리에 놓입니다.
 *
 * <p>동선 그림을 깔고 아래쪽을 어둡게 덮어 흰 글씨를 얹습니다. 그림이
 * 밝은 데서 끝나면 글씨가 안 읽히므로, 덮개는 그림이 어떻든 같은 어둡기를
 * 만들어 줍니다.
 */
function Hero({
  trip,
  at,
  todayCount,
  onPress,
}: {
  trip: TripSummary;
  at: Countdown;
  /** 오늘 갈 곳 수. 길 위에 있을 때만 있습니다. */
  todayCount: number | null;
  onPress: () => void;
}) {
  const going = at.kind === 'going';
  const nth = going && trip.startIso ? daysBetween(trip.startIso, todayIso()) + 1 : 0;

  return (
    <Press
      onPress={onPress}
      scale={0.98}
      accessibilityLabel={`${trip.title} 열기`}
      style={styles.hero}>
      <View style={styles.heroArt}>
        <TripThumb tripId={trip.id} height={HERO_HEIGHT} label={trip.title} />
      </View>

      {/*
        아래쪽을 어둡게.

        <p>참 그라데이션을 쓰려면 꾸러미를 하나 더 들여야 합니다. 투명도가
        다른 층 넷을 쌓으면 눈에는 같은 것으로 보입니다 — 아래가 가장
        어둡고 위로 갈수록 묽습니다.
      */}
      <View pointerEvents="none" style={styles.heroShade}>
        <View style={[styles.heroShadeBand, styles.heroShade1]} />
        <View style={[styles.heroShadeBand, styles.heroShade2]} />
        <View style={[styles.heroShadeBand, styles.heroShade3]} />
        <View style={[styles.heroShadeBand, styles.heroShade4]} />
      </View>

      <View style={styles.heroTop}>
        <DayBadge label={going ? `여행 중 ${nth}일째` : countdownLabel(at)} />
      </View>

      <View style={styles.heroFoot}>
        <View style={styles.grow}>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {trip.title}
          </Text>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {[
              formatSpan(trip.startIso, trip.endIso),
              going && todayCount ? `오늘 ${todayCount}곳` : `${trip.placeCount}곳`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {/* 눌러서 들어가는 것이라고 말하는 동그라미. 줄 끝의 꺽쇠가 하는
            일을 사진 위에서는 흰 동그라미가 합니다. */}
        <View style={styles.heroGo}>
          <Icon name="chevron-right" size={20} />
        </View>
      </View>
    </Press>
  );
}

/**
 * 며칠 남았는지.
 *
 * <p>노랑은 「지금 · 곧」을 가리키는 자리에만 씁니다 — 심볼의 노란 알약이
 * 「일정 칸에 들어가는 한 자리」를 뜻하는 데서 왔습니다. 노란 면 위의
 * 글자는 늘 먹색입니다(흰 바탕에서 노랑은 대비가 1.6:1 입니다).
 *
 * <p>공용 배지를 안 씁니다. 공용 배지에는 아직 노란 종류가 없고, 옅은
 * 노랑에 노란 글씨가 되어 아무것도 안 읽힙니다. 부품에 그 종류가 생기면
 * 이것은 지웁니다.
 */
function DayBadge({ label }: { label: string }) {
  return (
    <View style={styles.dayBadge}>
      <Text style={styles.dayBadgeLabel}>{label}</Text>
    </View>
  );
}

/** 히어로 아래 동그라미 넷 중 하나. */
function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: 'thumbs-up' | 'credit-card' | 'book-open';
  label: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      scale={0.96}
      accessibilityLabel={label}
      style={styles.shortcut}>
      <View style={styles.shortcutDisc}>
        <Icon name={icon} size={24} tone="secondary" />
      </View>
      <Caption tone="secondary" numberOfLines={1}>
        {label}
      </Caption>
    </Press>
  );
}

/**
 * 아직 아무것도 없는 사람에게, 어디서 시작하는지.
 *
 * <p>히어로가 설 자리에 대신 섭니다. 그 자리를 비워 두면 화면이 「지금 뜨는
 * 곳」부터 시작하는데, 그러면 갓 가입한 사람의 홈에 <b>자기 것이 하나도</b>
 * 없습니다.
 */
function FirstSteps() {
  const router = useRouter();

  return (
    <View style={styles.firstSteps}>
      <Text style={styles.cardTitle}>어디서 시작할까요?</Text>
      <Caption tone="secondary">
        날짜와 도시만 정하면 나머지는 다니면서 채워도 돼요.
      </Caption>
      <View style={styles.firstStepRows}>
        <ListRow
          left={<Icon name="calendar" size={24} tone="brand" />}
          title="첫 여행 만들기"
          right={<Icon name="chevron-right" size={20} tone="muted" />}
          onPress={() => router.push('/(app)/trips?new=1')}
        />
        <ListRow
          left={<Icon name="compass" size={24} tone="secondary" />}
          title="남의 길 구경하기"
          right={<Icon name="chevron-right" size={20} tone="muted" />}
          onPress={() => router.push('/community')}
        />
      </View>
    </View>
  );
}

/** 히어로의 높이. 그림과 덮개가 같은 값을 봐야 합니다. */
const HERO_HEIGHT = 200;

const styles = StyleSheet.create({
  /* 가로로 흘리는 것은 여백 밖으로 나가고, 안쪽 여백은 내용이 가집니다 —
     그래야 첫 카드가 왼쪽 20 선에 맞고 마지막 카드가 끝까지 흘러갑니다. */
  bleed: {
    marginHorizontal: -Gutter,
  },
  strip: {
    paddingHorizontal: Gutter,
    gap: Spacing.s3,
  },

  sectionHead: {
    paddingBottom: Spacing.s1,
  },
  sectionTitle: {
    ...Type.title2,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionActionLabel: {
    ...Type.caption,
    fontSize: 14,
    fontWeight: Weight.medium,
    color: Colors.textMuted,
  },

  /* ------------------------------------------------------------ 히어로 */
  hero: {
    height: HERO_HEIGHT,
    borderRadius: Radius.r4,
    overflow: 'hidden',
    backgroundColor: Colors.fill,
    justifyContent: 'space-between',
  },
  heroArt: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  /* 덮개는 아래 절반만 먹습니다. 위까지 덮으면 그림이 안 보입니다. */
  heroShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.6,
    justifyContent: 'flex-end',
  },
  heroShadeBand: {
    height: '25%',
  },
  heroShade1: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  heroShade2: {
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  heroShade3: {
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  heroShade4: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  heroTop: {
    flexDirection: 'row',
    padding: Spacing.s4,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.s3,
    padding: Spacing.s4,
  },
  heroTitle: {
    ...Type.display,
    fontWeight: Weight.bold,
    color: Colors.onAccent,
  },
  heroMeta: {
    ...Type.body2,
    color: Colors.onAccent,
  },
  heroGo: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 「지금 · 곧」을 가리키는 노란 표. */
  dayBadge: {
    height: 20,
    paddingHorizontal: Spacing.s2,
    borderRadius: Radius.r1,
    backgroundColor: Colors.hot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeLabel: {
    ...Type.micro,
    fontWeight: Weight.semibold,
    color: Colors.onHot,
  },

  /* ---------------------------------------------------------- 바로가기 */
  shortcuts: {
    flexWrap: 'nowrap',
    paddingTop: Spacing.s3,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.s1,
    minHeight: Tap.min,
  },
  shortcutDisc: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ------------------------------------------------------------ 카드들 */
  /*
    가로로 흘리는 여행 카드.

    <p>눌러서 들어가는 물건이라 카드입니다. 바닥이 흰색이므로 테두리 대신
    옅은 그림자로 떠 있게 합니다.
  */
  tripCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.r3,
    padding: Spacing.s4,
    ...Elevation.card,
  },
  postCard: {
    gap: Spacing.s3,
  },
  postText: {
    gap: 2,
  },
  cardTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  grow: {
    flex: 1,
  },

  /* 순위 번호. 한 자리든 두 자리든 이름이 같은 자리에서 시작해야 합니다. */
  rank: {
    ...Type.headline,
    fontWeight: Weight.bold,
    color: Colors.textDisabled,
    width: 18,
    textAlign: 'center',
  },
  rankTop: {
    color: Colors.accentInk,
  },
  more: {
    paddingTop: Spacing.s3,
  },

  /* 아직 아무것도 없는 사람의 첫 칸. 면 카드입니다 — 눌러서 들어가는
     물건이 아니라 안내입니다. */
  firstSteps: {
    backgroundColor: Colors.fill,
    borderRadius: Radius.r4,
    padding: Spacing.s5,
    gap: Spacing.s1,
  },
  firstStepRows: {
    paddingTop: Spacing.s3,
  },
});
