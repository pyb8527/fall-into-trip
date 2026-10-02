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
  TripSummary,
} from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { markOf } from '@/constants/user-marks';
import { PlaceDetailSheet, type Looked } from '@/components/place-detail-sheet';
import { HomeHero, type HeroPhase } from '@/components/home-hero';
import { TripThumb } from '@/components/trip-thumb';
import { glyphOf, labelOf } from '@/constants/place-icons';
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
  countdownOf,
  daysBetween,
  formatNights,
  todayIso,
} from '@/lib/countdown';
import {
  Badge,
  Band,
  Button,
  Caption,
  Chip,
  ErrorNote,
  Grow,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Mark,
  Press,
  Row,
  Screen,
  SectionHeader,
  Split,
} from '@/ui';
import { CardGap, useCardColumns } from '@/ui/layout';
import { LogoInline, LogoSymbol } from '@/ui/logo';
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
  const { data: regions } = useAsync<{ regions: string[] }>(
    (signal) => api.get('/api/posts/regions', signal),
    [],
  );

  /* 지금 뜨는 곳에서 바로 담은 것. 다시 누르면 또 담기지 않게 표만 해 둡니다. */
  const [kept, setKept] = useState<Set<string>>(new Set());
  async function keep(place: PopularPlace) {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    if (kept.has(place.key) || place.lat == null || place.lng == null) {
      return;
    }
    try {
      await api.post('/api/saved', {
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId,
        icon: place.icon,
      });
      setKept((was) => new Set(was).add(place.key));
    } catch {
      /* 못 담았으면 표를 안 바꿉니다. 단추가 그대로라 다시 누를 수 있습니다. */
    }
  }

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
    다녀온 지 일주일 안의 여행.

    <p>그때가 영수증을 보고 여행기로 남길 때입니다. 일주일이 지나면 그 일을
    안 합니다 — 근거 없이 고른 기간이라 써 보고 고칩니다.
  */
  const back = useMemo(() => {
    const today = todayIso();
    return (
      (mine?.trips ?? [])
        .filter((t) => t.endIso != null && t.endIso < today && daysBetween(t.endIso, today) <= 7)
        .sort((a, b) => (b.endIso ?? '').localeCompare(a.endIso ?? ''))[0] ?? null
    );
  }, [mine]);

  /*
    맨 위 카드에 무엇을 세울지 — 여행 중 → 다녀온 지 일주일 → 다가오는 것.

    <p>떠난 여행이 있으면 그것이 먼저입니다. 다녀온 여행은 다가오는 것보다
    앞섭니다 — 다음 여행은 아직 시간이 있고, 여행기는 기억이 남은 동안에만
    씁니다.
  */
  const hero: { trip: TripSummary; at: Countdown | null; phase: HeroPhase } | null =
    next?.at.kind === 'going'
      ? { trip: next.trip, at: next.at, phase: 'going' }
      : back
        ? { trip: back, at: null, phase: 'after' }
        : next
          ? { trip: next.trip, at: next.at, phase: 'before' }
          : null;


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
          {/*
            갈래 화면 넷이 같은 머리로 섭니다 — 왼쪽에 이 화면의 이름, 오른쪽에
            그림 단추. 다른 셋은 그 자리에 큰 제목(「내 여행」·「모임」·「저장」)이
            서고, 홈만 이름 대신 로고입니다. 홈은 앱의 첫 화면이라 「홈」이라고
            적는 것이 아무 말도 안 하고, 로고가 그 자리에서 이름 노릇을 합니다.

            <p>줄 높이는 그 안에서 가장 큰 것이 정합니다. 로고는 막대 안에서
            22 입니다 — 더 키우면 막대가 그만큼 높아집니다.
          */}
          <Grow>
            <LogoInline size={22} />
          </Grow>
          {/*
            오른쪽에 찾기·소식, 그리고 얼굴.

            <h3>한 번 내려보냈다가 되돌립니다</h3>

            <p>처음엔 셋이었습니다 — 찾기·소식·설정(⚙). 「막대에 그림이 셋
            서면 어느 것도 안 읽히고, 설정은 하루에 한 번도 안 누른다」가
            까닭이어서, 홈 맨 아래 「내 계정」 줄로 내려보냈습니다.

            <p>그 진단은 <b>⚙ 에 대해서는</b> 맞았습니다. 그런데 내려보낸
            자리가 틀렸습니다 — 홈 맨 아래는 띠 다섯 개를 지나야 닿는
            자리입니다. 제 계정에 가려고 남의 추천 여행과 인기 장소를 훑어
            내려가야 했습니다. 넓은 화면에서는 왼쪽 기둥 아래에 프로필 줄이
            서 있어서, <b>폰에서만</b> 그렇게 멀었습니다.

            <p>얼굴로 되돌립니다. ⚙ 는 다른 두 그림과 같은 선 그림이라 셋이
            섞였지만, 얼굴은 동그란 면에 든 이모지라 <b>그림이 아니라
            사람</b>으로 읽힙니다 — 셋이 서도 묻히지 않습니다. 「나」로 가는
            자리가 「나」 처럼 생긴 것은 어디서나 그렇습니다.
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
            {/*
              마이페이지로 가는 자리.

              <p>표식을 골라 둔 사람은 그 이모지가, 안 고른 사람은 로고가
              섭니다. 이름의 첫 글자를 쓰지 않습니다 — 「박」 이 든 동그라미는
              남의 얼굴과 구별이 안 되고, 이 앱에는 이미 표식을 고르는
              자리가 있습니다(내 계정 → 내 표식).
            */}
            <Press
              onPress={() => router.push('/(app)/me')}
              accessibilityLabel="내 계정"
              hitSlop={Tap.compactSlop}
              style={styles.face}>
              {user?.mark ? (
                <Text style={styles.faceEmoji}>{markOf(user.mark)}</Text>
              ) : (
                <LogoSymbol size={20} />
              )}
            </Press>
          </Row>
        </Split>
      }>
      {/*
        히어로와 그 아래 바로가기는 <b>한 구역</b>입니다.

        <p>둘을 화면의 직접 자식으로 두면 사이에 화면 기본 간격이 한 번 더
        끼어, 바로가기가 히어로에 딸린 것이 아니라 제 구역처럼 떠 보였습니다.
        한 칸에 넣으면 간격을 안쪽에서 정합니다.
      */}
      <View>
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
        ) : hero ? (
          <HomeHero trip={hero.trip} at={hero.at} phase={hero.phase} />
        ) : mine ? (
          <FirstSteps />
        ) : (
          <Loading />
        )}
      </View>

      {/*
        구역 하나를 한 칸에 담습니다.

        <p>띠와 머리와 내용을 화면의 직접 자식으로 늘어놓았더니, 그 사이마다
        화면 기본 간격이 끼어 띠 아래가 쓸데없이 벌어졌습니다. 한 칸에 넣으면
        여백은 띠와 머리가 가진 것만 남습니다.
      */}
      {/*
        모임 소식.

        <p>소식은 알림 화면에만 있었습니다. 들어가 보지 않으면 모임에서 누가
        무엇을 했는지 몰랐습니다 — 같이 쓰는 앱인데 홈은 혼자 쓰는 앱처럼
        보였습니다. 맨 위 세 줄을 여기 둡니다.

        <p>그 아래 「모임 여행」과 「내 여행」 목록이 있었습니다. 둘 다 아래 띠의
        「내 여행」이 하는 일이라 걷었습니다 — 홈이 목록이 되면 홈이 아닙니다.
      */}
      {news && news.items.length > 0 ? (
        <View>
          <Band />
          <SectionHeader
            tight
            title="모임 소식"
            action={<SeeAll what="모임 소식" onPress={() => router.push('/(app)/news')} />}
          />
          {news.items.slice(0, 3).map((item, i, rows) => (
            <ListRow
              key={`${item.at}-${i}`}
              title={item.actorName ? `${item.actorName} 님이 ${item.text}` : item.text}
              subtitle={item.tripTitle ?? undefined}
              last={i === rows.length - 1}
              onPress={() => router.push(item.url as never)}
            />
          ))}
        </View>
      ) : null}

      {/*
        남이 짜 둔 여행.

        <p>「다양한 경험들」 이라고 적어 두었습니다. 무엇이 있는지는 말하는데
        <b>왜 봐야 하는지</b>는 안 말합니다. 여기 있는 것은 남의 여행이고,
        보는 사람이 얻는 것은 <b>내 여행의 밑그림</b>입니다.
      */}
      {shared && shared.posts.length > 0 ? (
        <View>
          <Band />
          <SectionHeader
            tight
            title="이런 여행은 어때요?"
            action={<SeeAll what="남이 짜 둔 여행" onPress={() => router.push('/community')} />}
          />
          {/* 지역 칩. 여행기가 몇 장 없을 때도 어디로 갈지 고를 길이 하나
              더 있습니다. 누르면 둘러보기가 그 지역으로 걸러 열립니다. */}
          {(regions?.regions.length ?? 0) > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.regionRow}>
              {regions?.regions.slice(0, 8).map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={false}
                  onPress={() => router.push({ pathname: '/community', params: { region: r } })}
                />
              ))}
            </ScrollView>
          ) : null}
          <Carousel count={Math.min(6, shared.posts.length)}>
            {(cardWidth) =>
              shared.posts.slice(0, 6).map((post) => (
                <Press
                  key={post.id}
                  onPress={() => router.push(`/community/${post.id}`)}
                  scale={0.98}
                  accessibilityLabel={`${post.title} 보기`}
                  style={[styles.postCard, { width: cardWidth }]}>
                  {/* 글쓴이가 표지를 골랐으면 그것이 먼저입니다. 안 넘기면
                      고른 것이 아무 데도 안 쓰이고, 대신 구글 지도를 한 번
                      더 부릅니다. */}
                  <TripThumb
                    postId={post.id}
                    coverPhotoId={post.coverPhotoId}
                    height={Math.round((cardWidth * 9) / 16)}
                    label={post.title}
                  />
                  <View style={styles.postText}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {post.title}
                    </Text>
                    {/* 「3박 4일」 「일본」 같은 꼬리표가 고르는 데 가장 빠릅니다.
                        작은 숫자(♥ 1)는 뺐습니다 — 적을 때는 세는 말이 아니라
                        잡음입니다. */}
                    <Row gap={Spacing.s1} style={styles.tags}>
                      {[
                        post.region,
                        formatNights(post.dayCount),
                        ...post.tags.slice(0, 2),
                      ]
                        .filter(Boolean)
                        .map((t) => (
                          <Badge key={t as string} label={t as string} tone="muted" />
                        ))}
                    </Row>
                  </View>
                </Press>
              ))
            }
          </Carousel>
        </View>
      ) : null}

      {/*
        지금 뜨는 곳.

        <p>순위는 위아래로 견주며 읽는 것이라 한 자리에 붙어 있어야 합니다.
        줄마다 카드로 떼어 놓으면 1위와 5위가 서로 다른 것처럼 보입니다.

        <p>다섯 줄만 냅니다. 나머지와 갈래별로 거르는 것은 저쪽 화면이 하고,
        홈은 있다는 것만 알립니다.
      */}
      {top && top.places.length > 0 ? (
        <View>
          <Band />
          <SectionHeader title="지금 뜨는 곳" tight />
          {top.places.slice(0, 5).map((place, i, rows) => {
            /*
              누르면 그 곳이 어떤 데인지 봅니다.

              <p>좌표가 없으면 안 엽니다. 판이 하는 일의 절반이 지도와
              영업시간인데, 그 둘이 다 좌표에서 나옵니다.
            */
            const canLook = place.lat != null && place.lng != null;
            return (
              /* 저장 단추는 줄 옆에 섭니다. 줄 안에 두면 단추 안에 단추가 들어가고,
                 누른 자리가 줄인지 저장인지 흔들립니다. 바로 담습니다 — 판을 열어
                 「저장」을 찾게 하면 순위를 훑던 손이 멈춥니다. */
              <Row key={place.key} style={styles.topRow}>
                <View style={styles.grow}>
                  <ListRow
                    left={
                      <Row gap={Spacing.s3}>
                        {/* 1~3위만 브랜드색입니다. 다 물들이면 순위가 아니라
                            색칠이 되고, 위에서 세 번째까지가 사람들이 실제로
                            눈여겨보는 자리입니다. */}
                        <Text style={[styles.rank, i < 3 ? styles.rankTop : null]}>{i + 1}</Text>
                        <Mark icon={glyphOf(place.icon)} />
                      </Row>
                    }
                    title={place.name}
                    /* 「여행 1개에 담김」은 세는 말이 아니라 잡음입니다. 셋부터
                       「여럿이 담았다」가 뜻을 가집니다(실측 전 — 3 으로 시작). */
                    subtitle={[labelOf(place.icon), place.posts >= 3 ? `여행 ${place.posts}개에 담김` : null]
                      .filter(Boolean)
                      .join(' · ')}
                    /* 아래에 「더 보러가기」가 붙습니다. 선까지 그으면 그 단추가
                       순위의 여섯째 줄처럼 보입니다. */
                    last={i === rows.length - 1}
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
                </View>
                <IconButton
                  name="bookmark"
                  label={`${place.name} 저장`}
                  active={kept.has(place.key)}
                  bare
                  onPress={() => keep(place)}
                />
              </Row>
            );
          })}
          <View style={styles.more}>
            <Button
              label="더 보러가기"
              variant="secondary"
              onPress={() => router.push('/(app)/popular')}
            />
          </View>
        </View>
      ) : null}

      {/*
        운영은 맨 아래입니다.

        <p>여행을 짜는 것들과 같은 자리에 두면 같은 무게로 읽힙니다. 쓸 일이
        있을 때 찾아 내려오는 것이고, 운영자에게만 보입니다.

        <p>「내 계정」 줄도 여기 있었습니다. 띠 다섯 개를 지나야 닿는
        자리라 <b>막대 오른쪽 얼굴</b>로 올렸습니다 — 제 계정에 가려고 남의
        추천 여행을 훑어 내려갈 일이 아닙니다.
      */}
      <PlaceDetailSheet place={looking} onClose={() => setLooking(null)} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ 조각 */

