import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type {
  News,
  Place,
  PopularPlace,
  PostPage,
  TripDetail,
  TripSummary,
} from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { TripMark } from '@/components/trip-mark';
import { TripThumb } from '@/components/trip-thumb';
import { iconOf, labelOf } from '@/constants/place-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Countdown } from '@/lib/countdown';
import { countdownIsNear, countdownLabel, countdownOf, formatSpan, todayIso } from '@/lib/countdown';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Grow,
  Icon,
  IconButton,
  Mark,
  MenuCard,
  Panel,
  Press,
  Rise,
  Row,
  Screen,
  Split,
  Subtitle,
  Title,
} from '@/ui';
import { LogoMark } from '@/ui/logo';
import { AppTabs } from '@/ui/tab-bar';

/**
 * 첫 화면.
 *
 * <p>할 수 있는 일을 카드로 늘어놓습니다. 메뉴를 숨겨 두면 있는 줄도 모르고
 * 지나갑니다.
 *
 * <p>한때는 아직 만들지 않은 것도 "준비 중" 으로 함께 두었습니다. 지금은
 * 하나도 없습니다 — 지도와 동행자는 여행 안에서 이미 되는데도 자리
 * 채우기로 남아, 되는 것을 안 된다고 말하고 있었습니다. 다시 붙일 일이
 * 생기면 정말 없는 것에만 붙입니다.
 *
 * <p>메뉴 아래에는 지금 이 사람에게 맞는 줄 하나가 옵니다. 여행이 하나도
 * 없으면 어디서 시작하는지를, 다가올 여행이 있으면 며칠 남았는지를
 * 말합니다. 둘은 함께 뜨지 않습니다 — 여행이 없으면 셀 날도 없습니다.
 */
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  /* 여행이 하나도 없는 사람에게는 메뉴만으로 부족합니다. 그 판단에 필요한
     것이 개수 하나뿐이라 목록을 그대로 받아 씁니다. */
  const { data: mine } = useAsync<{ trips: TripSummary[] }>(
    (signal) => api.get('/api/trips', signal),
    [],
  );

  /*
    소식이 와 있는지.

    숫자는 안 씁니다. 점 하나면 "들어가 볼 것이 있다" 는 말이 되고, 몇
    건인지는 열기 전에 할 일이 아닙니다.

    못 받아 와도 조용히 넘어갑니다 — 첫 화면이 소식 때문에 멈추면, 소식이
    없는 사람에게도 앱이 느려집니다.
  */
  const { data: news } = useAsync<News>((signal) => api.get('/api/news', signal), []);

  /*
    남들이 다녀온 길, 그리고 여럿이 간 곳.

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
    첫 화면에 있으면 그것만으로 열어 볼 이유가 됩니다. 목록에는 이미
    있었지만(trips.tsx) 여기까지 오려면 한 단 더 들어가야 했습니다.

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
    "다음 어디" 입니다. 여행 중이 아니면 한 번도 안 부릅니다.

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

  /*
    오늘 남은 것.

    <p>여기서 세는 것은 <b>오늘 하루</b>입니다. 여행 전체의 진행률이 아닙니다 —
    길 위에서 궁금한 것은 "앞으로 며칠 남았나" 가 아니라 "이따 어디 가나"
    입니다.

    <p>오늘 날짜에 해당하는 날이 없으면(여행 사이에 빈 날) 비웁니다. 그때는
    카드가 지금까지처럼 제목만 말합니다.
  */
  const road = useMemo(() => {
    if (!today) {
      return null;
    }
    const iso = todayIso();
    const day = today.days.find((d) => d.iso === iso) ?? null;
    if (!day || day.places.length === 0) {
      return null;
    }
    const stamped = new Set(today.visited);
    const left = day.places.filter((p) => !stamped.has(p.id));
    return { next: left[0] ?? null, left: left.length, total: day.places.length };
  }, [today]);

  /*
    아래 목록에 낼 셋.

    위 카드에 이미 나온 여행은 뺍니다. 여행 중이든 다음 여행이든 마찬가지
    입니다 — 같은 제목에 같은 배지가 한 화면에 두 번 있으면 둘 중 무엇이
    진짜인지 잠깐 헷갈리고, 무엇보다 자리가 아깝습니다.
  */
  /*
    맨 위 카드에 이미 나온 여행은 뺍니다. 같은 여행이 한 화면에 두 번
    나오면 둘 중 무엇이 진짜인지 잠깐 헷갈리고, 무엇보다 자리가 아깝습니다.

    <p>가장 최근에 만든 것부터 <b>다섯</b>. 서버는 만든 차례대로 주므로
    뒤에서 자릅니다 — 마흔 개를 가진 사람에게 삼 년 전 여행부터 보여 줄
    이유가 없습니다.

    <p>맨 위 카드는 늘 떠 있으므로 여기서 빠지는 것도 늘 하나입니다. 어떤
    날은 넷이고 어떤 날은 다섯인 일이 없습니다.
  */
  const shortlist = useMemo(
    () =>
      (mine?.trips ?? [])
        .filter((t) => t.id !== next?.trip.id)
        .slice(-5)
        .reverse(),
    [mine, next],
  );

  return (
    <Screen safeTop tabs={<AppTabs />}>
      <View style={styles.head}>
        <Split>
          <LogoMark size={34} />
          {/* 오른쪽 위에 둘입니다.

              소식을 메뉴 카드로 만들면 넷이 다섯이 되어 2열 배치가
              흐트러집니다. 그리고 카드는 "들어가서 할 일" 인데 소식은
              "와 있는지 보는 것" 이라 성격이 다릅니다 — 점이 없으면 누를
              이유도 없습니다.

              계정 설정은 늘 같은 자리에 둡니다. 메뉴 사이에 끼워 두면
              쓸 일이 드문 것이 자주 쓰는 것들과 자리를 다툽니다. */}
          <Row gap={0}>
            <IconButton
              name="bell"
              label={news?.unseen ? `소식 ${news.unseen}건` : '소식'}
              dot={!!news?.unseen}
              onPress={() => router.push('/(app)/news')}
            />
            <IconButton
              name="settings"
              label="내 계정"
              onPress={() => router.push('/(app)/settings')}
            />
          </Row>
        </Split>
        {/* 이름을 강조색으로 떼어 놓습니다. 한 덩어리로 두면 인사말이 그냥
            문장 하나로 흘러갑니다.

            tone="accent" 를 쓰고 있었는데 그 이름은 화면 마흔 군데에서
            "가장 강한 것"(=검정)을 뜻하도록 되돌려 둔 자리라, 코랄로 떼어
            놓겠다고 적어 놓고 정작 검정으로 그려지고 있었습니다.

            색만 다르고 크기는 같습니다. 작게 두었더니 정작 사람 이름이
            인사말보다 작아 곁다리처럼 보였습니다. */}
        <Title>
          {user?.name ? (
            <>
              <Title tone="brand">{user.name}</Title>
              {' 님, 어디로 떠나 볼까요?'}
            </>
          ) : (
            '어디로 떠나 볼까요?'
          )}
        </Title>
      </View>

      {/*
        길 위에 있으면 이것이 맨 위입니다.

        <p>메뉴 넷 밑에 있었습니다. 그런데 여행 중에 홈을 여는 것은 하루에
        몇 번씩 있는 일이고, 그때 찾는 것은 늘 이 줄 하나입니다. 메뉴를
        지나 내려가야 보이면 그만큼 늦게 찾습니다.

        <p>여행 중일 때만 올렸었습니다. 아직 안 떠난 것은 지난 자리에 두는
        편이 맞다고 봤는데, 그러면 아래 목록에서 그 여행을 빼 놓고는 정작
        <b>한참 밑에서 다시 내놓는</b> 모양이 됐습니다. 목록은 다섯을
        낸다고 해 놓고 넷만 나오고요.

        <p>늘 올립니다. 길 위에 있든 다음 주에 떠나든 <b>가장 가까운 여행</b>
        하나인 것은 같고, 그것이 이 화면에서 가장 먼저 볼 것입니다.
      */}
      {next ? <NextTrip trip={next.trip} at={next.at} road={road} /> : null}

      {/*
        내 여행 — 이 화면의 첫머리.

        <h3>메뉴판이던 자리</h3>

        <p>맨 위를 메뉴 카드 넷이 차지하고 있었습니다. 그래서 홈을 열면
        <b>어디로 갈 수 있는지</b>가 먼저 보이고, 정작 내 여행은 그 아래로
        밀려 한 번 굴려야 나왔습니다.

        <p>갈 곳은 이제 아래 띠가 말합니다. 홈은 메뉴판 노릇을 그만두고
        내용부터 답니다 — 홈에 오는 사람이 찾는 것은 대개 자기 여행입니다.

        <h3>왜 줄마다 카드가 아닌가</h3>

        <p>한동안 여행 하나에 카드 하나였습니다. 셋이면 사각형이 셋이고,
        사이사이 여백까지 합치면 세 줄을 읽는 데 화면의 절반을 씁니다.
        그런데 이것들은 <b>같은 종류의 것들</b>입니다 — 같은 묶음이면 한
        상자에 들어가야 하고, 상자를 여럿 두면 그만큼 경계가 늘어납니다.

        <p>토스의 자산 화면이 그렇게 서 있습니다. 카드 하나 안에 줄이 여럿
        있고, 맨 아래 "전체보기" 가 한 칸 차지합니다. 줄 사이는 머리카락
        굵기 선 하나가 가릅니다.

        <h3>몇십 개여도 됩니다</h3>

        <p>여기서 내는 것은 늘 <b>다섯</b>입니다. 여행이 마흔 개여도 카드
        높이는 그대로이고, 나머지는 "전체보기" 한 줄이 맡습니다. 홈이
        목록이 되면 홈이 아닙니다.

        <p>맨 위로 올라오면서 셋에서 다섯으로 늘렸습니다. 첫머리에 셋만
        있으면 그 아래가 곧바로 남의 여행이라, 내 것이 곁다리처럼 보입니다.
      */}
      {mine && mine.trips.length > 0 ? (
        <View style={styles.section}>
          {/* 전체보기를 카드 안 맨 아래 큰 단추로 두었었습니다. 그런데 그것은
              이 카드에서 제일 굵은 것이 아닌데 제일 커 보였습니다. 아래
              「다양한 경험들」과 같은 자리, 같은 크기로 맞춥니다. */}
          <Split align="baseline">
            <Subtitle>내 여행</Subtitle>
            {mine.trips.length > shortlist.length ? (
              <Button
                label="전체보기"
                variant="ghost"
                compact
                onPress={() => router.push('/(app)/trips')}
              />
            ) : null}
          </Split>
          <Card style={styles.listCard}>
            {shortlist.map((trip, i) => (
              <View key={trip.id}>
                {i > 0 ? <Divider /> : null}
                <Press
                  onPress={() => router.push(`/trip/${trip.id}`)}
                  scale={0.995}
                  accessibilityLabel={`${trip.title} 열기`}
                  style={styles.listRow}>
                  <Split>
                    <Row gap={Spacing.sm} style={styles.grow}>
                      <TripMark theme={trip.theme} emoji={trip.emoji} />
                      <Grow gap={1}>
                      <Body small strong numberOfLines={1}>
                        {trip.title}
                      </Body>
                      {/*
                        날짜와 남은 날을 답니다. 전에는 "3일 · 장소 4곳" 뿐이라
                        「내 여행」 화면보다 아는 것이 적었습니다 — 같은 것을
                        보여 주면서 덜 말하면 이 줄을 둘 이유가 없습니다.
                      */}
                      <Caption tone="muted">
                        {[formatSpan(trip.startIso, trip.endIso), `장소 ${trip.placeCount}곳`]
                          .filter(Boolean)
                          .join(' · ')}
                      </Caption>
                      </Grow>
                    </Row>
                    {countdownOf(trip.startIso, trip.endIso) ? (
                      <Badge
                        label={countdownLabel(countdownOf(trip.startIso, trip.endIso)!)}
                        tone={
                          countdownIsNear(countdownOf(trip.startIso, trip.endIso)!)
                            ? 'brand'
                            : 'muted'
                        }
                      />
                    ) : (
                      <Icon name="chevron-right" size={21} tone="muted" />
                    )}
                  </Split>
                </Press>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {/*
        갓 가입한 사람의 홈은 텅 비어 있습니다. 아래 갈래 띠가 어디로 갈
        수 있는지는 말해 주지만, 무엇부터 해야 하는지는 말해 주지 않습니다.

        여행 수를 서버에 따로 표시해 두지 않습니다. 개수가 0인지로 그냥
        알 수 있고, 표시를 만들면 그때부터 그 값이 진짜와 어긋납니다.
        덤으로 여행을 다 지운 사람에게도 맞는 안내가 됩니다.
      */}
      {mine && mine.trips.length === 0 ? <FirstSteps /> : null}

      {/*
        다양한 경험들.

        여기만 그림이 붙습니다. 사진을 안 올리는 앱이라 쓸 수 있는 것은
        동선 그림 한 장뿐인데, 그것으로 충분합니다 — 오사카를 도는 선과
        제주를 도는 선은 생김새가 다릅니다. 무엇보다 진짜 그 글의 내용입니다.

        이 구역만 가로로 흘립니다. 그림이 붙는 것은 줄로 세울 수 없고,
        "이런 것도 있다" 를 보이는 자리이지 고르는 자리가 아닙니다.
      */}
      {shared && shared.posts.length > 0 ? (
        <View style={styles.section}>
          <Split align="baseline">
            <Subtitle>다양한 경험들</Subtitle>
            <Button
              label="둘러보기"
              variant="ghost"
              compact
              onPress={() => router.push('/community')}
            />
          </Split>
          {/* 이것도 한 장 위에 놓습니다. 회색 바닥에 그림 카드가 그냥
              떠 있으면 어디까지가 이 구역인지 안 보입니다. */}
          <Panel style={styles.stripPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Row gap={Spacing.md} style={styles.strip}>
                {shared.posts.slice(0, 6).map((post) => (
                  <Press
                    key={post.id}
                    onPress={() => router.push(`/community/${post.id}`)}
                    scale={0.98}
                    accessibilityLabel={`${post.title} 보기`}
                    style={styles.postCard}>
                    <TripThumb postId={post.id} height={96} label={post.title} />
                    <View style={styles.postText}>
                      {/* 작은 회색 메타 → 굵은 제목 → 작은 숫자. 문토가 카드
                          안에서 쓰는 차례 그대로입니다. */}
                      <Caption tone="muted" numberOfLines={1}>
                        {[post.region, `${post.dayCount}일`].filter(Boolean).join(' · ')}
                      </Caption>
                      <Body small strong numberOfLines={2}>
                        {post.title}
                      </Body>
                      <Caption tone="secondary">
                        장소 {post.placeCount}곳
                        {post.likeCount > 0 ? ` · 추천 ${post.likeCount}` : ''}
                      </Caption>
                    </View>
                  </Press>
                ))}
              </Row>
            </ScrollView>
          </Panel>
        </View>
      ) : null}

      {/*
        지금 핫플레이스 — 이것도 카드 하나에.

        순위는 위아래로 견주며 읽는 것이라 한 상자에 담겨 있어야 합니다.
        줄마다 카드로 떼어 놓으면 1위와 5위가 서로 다른 것처럼 보입니다.

        다섯 줄만 냅니다. 나머지와 갈래별로 거르는 것은 저쪽 화면이 하고,
        홈은 있다는 것만 알립니다.
      */}
      {/*
        운영은 맨 아래입니다.

        여행을 짜는 것들과 같은 자리에 두면 같은 무게로 읽힙니다. 관리자만
        보이는 데다 자주 쓸 것도 아니라, 쓸 일이 있을 때 찾아 내려오면 됩니다.
      */}
      {top && top.places.length > 0 ? (
        <View style={styles.section}>
          <Subtitle>지금 핫플레이스</Subtitle>
          <Card style={styles.listCard}>
            {top.places.slice(0, 5).map((place, i) => (
              <View key={place.key}>
                {i > 0 ? <Divider /> : null}
                <Row gap={Spacing.md} style={styles.rankRow}>
                  <Body small strong={i < 3} tone={i < 3 ? 'default' : 'muted'} style={styles.at}>
                    {i + 1}
                  </Body>
                  <Mark emoji={iconOf(place.icon)} fallback="📍" />
                  <Grow gap={1}>
                    <Body small strong numberOfLines={1}>
                      {place.name}
                    </Body>
                    <Caption tone="muted">
                      {[labelOf(place.icon), `일정 ${place.posts}개에`].filter(Boolean).join(' · ')}
                    </Caption>
                  </Grow>
                </Row>
              </View>
            ))}
            <Button
              label="더 보러가기"
              variant="secondary"
              onPress={() => router.push('/(app)/popular')}
            />
          </Card>
        </View>
      ) : null}
      {user?.role === 'ADMIN' ? (
        <MenuCard
          title="운영"
          caption="계정 관리·감사 로그"
          wide
          onPress={() => router.push('/admin')}
        />
      ) : null}
    </Screen>
  );
}

/**
 * 다음 여행까지 며칠 — 그리고 길 위에 있으면, 지금 어떻게 돼 가는지.
 *
 * <p>세는 일은 <code>lib/countdown</code> 이 합니다. 여행 목록의 뱃지와
 * 같은 답을 써야 해서입니다 — 두 화면이 다른 날짜를 말하면 어느 쪽이
 * 맞는지 알 수 없습니다.
 *
 * <h3>여행이 시작되면 가는 곳이 달라집니다</h3>
 *
 * <p>전에는 이 줄이 "지금 그 길 위" 라고 <b>적어 놓고</b> 일정을 짜는
 * 화면을 열었습니다. 앱이 길 위인 것을 알면서 짜는 도구를 내민 셈입니다.
 *
 * <p>길 위에서 보라고 만든 화면이 이미 있습니다 —
 * <code>travel/[id].tsx</code>, 스탬프첩입니다. 지금 갈 곳 하나만 크게
 * 놓고 길찾기와 다녀옴만 남깁니다. 여행 중에는 그쪽을 엽니다.
 *
 * <p><b>짜는 화면을 막지는 않습니다.</b> 길 위에서도 일정은 고칩니다 — 비가
 * 와서 하나 빼는 일이 실제로 벌어집니다. 스탬프첩 오른쪽 위에 "일정 전체"
 * 가 늘 있습니다. 바뀌는 것은 <b>무엇이 먼저 열리는가</b>뿐입니다.
 *
 * @param road 오늘 남은 것. 여행 중이 아니거나 오늘에 해당하는 날이 없으면
 *             비어 있고, 그때는 지금까지처럼 제목만 말합니다
 */
function NextTrip({
  trip,
  at,
  road,
}: {
  trip: TripSummary;
  at: Countdown;
  road: { next: Place | null; left: number; total: number } | null;
}) {
  const router = useRouter();
  const going = at.kind === 'going';

  /* 길 위에서 궁금한 것은 "이따 어디 가나" 한 줄입니다. 다 찍었으면 그것도
     말해 줍니다 — 남은 것이 없다는 것도 답입니다. */
  const line = !road
    ? null
    : road.next
      ? `다음 · ${road.next.name}`
      : `오늘 ${road.total}곳 다 찍었습니다`;

  return (
    <Rise order={5}>
      <Press
        onPress={() =>
          going
            ? router.push({ pathname: '/travel/[id]', params: { id: trip.id } })
            : router.push(`/trip/${trip.id}`)
        }
        accessibilityLabel={`${trip.title} — ${countdownLabel(at)}${line ? `, ${line}` : ''}`}>
        {/*
          길 위에 있을 때는 이 카드가 달라집니다.

          여태 다른 카드들과 똑같이 생겨 있었습니다. 그런데 여행 중에 홈을
          여는 것은 하루에 몇 번씩 있는 일이고, 그때 찾는 것은 늘 이 줄
          하나입니다. 다른 것들과 같은 무게로 서 있으면 눈이 한 번 훑고
          지나갑니다.

          바탕을 옅게 물들입니다. 왼쪽에 색 띠도 둘렀었는데, 이 카드에는
          이미 점과 「지금 그 길 위」와 남은 곳 배지가 있어서 넷째 표시가
          되었습니다. 하나를 도드라지게 하려고 표시를 넷씩 붙이면 그때부터는
          그냥 시끄러운 카드입니다.
        */}
        <Card style={going ? styles.onRoad : undefined}>
          <Split>
            <View style={styles.grow}>
              {/* 무엇에 대한 줄인지 먼저 말합니다. 제목만 있으면 이것이
                  다음 여행인지 방금 본 여행인지 알 수 없습니다. */}
              <Row gap={Spacing.xs}>
                {/* 길 위에서만 찍히는 점. 글자로 "지금" 이라고 적는 것보다
                    눈에 먼저 걸립니다. */}
                {going ? <View style={styles.live} /> : null}
                <Caption tone={going ? 'brand' : 'secondary'} strong={going}>
                  {going ? '지금 그 길 위' : '다음 여행'}
                </Caption>
              </Row>
              <Subtitle>{trip.title}</Subtitle>
              {/* 아직 안 받아 왔으면 아무 줄도 안 둡니다. 자리만 잡아 두면
                  카드가 한 번 흔들립니다. */}
              {line ? <Caption>{line}</Caption> : null}
            </View>
            <Badge
              label={going && road ? `${road.left}곳 남음` : countdownLabel(at)}
              tone={going ? 'brand' : countdownIsNear(at) ? 'brand' : 'muted'}
            />
          </Split>
        </Card>
      </Press>
    </Rise>
  );
}

/** 아직 아무것도 없는 사람에게, 어디서 시작하는지. */
function FirstSteps() {
  const router = useRouter();

  return (
    <Rise order={5}>
      <Card>
        <Subtitle>어디서 시작할까요?</Subtitle>

        <Row gap={Spacing.sm} style={styles.steps}>
          <View style={styles.grow}>
            <Button
              label="첫 여행 만들기"
              onPress={() => router.push('/(app)/trips?new=1')}
            />
          </View>
          <View style={styles.grow}>
            <Button
              label="남의 길 구경하기"
              variant="secondary"
              onPress={() => router.push('/community')}
            />
          </View>
        </Row>
      </Card>
    </Rise>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.sm,
  },
  /*
    줄을 담는 카드.

    카드가 제 여백을 갖고 있으면 그 안의 줄마다 또 여백이 생겨 두 겹이
    됩니다. 좌우만 남기고 위아래는 줄이 스스로 가집니다 — 그래야 머리카락
    선이 카드 끝까지 닿습니다.
  */
  listCard: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    gap: 0,
  },
  listRow: {
    paddingVertical: Spacing.md,
  },
  /* 길 위에 있을 때만. 옅게 물든 바탕으로 다른 카드들과 갈립니다. */
  onRoad: {
    backgroundColor: Colors.accentSoft,
  },
  /* 길 위라는 점. 지도의 "내 위치" 와 같은 색입니다. */
  live: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  rankRow: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  /* 번호가 한 자리든 두 자리든 이름이 같은 자리에서 시작해야 합니다. */
  at: {
    width: 20,
    textAlign: 'center',
  },
  /* 가로로 흘리는 것을 담는 판. 좌우 여백은 띠가 스스로 가져야 카드가
     판 끝까지 흘러 나갑니다. */
  stripPanel: {
    paddingHorizontal: 0,
  },
  /* 가로로 흘리는 띠. 끝을 띄워 둬야 마지막 카드가 잘린 것처럼 안 보입니다. */
  strip: {
    flexWrap: 'nowrap',
    paddingHorizontal: Spacing.sm,
  },
  postCard: {
    width: 208,
    gap: Spacing.sm,
  },
  postText: {
    gap: 2,
  },
  head: {
    gap: Spacing.md,
  },
  steps: {
    flexWrap: 'nowrap',
  },
  grow: {
    flex: 1,
  },
});
