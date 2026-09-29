import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
import type { PostPage, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import type { Found } from '@/components/map-types';
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import { iconOf, labelOf } from '@/constants/place-icons';
import { Spacing } from '@/constants/theme';
import { formatNights } from '@/lib/countdown';
import { forgetAll, recentSearches, remember } from '@/lib/recent';
import {
  Body,
  Caption,
  Card,
  Chip,
  Divider,
  Empty,
  ErrorNote,
  Grow,
  IconButton,
  Loading,
  Press,
  Row,
  Screen,
  SearchField,
  SegmentedTabs,
  Split,
  Subtitle,
  useUndo,
  Snack,
} from '@/ui';
import { AppTabs } from '@/ui/tab-bar';

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

  const { data: mine } = useAsync<{ trips: TripSummary[] }>(
    (signal) => (user ? api.get('/api/trips', signal) : Promise.resolve({ trips: [] })),
    [user],
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
    <Screen tabs={<AppTabs />} snack={<Snack undo={undo} onHide={hideUndo} />}>
      <SearchField
        label="찾기"
        value={typed}
        onChangeText={setTyped}
        placeholder="교토, 온천, 아이랑"
        onSearch={() => ask(typed)}
        busy={busy}
      />

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
            <View style={styles.section}>
              <Subtitle>장소</Subtitle>
              <Card style={styles.listCard}>
                {placeRows.map((found, i) => (
                  <View key={`${found.placeId ?? found.name}-${i}`}>
                    {i > 0 ? <Divider /> : null}
                    <Split gap={0}>
                      <Grow>
                        <Press
                          onPress={() => setLooking(found)}
                          scale={0.995}
                          accessibilityLabel={`${found.name} 자세히 보기`}
                          style={styles.row}>
                          <Row gap={Spacing.sm}>
                            {iconOf(found.icon) ? (
                              <Body small style={styles.emoji}>
                                {iconOf(found.icon)}
                              </Body>
                            ) : null}
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
              </Card>
            </View>
          ) : null}

          {postRows.length > 0 ? (
            <View style={styles.section}>
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
              <Card style={styles.listCard}>
                {postRows.map((post, i) => (
                  <View key={post.id}>
                    {i > 0 ? <Divider /> : null}
                    <Press
                      onPress={() => router.push(`/community/${post.id}`)}
                      scale={0.995}
                      accessibilityLabel={`${post.title} 열기`}
                      style={styles.row}>
                      <Grow gap={2}>
                        <Body strong numberOfLines={1}>
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
                    </Press>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </>
      ) : (
        <>
          {recent.length > 0 ? (
            <View style={styles.section}>
              <Split align="baseline">
                <Subtitle>최근 검색</Subtitle>
                <Press
                  onPress={() => setRecent(forgetAll())}
                  accessibilityLabel="최근 검색 모두 지우기"
                  scale={0.98}>
                  <Caption tone="secondary">지우기</Caption>
                </Press>
              </Split>
              <Row gap={Spacing.xs} style={styles.wrap}>
                {recent.map((word) => (
                  <Chip key={word} label={word} selected={false} onPress={() => ask(word)} />
                ))}
              </Row>
            </View>
          ) : null}

          {/* 내 여행 이름으로 바로 찾습니다. 「도쿄 여행」을 짜는 중이면
              찾는 말도 대개 거기서 나옵니다. */}
          {(mine?.trips.length ?? 0) > 0 ? (
            <View style={styles.section}>
              <Subtitle>내 여행</Subtitle>
              <Row gap={Spacing.xs} style={styles.wrap}>
                {mine?.trips.slice(0, 6).map((trip) => (
                  <Chip
                    key={trip.id}
                    label={trip.title}
                    selected={false}
                    onPress={() => ask(trip.title)}
                  />
                ))}
              </Row>
            </View>
          ) : null}

          {(tagList?.tags.length ?? 0) > 0 ? (
            <View style={styles.section}>
              <Subtitle>많이 찾는 말</Subtitle>
              <Row gap={Spacing.xs} style={styles.wrap}>
                {tagList?.tags.slice(0, 12).map((t) => (
                  <Chip key={t.tag} label={t.tag} selected={false} onPress={() => ask(t.tag)} />
                ))}
              </Row>
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
  section: {
    gap: Spacing.sm,
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  emoji: {
    lineHeight: undefined,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