/**
 * 구역 머리 오른쪽의 「전체보기」.
 *
 * <h3>머리는 이제 공용 부품이 만듭니다</h3>
 *
 * <p>여기서 구역 머리를 통째로 만들고 있었습니다({@code SectionHead}). 그래서
 * 글자 크기도 위아래 여백도 「전체보기」가 붙는 자리도 홈만의 값이었고,
 * 다른 갈래 화면으로 옮겨 가면 <b>같은 앱이 아닌 것처럼</b> 보였습니다.
 * 머리는 {@code SectionHeader} 가 맡고, 여기에는 오른쪽에 들어갈 것만
 * 남깁니다.
 *
 * <p>큰 단추가 아니라 작은 글자입니다. 이 구역에서 가장 굵은 것은 그 안의
 * 여행 이름들이어야 합니다 — 전에는 카드 안 맨 아래에 큰 단추로 두어,
 * 제일 안 중요한 것이 제일 커 보였습니다.
 *
 * @param what 무엇을 전체보기 하는지. 읽어 주는 기기만 씁니다
 */
function SeeAll({ what, onPress }: { what: string; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      hitSlop={Spacing.s3}
      scale={0.96}
      accessibilityLabel={`${what} 전체보기`}
      style={styles.seeAll}>
      <Text style={styles.seeAllLabel}>전체보기</Text>
      <Icon name="chevron-right" size={16} tone="muted" />
    </Press>
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
function Carousel({
  count,
  children,
}: {
  /**
   * 몇 장인지. 한 장이면 흘리지 않고 폭을 꽉 채웁니다 — 다음 장이 비칠 자리를
   * 비워 두면 오른쪽 48 이 「뭔가 덜 그려진」 빈칸으로 남습니다.
   */
  count: number;
  children: (cardWidth: number) => React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  /* 넓은 화면에서는 본문 폭이 묶여 있습니다. 그 안에서 재야 카드가 본문
     밖으로 나가지 않습니다. */
  const inner = Math.min(width, MaxContentWidth);
  const cardWidth = Math.max(160, inner - Gutter - 48);

  /*
    넓은 화면에서는 흘리지 않고 늘어놓습니다.

    <h3>옆으로 흘리는 것은 폰의 손짓입니다</h3>

    <p>카드 한 장이 거의 화면 폭만 하고, 다음 장이 48 비칩니다. 엄지로
    밀어 보는 띠라 폰에서는 이것이 맞습니다.

    <p>그런데 PC 브라우저에서는 밀 손가락이 없습니다. 마우스로 가로 띠를
    굴리는 일은 거의 안 하고, 1280 짜리 창에서 카드 한 장이 600 을 쓰면서
    그 옆은 비어 있었습니다 — 자리는 남는데 두 장째를 보려면 끌어야
    했습니다.

    <p>칸을 나눠 한눈에 늘어놓습니다. 두 칸(태블릿)이나 세 칸(PC)이고,
    사이는 계획서가 정한 20 입니다.

    <h3>폭은 재서 씁니다</h3>

    <p>본문 최대 폭을 숫자로 가져다 나누지 않았습니다. 그 값은 화면 뼈대가
    들고 있고 단계마다 다릅니다 — 여기서 한 번 더 적어 두면 둘 중 하나가
    바뀔 때 카드가 본문 밖으로 나갑니다. 제가 받은 자리를 재서 나눕니다.
    첫 그림에서는 아직 못 쟀으므로 한 번 비워 두고 다음 그림에서 채웁니다.
  */
  const columns = useCardColumns();
  const [room, setRoom] = useState(0);

  if (count === 1) {
    return (
      <View onLayout={(e) => setRoom(e.nativeEvent.layout.width)}>
        {room > 0 ? children(room) : null}
      </View>
    );
  }

  if (columns > 1) {
    const gridCard = room > 0 ? Math.floor((room - CardGap * (columns - 1)) / columns) : 0;
    return (
      <View style={styles.grid} onLayout={(e) => setRoom(e.nativeEvent.layout.width)}>
        {gridCard > 0 ? children(gridCard) : null}
      </View>
    );
  }

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
      <Text style={styles.cardTitle}>어디로 떠나 볼까요?</Text>
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
          last
          onPress={() => router.push('/community')}
        />
      </View>
    </View>
  );
}

/** 히어로의 높이. 그림과 덮개가 같은 값을 봐야 합니다. */
const HERO_HEIGHT = 200;

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
  },
  /* 지역 칩 줄. 좌우 여백까지 흘러야 마지막 칩이 잘린 것처럼 안 보입니다. */
  regionRow: {
    gap: Spacing.s2,
    paddingBottom: Spacing.s3,
  },
  tags: {
    flexWrap: 'wrap',
  },
  /* 가로로 흘리는 것은 여백 밖으로 나가고, 안쪽 여백은 내용이 가집니다 —
     그래야 첫 카드가 왼쪽 20 선에 맞고 마지막 카드가 끝까지 흘러갑니다. */
  bleed: {
    marginHorizontal: -Gutter,
  },
  /*
    막대 오른쪽의 얼굴.

    <p>32 입니다. 옆의 그림 단추들이 24 인데, 동그란 면에 든 것은 같은
    크기로 두면 더 작아 보입니다 — 면의 가장자리가 그림의 여백을 먹습니다.

    <p>누르는 넓이는 {@code hitSlop} 이 44 로 채웁니다.
  */
  face: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceEmoji: {
    fontSize: 17,
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  strip: {
    paddingHorizontal: Gutter,
    gap: Spacing.s3,
  },
  /* 넓은 화면에서 띠 대신 서는 격자. 흘리는 띠는 화면 끝까지 나갔지만
     (bleed) 격자는 본문 안에 섭니다 — 끝에서 잘릴 것이 없습니다. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CardGap,
  },

  /* 구역 머리 오른쪽. 글자와 꺽쇠가 붙어 한 덩어리로 읽혀야 합니다. */
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllLabel: {
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
    backgroundColor: Colors.accentSoft,
    justifyContent: 'space-between',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: Colors.text,
  },
  heroMeta: {
    ...Type.body2,
    color: Colors.textSecondary,
  },
  heroGo: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
