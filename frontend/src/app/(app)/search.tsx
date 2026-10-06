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
import { glyphOf, labelOf } from '@/constants/place-icons';
import { Colors, Gutter, Palette, Radius, Spacing, Tap, Type, Weight } from '@/constants/theme';
import { formatNights } from '@/lib/countdown';
import { forget, forgetAll, recentSearches, remember } from '@/lib/recent';
import {
  Band,
  Body,
  Chip,
  Empty,
  ErrorNote,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Mark,
  Press,
  Row,
  Screen,
  SearchField,
  SectionHeader,
  Snack,
  useUndo,
} from '@/ui';
import { ScreenTop } from '@/ui/nav';
import { quoted } from '@/lib/josa';

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
        message: `${quoted(found.name, '을를')} 보석함에 주웠어요.`,
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
      /* 윗줄은 찾는 칸 하나입니다. {@link ScreenTop} 으로 감싸는 것은 모양을
         바꾸려는 것이 아니라 <b>높이를 한 자리에서</b> 받으려는 것입니다 —
         칸이 마침 44 라 지금은 같아 보이지만, 그것이 우연이면 칸을 손보는
         날 이 화면만 다른 높이가 됩니다. */
      header={
        <ScreenTop
          left={
            <SearchField
              label="찾기"
              value={typed}
              onChangeText={setTyped}
              placeholder="교토, 온천, 아이랑"
              onSearch={() => ask(typed)}
              busy={busy}
            />
          }
        />
      }>
      {failed ? <ErrorNote message={failed} /> : null}

      {q ? (
        <>
          {/*
            결과 거르기.

            <p>밑줄 탭이었습니다. 밑줄 탭은 <b>다른 내용으로 넘어갈 때</b>
            씁니다(둘러보기의 둘러보기 · 좋아요 · 내 글). 여기는 한 번 찾은
            결과를 <b>거르는</b> 것이라 칩입니다 — 거르는 것은 앱 어디서나 칩입니다.
          */}
          <Row gap={Spacing.s2} style={styles.filters}>
            {TABS.map((t) => (
              <Chip key={t.value} label={t.label} selected={tab === t.value} onPress={() => setTab(t.value)} />
            ))}
          </Row>

          {busy && placeRows.length === 0 && postRows.length === 0 ? <Loading /> : null}
          {placeError && tab !== 'ideas' ? <ErrorNote message={placeError} /> : null}
          {postError && tab !== 'places' ? <ErrorNote message={postError} /> : null}

          {nothing ? (
            <Empty
              icon="search"
              message={`"${q}" 로는 찾은 것이 없어요.`}
              /* 「다른 말로 해 보세요」 뿐이었습니다. 어떤 말이 되는지를 안
                 알려 주면 같은 말을 조금 고쳐 다시 치고, 또 빈 화면을
                 봅니다. 이 찾기가 장소 이름 말고 무엇을 받는지 적습니다. */
              note="장소 이름 말고 「온천」, 「아이랑」 처럼 느낌으로도 찾을 수 있어요."
            />
          ) : null}

          {/*
            구역 하나를 한 칸에 담습니다.

            <p>머리와 줄들을 화면의 직접 자식으로 늘어놓으면 그 사이마다
            화면 기본 간격이 끼어, 제목이 제 묶음보다 위쪽 빈자리에 더 붙어
            보입니다. 머리는 공용 부품({@code SectionHeader})이 그립니다 —
            홈과 「내 여행」의 구역 제목과 같은 크기, 같은 여백입니다.
          */}
          {placeRows.length > 0 ? (
            <View>
              <SectionHeader title="장소" />
              {/*
                줄도 공용 부품으로 돌렸습니다.

                <p>그림·이름·설명·단추를 손으로 짜 맞추고 사이를 선으로
                갈랐습니다. 속은 {@link ListRow} 와 같은 것이었는데 여백과
                높이가 이 화면만의 값이라, 같은 장소 줄이 보석함과 홈에서
                서로 다르게 생겼습니다.
              */}
              {placeRows.map((found, i) => (
                <ListRow
                  key={`${found.placeId ?? found.name}-${i}`}
                  left={<Mark icon={glyphOf(found.icon)} />}
                  title={found.name}
                  subtitle={[labelOf(found.icon), found.address].filter(Boolean).join(' · ')}
                  /*
                    찾은 자리에서 바로 줍습니다.

                    <p>상세로 들어갔다 나와야 담을 수 있으면, 다섯 곳을
                    담는 데 열 번을 오갑니다. 줄을 누르는 것과는 갈라 두므로
                    별을 눌러도 상세가 열리지 않습니다.
                  */
                  action={
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
                  }
                  last={i === placeRows.length - 1}
                  onPress={() => setLooking(found)}
                />
              ))}
            </View>
          ) : null}

          {postRows.length > 0 ? (
            <View>
              {placeRows.length > 0 ? <Band /> : null}
              <SectionHeader
                tight={placeRows.length > 0}
                title="여행 아이디어"
                action={
                  tab === 'all' ? (
                    <MoreLink
                      label="더보기"
                      what="여행 아이디어"
                      chevron
                      onPress={() => setTab('ideas')}
                    />
                  ) : undefined
                }
              />
              {postRows.map((post, i) => (
                <ListRow
                  key={post.id}
                  /* 썸네일이 있으면 답니다. 글 목록에서는 사진이 제목보다
                     먼저 읽혀서, 훑어 내려가는 속도가 달라집니다. */
                  left={
                    post.coverPhotoId ? (
                      <OurPhoto id={post.coverPhotoId} width={72} height={72} />
                    ) : undefined
                  }
                  title={post.title}
                  subtitle={[
                    post.region,
                    formatNights(post.dayCount),
                    `${post.placeCount}곳`,
                    post.authorName,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  last={i === postRows.length - 1}
                  onPress={() => router.push(`/community/${post.id}`)}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {recent.length > 0 ? (
            <View>
              <SectionHeader
                title="최근 검색"
                action={
                  <MoreLink
                    label="모두 지우기"
                    what="최근 검색"
                    onPress={() => setRecent(forgetAll())}
                  />
                }
              />
              <Row gap={Spacing.s2} style={styles.wrap}>
                {/* 말마다 ✕. 「모두 지우기」만 있으면 잘못 친 말 하나를 빼려고
                    나머지까지 다 잃습니다. */}
                {recent.map((word) => (
                  <View key={word} style={styles.recent}>
                    <Press onPress={() => ask(word)} scale={0.96} style={styles.recentWord}>
                      <Body small>{word}</Body>
                    </Press>
                    <IconButton
                      name="x"
                      label={`최근 검색 ${word} 지우기`}
                      tone="muted"
                      bare
                      onPress={() => setRecent(forget(word))}
                    />
                  </View>
                ))}
              </Row>
            </View>
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
            <View>
              {recent.length > 0 ? <Band /> : null}
              <SectionHeader title="많이 찾는 말" tight={recent.length > 0} />
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
        /*
          담는 일은 글자 한 줄이 아니라 그림입니다.

          <p>「보석함에 줍기」라는 글자가 판 맨 아래에 따로 섰습니다. 그런데
          담는 일은 <b>구글 지도로 열기</b>와 같은 갈래입니다 — 이 곳을 두고
          하는 한 번의 동작이고, 둘이 나란히 있어야 고를 수 있습니다. 판 맨
          아래의 글자 한 줄은 그 줄에서 혼자 떨어져 있었습니다.

          <p>누르고 나서 판을 닫지 않습니다. 닫는 쪽이었는데, 그러면 담겼다는
          것을 <b>사라진 판</b>으로 알게 됩니다. 채워진 그림이 그 자리에서
          대답하는 편이 낫습니다.
        */
        scrap={looking ? { kept: kept.has(looking.name), onPress: () => keep(looking) } : null}
      />
    </Screen>
  );
}

/**
 * 구역 머리 오른쪽의 작은 글자.
 *
 * <p>큰 단추가 아닙니다. 이 구역에서 가장 굵은 것은 그 안의 장소 이름들이어야
 * 합니다. 홈의 「전체보기」와 같은 크기·같은 색으로 둡니다 — 화면마다 다른
 * 크기로 적혀 있으면 같은 일을 하는 것으로 안 읽힙니다.
 *
 * @param chevron 다른 데로 데려가는 것이면 꺽쇠를 답니다. 그 자리에서
 *                끝나는 일(지우기)에는 안 답니다
 */
function MoreLink({
  label,
  what,
  chevron,
  onPress,
}: {
  label: string;
  /** 무엇에 대한 것인지. 읽어 주는 기기만 씁니다. */
  what: string;
  chevron?: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      hitSlop={Spacing.s3}
      scale={0.96}
      accessibilityLabel={`${what} ${label}`}
      style={styles.moreLink}>
      <Text style={styles.moreLinkLabel}>{label}</Text>
      {chevron ? <Icon name="chevron-right" size={16} tone="muted" /> : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  /* 최근 검색 한 말. 칩과 같은 알약이고, 오른쪽에 ✕ 가 붙습니다. */
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Tap.chip,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingLeft: Spacing.s3 + 2,
    paddingRight: Spacing.s1,
  },
  recentWord: {
    justifyContent: 'center',
    height: '100%',
  },
  filters: {
    flexWrap: 'wrap',
  },
  /*
    탭 아래 선은 좌우 여백을 뚫고 나갑니다.

    <p>여백 안에 가두면 선이 양쪽에서 20픽셀씩 모자라, 화면을 가르는
    가닥이 아니라 내용 위에 얹힌 상자의 밑변으로 보입니다.
  */

  /* 구역 머리 오른쪽. 글자와 꺽쇠가 붙어 한 덩어리로 읽혀야 합니다. */
  moreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  moreLinkLabel: {
    ...Type.caption,
    fontSize: 14,
    fontWeight: Weight.medium,
    color: Colors.textMuted,
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
