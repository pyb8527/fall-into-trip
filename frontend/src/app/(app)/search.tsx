import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
import type { PostPage } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import type { Found } from '@/components/map-types';
import { OurPhoto } from '@/components/our-photo';
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import { iconOf, labelOf } from '@/constants/place-icons';
import { Colors, Gutter, Palette, Spacing, Tap, Type, Weight } from '@/constants/theme';
import { formatNights } from '@/lib/countdown';
import { forgetAll, recentSearches, remember } from '@/lib/recent';
import {
  Band,
  Body,
  Caption,
  Chip,
  Divider,
  Empty,
  ErrorNote,
  Grow,
  IconButton,
  Loading,
  Mark,
  Press,
  Row,
  Screen,
  SearchField,
  SegmentedTabs,
  Snack,
  Split,
  Subtitle,
  useUndo,
} from '@/ui';

/**
 * 한 자리에서 찾기.
 *
 * <h3>찾는 길이 화면마다 따로 있었습니다</h3>
 *
 * <p>장소는 <b>여행 안에 들어가야</b> 찾을 수 있었고(날짜의 ＋), 남의 일정은
 * 둘러보기에서, 담아 둔 곳은 보석함에서 따로 찾았습니다. 그래서 "교토 가면
 * 어디 가지" 가 떠올랐을 때 갈 데가 없었습니다 — 여행을 먼저 만들어야
 * 장소를 찾을 수 있었으니까요.
 *
 * <p>찾는 것은 여행을 짜기 <b>전에</b> 하는 일입니다. 한 자리에 모읍니다.
 *
 * <h3>찾은 자리에서 바로 줍습니다</h3>
 *
 * <p>찾아 놓고 담으려면 상세로 들어갔다 나와야 했습니다. 줄마다 ＋ 하나면
 * 됩니다 — 발견에서 저장까지 한 번입니다. 어느 여행에 넣을지는 나중에
 * 정합니다. 보석함이 그러라고 있는 자리입니다.
 *
 * <h3>도시 카드는 없습니다</h3>
 *
 * <p>「도쿄」를 치면 도시 페이지로 보내는 것이 흔한 모양인데, 우리에게는
 * 도시라는 것이 없습니다 — 있는 것은 글쓴이가 고른 여덟 갈래(국내·일본…)
 * 뿐입니다. 없는 것을 있는 척하지 않습니다.
 *
 * <h3>찾기 칸은 위에 붙여 둡니다</h3>
 *
 * <p>본문 안에 두었더니 결과를 내려다보는 동안 칸이 화면 밖으로 사라졌고,
 * 다른 말로 다시 찾으려면 맨 위까지 되감아야 했습니다. 찾기 화면에서 늘
 * 보여야 하는 것은 결과가 아니라 <b>찾는 칸</b>입니다.
 *
 * <h3>내 여행 칩을 뺐습니다</h3>
 *
 * <p>찾기 전 화면 맨 아래에 내 여행 이름이 칩으로 늘어서 있었습니다. 그런데
 * 여행 이름으로 장소를 찾으면 거의 아무것도 안 나옵니다 — 「도쿄 여행」은
 * 구글에 있는 장소 이름이 아닙니다. 눌러도 빈 결과가 나오는 칩이라 뺍니다.
 *
 * <h3>갈래 띠를 뗐습니다</h3>
 *
 * <p>아래 띠에 제 칸이 없는 화면입니다. 켜진 칸 없는 띠는 지금 어디인지를
 * 말하지 못하면서 자리만 먹습니다. 돌아가는 길은 상단바 뒤로가 맡습니다.
 */
type Tab = 'all' | 'places' | 'ideas';

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'places', label: '장소' },
  { value: 'ideas', label: '여행 아이디어' },
];

export default function Search() {
  const router = useRouter();
  const { user } = useAuth();

  const [typed, setTyped] = useState('');
  /* 친 대로 묻지 않습니다. 장소 찾기는 구글을 부르는 것이라 글자마다 부르면
     그대로 값입니다. 확인을 눌러야 갑니다. */
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [recent, setRecent] = useState<string[]>(() => recentSearches());
  const [looking, setLooking] = useState<Found | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const { undo, show: showUndo, hide: hideUndo } = useUndo();

  function ask(word: string) {
    const clean = word.trim();
    setTyped(clean);
    setQ(clean);
    if (clean) {
      setRecent(remember(clean));
    }
  }

  /* 많이 쓰인 태그를 인기 검색으로 씁니다. 우리가 손으로 적어 두면 철 지난
     말이 남고, 이것은 글이 쌓이는 대로 저절로 따라옵니다. */
  const { data: tagList } = useAsync<{ tags: { tag: string; posts: number }[] }>(
    (signal) => api.get('/api/posts/tags', signal),
    [],
  );

  const {
    data: places,
    loading: findingPlaces,
    error: placeError,
  } = useAsync<{ places: Found[] }>(
    (signal) =>
      q && tab !== 'ideas'
        ? api.get(`/api/places/search${query({ q })}`, signal)
        : Promise.resolve({ places: [] }),
    [q, tab],
  );

  const {
    data: posts,
    loading: findingPosts,
    error: postError,
  } = useAsync<PostPage>(
    (signal) =>
      q && tab !== 'places'
        ? api.get(`/api/posts${query({ q, sort: 'hot' })}`, signal)
        : Promise.resolve(null as unknown as PostPage),
    [q, tab],
  );

  /* 전체 탭에서는 양쪽을 조금씩만 냅니다. 한쪽이 스무 줄이면 다른 쪽은
     화면 밖에서 시작합니다. */
  const placeRows = useMemo(
    () => (places?.places ?? []).slice(0, tab === 'places' ? 20 : 5),
    [places, tab],
  );
  const postRows = useMemo(
    () => (posts?.posts ?? []).slice(0, tab === 'ideas' ? 20 : 3),
    [posts, tab],
  );

  async function keep(found: Found) {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    setFailed(null);
    try {
      await api.post('/api/saved', {
        name: found.name,
        lat: found.lat,
        lng: found.lng,
        placeId: found.placeId,
        icon: found.icon,
      });
      setKept((was) => new Set(was).add(found.name));
      showUndo({
        message: `「${found.name}」 를 보석함에 주웠어요.`,
        label: '보석함으로',
        onUndo: () => router.push('/(app)/saved'),
      });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  const busy = findingPlaces || findingPosts;
  const nothing =
    !!q && !busy && placeRows.length === 0 && postRows.length === 0;

  return (
    <Screen
      snack={<Snack undo={undo} onHide={hideUndo} />}
      header={
        <SearchField
          label="찾기"
          value={typed}
          onChangeText={setTyped}
          placeholder="교토, 온천, 아이랑"
          onSearch={() => ask(typed)}
          busy={busy}
        />
      }>
      {failed ? <ErrorNote message={failed} /> : null}

      {q ? (
        <>
          <SegmentedTabs items={TABS} value={tab} onChange={setTab} />

          {busy && placeRows.length === 0 && postRows.length === 0 ? <Loading /> : null}
          {placeError && tab !== 'ideas' ? <ErrorNote message={placeError} /> : null}
          {postError && tab !== 'places' ? <ErrorNote message={postError} /> : null}

          {nothing ? (
            <Empty message={`"${q}" 로는 찾은 것이 없어요. 다른 말로 해 보세요.`} />
          ) : null}

          {placeRows.length > 0 ? (
            <View>
              <Subtitle>장소</Subtitle>
              {/*
                줄에서 판을 벗겼습니다.

                <p>줄들을 흰 판 하나에 담고 사이를 선으로 갈랐습니다. 바닥이
                흰색이 된 뒤로 그 판은 보이지 않으면서 <b>줄을 좌우 16픽셀씩
                안으로 밀어 넣는</b> 일만 했습니다 — 장소 이름이 화면 왼쪽
                글자선에서 어긋나 있었습니다. 판을 벗기고 선만 남깁니다.
              */}
              {placeRows.map((found, i) => (
                <View key={`${found.placeId ?? found.name}-${i}`}>
                  {i > 0 ? <Divider /> : null}
                  <Split gap={Spacing.s2} style={styles.row}>
                    <Grow>
                      <Press
                        onPress={() => setLooking(found)}
                        scale={1}
                        accessibilityLabel={`${found.name} 자세히 보기`}>
                        <Row gap={Spacing.s3}>
                          <Mark emoji={iconOf(found.icon)} fallback="📍" />
                          <Grow gap={2}>
                            <Body strong numberOfLines={1}>
                              {found.name}
                            </Body>
                            <Caption tone="secondary" numberOfLines={1}>
                              {[labelOf(found.icon), found.address]
                                .filter(Boolean)
                                .join(' · ')}
                            </Caption>
                          </Grow>
                        </Row>
                      </Press>
                    </Grow>
                    {/*
                      찾은 자리에서 바로 줍습니다.

                      <p>상세로 들어갔다 나와야 담을 수 있으면, 다섯 곳을
                      담는 데 열 번을 오갑니다. 담긴 것은 그림에 색이 듭니다 —
                      회색이 검정으로 바뀌는 것은 티가 안 납니다(accent 가
                      이 앱에서 검정입니다).
                    */}
                    <IconButton
                      name="bookmark"
                      label={
                        kept.has(found.name)
                          ? `${found.name} 보석함에 있음`
                          : `${found.name} 보석함에 줍기`
                      }
                      bare
                      active={kept.has(found.name)}
                      tone="brand"
                      disabled={kept.has(found.name)}
                      onPress={() => keep(found)}
                    />
                  </Split>
                </View>
              ))}
            </View>
          ) : null}

          {placeRows.length > 0 && postRows.length > 0 ? <Band /> : null}

          {postRows.length > 0 ? (
            <View>
              <Split align="baseline">
                <Subtitle>여행 아이디어</Subtitle>
                {tab === 'all' ? (
                  <Press
                    onPress={() => setTab('ideas')}
                    accessibilityLabel="여행 아이디어 더보기"
                    scale={0.98}>
                    <Caption tone="secondary">더보기 ›</Caption>
                  </Press>
                ) : null}
              </Split>
              {postRows.map((post, i) => (
                <View key={post.id}>
                  {i > 0 ? <Divider /> : null}
                  <Press
                    onPress={() => router.push(`/community/${post.id}`)}
                    scale={1}
                    accessibilityLabel={`${post.title} 열기`}
                    style={styles.row}>
                    <Row gap={Spacing.s3}>
                      {/* 썸네일이 있으면 답니다. 글 목록에서는 사진이 제목보다
                          먼저 읽혀서, 훑어 내려가는 속도가 달라집니다. */}
                      {post.coverPhotoId ? (
                        <OurPhoto id={post.coverPhotoId} width={72} height={72} />
                      ) : null}
                      <Grow gap={2}>
                        <Body strong numberOfLines={2}>
                          {post.title}
                        </Body>
                        <Caption tone="secondary" numberOfLines={1}>
                          {[
                            post.region,
                            formatNights(post.dayCount),
                            `${post.placeCount}곳`,
                            post.authorName,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Caption>
                      </Grow>
                    </Row>
                  </Press>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {recent.length > 0 ? (
            <View style={styles.block}>
              <Split align="baseline">
                <Subtitle>최근 검색</Subtitle>
                <Press
                  onPress={() => setRecent(forgetAll())}
                  accessibilityLabel="최근 검색 모두 지우기"
                  scale={0.98}
                  hitSlop={Tap.compactSlop}>
                  <Caption tone="secondary">모두 지우기</Caption>
                </Press>
              </Split>
              <Row gap={Spacing.s2} style={styles.wrap}>
                {recent.map((word) => (
                  <Chip key={word} label={word} selected={false} onPress={() => ask(word)} />
                ))}
              </Row>
            </View>
          ) : null}

          {recent.length > 0 && (tagList?.tags.length ?? 0) > 0 ? (
            <Band />
          ) : null}

          {/*
            많이 찾는 말.

            <p>칩으로 늘어놓고 있었습니다. 칩은 <b>고를 수 있는 것</b>을
            보여 주는 모양이라 열두 개가 같은 무게로 서고, 그러면 어느 말이
            더 많이 쓰이는지가 안 보입니다 — 「많이 찾는」 이라는 이름과
            어긋납니다.
            <p>번호를 붙여 두 줄로 세웁니다. 앞의 셋만 색을 씁니다.
          */}
          {(tagList?.tags.length ?? 0) > 0 ? (
            <View style={styles.block}>
              <Subtitle>많이 찾는 말</Subtitle>
              <View style={styles.grid}>
                {tagList?.tags.slice(0, 10).map((t, i) => (
                  <Press
                    key={t.tag}
                    onPress={() => ask(t.tag)}
                    scale={1}
                    accessibilityLabel={`${t.tag} 로 찾기`}
                    style={styles.trend}>
                    <Text style={[styles.at, i < 3 ? styles.atTop : null]}>{i + 1}</Text>
                    <Body numberOfLines={1} style={styles.trendWord}>
                      {t.tag}
                    </Body>
                  </Press>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}

      <PlaceDetailSheet
        place={
          looking
            ? {
                name: looking.name,
                address: looking.address,
                lat: looking.lat,
                lng: looking.lng,
                placeId: looking.placeId,
                icon: looking.icon,
              }
            : null
        }
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* 구역 하나. 제목과 내용 사이는 한 눈금입니다. */
  block: {
    gap: Spacing.s3,
  },
  /* 줄 하나. 썸네일이 들어도 글자가 눌리지 않을 높이를 둡니다. */
  row: {
    paddingVertical: Spacing.s3,
    minHeight: Tap.min + Spacing.s3,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  /* 두 줄로 세우는 순위. 좁은 폰에서도 두 칸이 들어갑니다. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    width: '50%',
    minHeight: Tap.min,
  },
  at: {
    ...Type.body,
    fontWeight: Weight.bold,
    color: Palette.gray[400],
    width: 16,
    textAlign: 'center',
  },
  atTop: {
    color: Colors.accentInk,
  },
  trendWord: {
    flexShrink: 1,
  },
});
