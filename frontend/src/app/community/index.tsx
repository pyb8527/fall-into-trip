import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, query } from '@/api/client';
import type { PopularPlace, PostCard, PostDays, PostPage, PostSort } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Curation } from '@/components/curation';
import { SignUpGate } from '@/components/signup-gate';
import { TripThumb } from '@/components/trip-thumb';
import { glyphOf, labelOf } from '@/constants/place-icons';
import { Colors, Elevation, Gutter, Radius, Spacing, Tap } from '@/constants/theme';
import type { Comeback } from '@/lib/comeback';
import {
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  Card,
  Chip,
  Divider,
  Empty,
  ErrorNote,
  FilterChip,
  Grow,
  ListRow,
  Mark,
  Pager,
  Press,
  Row,
  Screen,
  SearchField,
  Skeleton,
  Split,
  Tabs,
} from '@/ui';
import { CardGrid } from '@/ui/grid';
import { ScreenTop } from '@/ui/nav';
import { AppTabs } from '@/ui/tab-bar';

/**
 * 남들이 올린 일정.
 *
 * <p>로그인 없이도 열립니다. 추천을 누르거나 가져가려 할 때만 로그인을
 * 요구합니다.
 *
 * <h3>제목을 아예 안 적습니다</h3>
 *
 * <p>두 번 옮겼습니다. 처음에는 상단바 가운데 작게 있었고 — 갈래 띠로 오는
 * 화면이라 뒤로 갈 데가 없는데 작은 글씨 하나가 56픽셀을 먹었습니다 — 그래서
 * 본문 맨 위로 내려 크게 적고 상단바를 걷었습니다.
 *
 * <p>그런데 <b>지금 어디인지는 아래 갈래 띠가 이미 말합니다.</b> 「둘러보기」
 * 칸이 채워져 있는 채로 위에 같은 말이 한 번 더 크게 적혀 있었던 셈입니다.
 * 이름을 걷고, 그 줄을 찾는 칸에 줍니다.
 *
 * <h3>찾기 칸은 그 자리에 그냥 섭니다</h3>
 *
 * <p>한동안 돋보기로 접어 두었습니다 — 늘 펼쳐 두면 화면을 열 때마다
 * <b>목록보다 찾기 칸이 먼저</b> 보이고, 구경하러 들어온 아홉이 매번 52픽셀을
 * 지나쳐 내려가야 했기 때문입니다. 이제 이름이 걷힌 자리가 비어 있으니 그
 * 걱정이 없습니다. 칸은 윗줄 안이고, 목록은 한 줄도 안 밀립니다.
 *
 * <p>내 글·좋아요 띠에서는 칸을 안 냅니다. 다만 <b>줄은 그대로 섭니다</b> —
 * {@link ScreenTop} 이 높이를 44 로 못박습니다. 전에는 그 두 띠에서 돋보기가
 * 사라져 윗줄이 32 로 내려앉아, 띠를 옮길 때마다 목록이 12씩 뛰었습니다.
 */
/**
 * 어느 글을 볼지.
 *
 * <h3>한 줄에 두 가지가 섞여 있었습니다</h3>
 *
 * <p>인기·최신·추천순·좋아요·내 글, 다섯이 한 띠에 있었습니다. 그런데
 * 앞의 셋은 <b>세우는 법</b>이고 뒤의 둘은 <b>어느 글인지</b>라, 서로
 * 대신할 수 있는 것이 아닙니다. 나란히 두면 하나를 고르는 순간 다른 쪽을
 * 못 고릅니다 — "내 글을 최신순으로" 를 말할 방법이 없었습니다.
 *
 * <p>띠는 어느 글인지만 묻고, 세우는 법은 조건 판으로 내려갑니다. 칸도
 * 다섯에서 셋으로 줄어 좁은 폰에서 글자가 안 눌립니다.
 */
type Tab = 'all' | 'mine' | 'liked';

/**
 * 거를 수 있는 기간.
 *
 * 날짜 수를 그대로 묻지 않습니다. "3박4일" 을 찾는 사람이 4를 넣어야 하는지
 * 3을 넣어야 하는지 헷갈립니다.
 */
const DAYS: { value: PostDays; label: string }[] = [
  { value: '1', label: '당일' },
  { value: '2-4', label: '1~3박' },
  { value: '5', label: '4박 이상' },
];

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: '둘러보기' },
  /* 구경하다 마음에 든 것을 눌러 두고는 나중에 찾지 못했습니다. 추천이
     세는 데만 쓰이고 되찾는 길이 없었습니다. */
  /* 하트를 「좋아요」 라고 부르면서 탭만 「내가 누른」 이었습니다. 무엇을
     누른 것인지 탭 이름만 보고는 알 수 없습니다. */
  { value: 'liked', label: '좋아요' },
  { value: 'mine', label: '내 글' },
];

/** 세우는 법. 조건 판 안에 있습니다. */
const SORTS: { value: PostSort; label: string }[] = [
  { value: 'hot', label: '인기순' },
  { value: 'new', label: '최신순' },
  { value: 'top', label: '추천순' },
  { value: 'copied', label: '많이 가져간 순' },
];

/** 혼자 · 모임 — 그 여행기가 어느 쪽 여행에서 나왔는지. */
type Who = 'solo' | 'group';
const WHO: { value: Who; label: string }[] = [
  { value: 'solo', label: '혼자 간 여행' },
  { value: 'group', label: '여럿이 간 여행' },
];

/** 나만 볼 수 있는 것들. 로그인하지 않았으면 띠에서 뺍니다. */
const PRIVATE: Tab[] = ['mine', 'liked'];

export default function Community() {
  const router = useRouter();
  const { user } = useAuth();
  const [view, setView] = useState<Tab>('all');
  const [sort, setSort] = useState<PostSort>('hot');
  const [page, setPage] = useState(0);
  /** 계정이 있어야 되는 것을 눌렀을 때. 이유를 말하는 판이 올라옵니다. */
  const [gate, setGate] = useState<Comeback | null>(null);

  /* 글자를 칠 때마다 부르면 요청이 쏟아집니다. 확인 버튼으로만 보냅니다. */
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  /*
    어디를 보고 있는지.

    <p>주소로 받은 것이 있으면 그것으로 시작합니다. 「지금 뜨는 여행지」에서
    지역을 누르면 여기로 보내는데, 받아 읽는 데가 없어서 <b>조건이 안 걸린
    전체 목록</b>이 떴습니다 — 누른 보람이 없었습니다.
  */
  const { region: fromLink } = useLocalSearchParams<{ region?: string }>();
  const [region, setRegion] = useState<string | null>(fromLink ?? null);
  const [days, setDays] = useState<PostDays | null>(null);
  const [who, setWho] = useState<Who | null>(null);

  /*
    태그.

    <p>지역과 기간은 조건이지 주제가 아닙니다. "도쿄 3박" 으로는 좁혀지는데
    "아이랑 갈 만한 데" 로는 못 좁혔습니다.

    <p>고를 수 있는 값을 우리가 정하지 않습니다 — 글쓴이가 적은 것을 세어
    많이 쓰인 순서로 내려받습니다. 목록이 저절로 뒤따라옵니다.
  */
  const [tag, setTag] = useState<string | null>(null);

  const { data: tagList } = useAsync<{ tags: { tag: string; posts: number }[] }>(
    (signal) => api.get('/api/posts/tags', signal),
    [],
  );

  /* 고를 수 있는 지역은 서버가 정합니다. 화면에 따로 적어 두면 언젠가
     어긋나고, 어긋나면 고른 값이 아무것도 안 걸립니다. */
  const { data: regionList } = useAsync<{ regions: string[] }>(
    (signal) => api.get('/api/posts/regions', signal),
    [],
  );

  /** 조건 고르는 판을 열어 두었는지. */
  const [sifting, setSifting] = useState(false);

  /**
   * 지금 걸려 있는 것들.
   *
   * <p>밖에 내놓을 것과 개수를 여기서 한 번에 셉니다. 화면 여기저기서
   * {@code region !== null} 을 따로 세면 한 군데를 빠뜨렸을 때 개수와
   * 실제가 어긋납니다.
   */
  const picked: { key: string; label: string; clear: () => void }[] = [
    q !== '' ? { key: 'q', label: `"${q}"`, clear: () => { setTyped(''); setQ(''); } } : null,
    region !== null ? { key: 'region', label: region, clear: () => setRegion(null) } : null,
    tag !== null ? { key: 'tag', label: `#${tag}`, clear: () => setTag(null) } : null,
    who !== null
      ? { key: 'who', label: WHO.find((w) => w.value === who)?.label ?? '', clear: () => setWho(null) }
      : null,
    days !== null
      ? {
          key: 'days',
          label: DAYS.find((d) => d.value === days)?.label ?? '기간',
          clear: () => setDays(null),
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  /** 무엇으로든 거르고 있는지. 아무것도 안 걸렸을 때만 안내를 띄웁니다. */
  const filtered = picked.length > 0;

  /**
   * 걸린 것을 모두 거둡니다.
   *
   * <p>판 안의 「모두 지우기」 가 {@code setRegion}·{@code setDays}·
   * {@code setQ} 를 손으로 꼽고 있었습니다. 그 사이에 태그 조건이 하나 늘었고,
   * 꼽는 쪽에는 안 늘었습니다 — 「모두 지우기」 를 눌러도 {@code #온천} 이
   * 남아 있고, 개수는 1 인데 지울 길이 없었습니다.
   *
   * <p>이제 {@code picked} 를 되짚습니다. 조건을 더해도 거두는 쪽은 저절로
   * 따라옵니다.
   */
  function clearAll() {
    picked.forEach((p) => p.clear());
  }

  const { data, error, loading, reload, setData } = useAsync<PostPage>(
    (signal) =>
      view === 'mine' || view === 'liked'
        ? api.get(`/api/posts/${view}${query({ page })}`, signal)
        : api.get(`/api/posts${query({ sort, region, tag, days, q, who, page })}`, signal),
    [view, sort, page, region, tag, days, q, who],
  );

  /** 조건을 바꾸면 첫 쪽부터 다시 봅니다. 3쪽에서 걸면 빈 화면이 됩니다. */
  function refilter(change: () => void) {
    change();
    setPage(0);
  }

  /**
   * 추천을 누르면 서버를 기다리지 않고 먼저 칠합니다.
   *
   * 목록에서 하트를 누르는 것은 손이 빠른 동작이라, 매번 왕복을 기다리면
   * 눌렀는지 안 눌렀는지 알 수 없어 두 번 누르게 됩니다.
   */
  function toggleLike(post: PostCard) {
    if (!user) {
      /* 말없이 로그인 화면으로 튕기면 왜 그랬는지 모른 채로 닫습니다.
         하트가 어디에 쌓이는지를 그 자리에서 말합니다. */
      setGate({ where: '/community', what: 'like' });
      return;
    }
    const next = !post.liked;
    setData((prev) =>
      prev
        ? {
            ...prev,
            posts: prev.posts.map((p) =>
              p.id === post.id
                ? { ...p, liked: next, likeCount: p.likeCount + (next ? 1 : -1) }
                : p,
            ),
          }
        : prev,
    );
    api.post(`/api/posts/${post.id}/like${query({ on: next })}`).catch(() => {
      /* 실패하면 서버 쪽이 맞습니다. 다시 읽어 맞춥니다. */
      reload();
    });
  }

  return (
    <Screen
      safeTop
      tabs={<AppTabs />}
      /*
        맨 윗줄은 찾는 칸입니다.

        <h3>이름을 걷고 그 자리를 썼습니다</h3>

        <p>「둘러보기」라고 큰 제목으로 적고 있었습니다. 그런데 지금 어디인지는
        <b>아래 갈래 띠가 이미 말합니다</b> — 「둘러보기」 칸이 채워져 있는
        채로 위에 같은 말이 한 번 더 적혀 있었습니다.

        <p>찾는 칸을 돋보기로 접어 두었습니다 — 「구경하러 들어온 사람이 열에
        아홉」이 그때의 까닭이었는데, 이름이 걷힌 자리가 비어 있으니 칸을
        거기 그냥 세웁니다. 목록은 한 줄도 안 밀립니다.

        <p>내 글·좋아요에는 안 냅니다 — 몇 줄 안 되는 내 것이고, 서버에 묻는
        찾기가 아닙니다. 다만 <b>줄은 그대로 섭니다</b>({@link ScreenTop} 이
        44 로 못박습니다). 전에는 그 두 띠에서 돋보기가 사라져 윗줄이 32 로
        내려앉았습니다 — 띠를 옮길 때마다 목록이 12 씩 위아래로 뛰었습니다.
      */
      header={
        <ScreenTop
          left={
            PRIVATE.includes(view) ? null : (
              <SearchField
                label="찾기"
                value={typed}
                onChangeText={setTyped}
                placeholder="도쿄, 온천, 아이와 함께"
                onSearch={() => refilter(() => setQ(typed.trim()))}
              />
            )
          }
        />
      }>
      {/* 윗줄과 갈래 띠가 「여기가 어디인지」를 말하므로 상단바는 걷습니다. */}
      <Stack.Screen options={{ headerShown: false }} />

      <Tabs
        items={user ? TABS : TABS.filter((t) => !PRIVATE.includes(t.value))}
        value={view}
        onChange={(next) => {
          setView(next);
          setPage(0);
        }}
      />

      {/*
        조건은 판 안에 둡니다.

        전에는 지역 아홉 개와 기간 넷이 늘 펼쳐져 있었습니다. 칩 열셋이면
        좁은 폰에서 석 줄이고, 그 위에 띠까지 있으니 <b>정작 보러 온 목록이
        늘 화면 밖에서 시작했습니다.</b>

        고를 수 있는 것은 판 안으로 넣고, 밖에는 <b>지금 걸려 있는 것</b>만
        남깁니다. 대개 하나나 둘이고, 아무것도 안 걸렸으면 한 줄도 안 먹습니다.
      */}
      {PRIVATE.includes(view) ? null : (
        <>
          {/*
            조건 줄은 가로로 흐릅니다.

            <p>줄바꿈으로 두었더니 조건 셋만 걸려도 두 줄이 되어 목록이
            그만큼 내려갔습니다. 조건은 걸려 있는지만 보이면 되는 것이라,
            넘치는 쪽은 옆으로 흘려보내고 화면 끝에서 잘리게 둡니다.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sieve}
            /* 줄은 화면 끝까지 흐르되 첫 칩은 글자선에 맞습니다. */
            style={styles.sieveBleed}>
            {/*
              판을 여는 칸. 늘 맨 앞에 섭니다.

              <p>회색 면({@code secondary})이었습니다. 그 뒤로 따라오는
              {@code FilterChip} 들도 면이라, 「누르면 고를 수 있는 칸」과
              「이미 걸려 있는 것」이 같은 무게로 늘어섰습니다. 테두리만 둔
              칸으로 두면 걸린 것들보다 한 발 뒤로 물러섭니다.

              <p>세우는 법은 여기서 뺐습니다 — 늘 걸려 있는 것이라 조건이
              아니고, 개수 줄 오른쪽이 제자리입니다(계획서 §4-10 의
              「최근 담은 순」과 같은 자리).
            */}
            <Button
              label={picked.length > 0 ? `필터 ${picked.length}` : '필터'}
              icon="settings"
              variant="outline"
              size="xs"
              onPress={() => setSifting(true)}
            />
            {picked.map((p) => (
              <FilterChip key={p.key} label={p.label} onRemove={() => refilter(p.clear)} />
            ))}
            {/* 걸린 것이 둘셋만 되어도 하나씩 ×를 누르는 것이 일이 됩니다.
                판을 열지 않고 한 번에 거둘 길을 줄 끝에 둡니다 — 판 안의
                「모두 지우기」와 같은 조건에 같은 일을 합니다. */}
            {picked.length > 0 ? (
              <Button
                label="초기화"
                variant="text"
                size="xs"
                onPress={() => refilter(clearAll)}
              />
            ) : null}
          </ScrollView>

          {/*
            지역 칩 — 한 줄만 밖에(plan-review Q8).

            <p>지역 · 기간 · 태그 칩 열셋을 늘 펼쳐 두었다가 걷어 낸 적이 있습니다
            — 좁은 폰에서 석 줄을 먹어 목록이 늘 화면 밖에서 시작했습니다. 가장
            먼저 고르는 지역만 한 줄로 흘리고 나머지는 판 안에 그대로 둡니다.
          */}
          {(regionList?.regions.length ?? 0) > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sieve}
              style={styles.sieveBleed}>
              {regionList?.regions.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={region === r}
                  onPress={() => refilter(() => setRegion(region === r ? null : r))}
                />
              ))}
            </ScrollView>
          ) : null}

          {/*
            개수와 세우는 법.

            <p>개수는 조건 줄 아래 한 줄로 둡니다 — 줄 안에 끼우면 조건이
            늘어날 때마다 오른쪽으로 밀려 나가 영영 안 보입니다.

            <p>세우는 법은 그 줄 오른쪽입니다. 판 안에만 두면 지금 무엇으로
            서 있는지 보려고 판을 열어야 하는데, 그것은 <b>조건이 아니라 늘
            걸려 있는 것</b>이라 열어 보지 않아도 보여야 합니다.
          */}
          <Split>
            <Caption tone="secondary">
              {data ? `글 ${data.total.toLocaleString()}개` : '세는 중'}
            </Caption>
            <Button
              label={SORTS.find((x) => x.value === sort)?.label ?? '인기순'}
              iconAfter="chevron-down"
              variant="text"
              size="xs"
              onPress={() => setSifting(true)}
            />
          </Split>

          {/*
            고르는 곳과 보는 곳을 띠가 가릅니다.

            <p>띠·칸·개수 줄과 글 카드가 같은 흰 바닥 위에 쭉 쌓여 있어서,
            어디까지가 조건이고 어디서부터 목록인지가 <b>글자 크기로만</b>
            갈렸습니다. 다른 화면들은 이미 구역마다 띠로 갈라져 있는데
            여기만 안 갈려 있었습니다.
          */}
          <Band />
        </>
      )}

      <BottomSheet
        visible={sifting}
        title="필터"
        onClose={() => setSifting(false)}
        /*
          몇 개가 남는지를 판을 닫기 전에 말합니다.

          <p>조건을 걸어도 결과는 판 뒤에 가려 있습니다. 그래서 세 개를 걸고
          닫았더니 빈 목록이면, 어느 조건이 지나쳤는지 모른 채 하나씩
          풀어 보게 됩니다.

          <p>목록은 조건을 바꿀 때마다 이미 다시 불러옵니다 — 그 개수를
          여기 단추에 적기만 하면 됩니다. 셋을 다 걸기 전에 0 이 되는 것이
          보이면 마지막 하나는 안 걸게 됩니다.
        */
        footer={
          <Row gap={Spacing.s2}>
            <Grow>
              <Button
                label={
                  loading || !data ? '세는 중' : `결과 ${data.total.toLocaleString()}개 보기`
                }
                disabled={loading || !data}
                onPress={() => setSifting(false)}
              />
            </Grow>
            {picked.length > 0 ? (
              <Button label="모두 지우기" variant="secondary" onPress={() => refilter(clearAll)} />
            ) : null}
          </Row>
        }>
        <Body small strong>
          세우는 법
        </Body>
        <Row gap={Spacing.s2} style={styles.applied}>
          {SORTS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              selected={sort === o.value}
              onPress={() => refilter(() => setSort(o.value))}
            />
          ))}
        </Row>

        <Divider />

        <Body small strong>
          어디
        </Body>
        <Row gap={Spacing.s2} style={styles.applied}>
          <Chip
            label="어디든"
            selected={region === null}
            onPress={() => refilter(() => setRegion(null))}
          />
          {regionList?.regions.map((r) => (
            <Chip
              key={r}
              label={r}
              selected={region === r}
              onPress={() => refilter(() => setRegion(region === r ? null : r))}
            />
          ))}
        </Row>

        <Divider />

        {/* 혼자 · 여럿이 — 동선의 빽빽함도 숙소도 다릅니다. */}
        <Body small strong>
          누구와
        </Body>
        <Row gap={Spacing.s2} style={styles.applied}>
          <Chip label="누구든" selected={who === null} onPress={() => refilter(() => setWho(null))} />
          {WHO.map((w) => (
            <Chip
              key={w.value}
              label={w.label}
              selected={who === w.value}
              onPress={() => refilter(() => setWho(who === w.value ? null : w.value))}
            />
          ))}
        </Row>

        <Divider />

        {/*
          태그.

          <p>지역 다음입니다. 어디를 갔는지 다음에 오는 것이 무엇에 대한
          여행인지고, 찾을 때도 그 순서로 좁힙니다.

          <p>많이 쓰인 것만 냅니다. 한 번 쓰인 태그까지 다 늘어놓으면
          고르는 것이 아니라 훑는 일이 됩니다.
        */}
        {(tagList?.tags.length ?? 0) > 0 ? (
          <>
            <Body small strong>
              무엇
            </Body>
            <Row gap={Spacing.s2} style={styles.applied}>
              <Chip
                label="무엇이든"
                selected={tag === null}
                onPress={() => refilter(() => setTag(null))}
              />
              {tagList?.tags.map((t) => (
                <Chip
                  key={t.tag}
                  label={t.tag}
                  selected={tag === t.tag}
                  onPress={() => refilter(() => setTag(tag === t.tag ? null : t.tag))}
                />
              ))}
            </Row>
          </>
        ) : null}

        <Body small strong>
          며칠
        </Body>
        <Row gap={Spacing.s2} style={styles.applied}>
          <Chip
            label="며칠이든"
            selected={days === null}
            onPress={() => refilter(() => setDays(null))}
          />
          {DAYS.map((d) => (
            <Chip
              key={d.value}
              label={d.label}
              selected={days === d.value}
              onPress={() => refilter(() => setDays(days === d.value ? null : d.value))}
            />
          ))}
        </Row>
      </BottomSheet>

      {/*
        처음 받는 동안 — 글이 올 자리를 미리 세웁니다.

        <p>{@link Loading} 이 섰습니다. 윗줄과 띠 바로 아래라, 점 셋이 돌다가
        카드들이 들어서면서 화면이 한 번 들썩였습니다.

        <p>셋입니다. {@link Skeleton} 의 칸은 글 카드의 <b>글 쪽</b>만큼이라
        위의 사진(180)까지 자리를 잡아 주지는 못합니다 — 카드 꼴의 칸은
        {@link Skeleton} 쪽에서 낼 일입니다. 열 장을 세워 메우지는 않습니다.
        안 올 글을 약속하는 것이 비는 것보다 나쁩니다.

        <p><b>띠를 옮길 때는 안 섭니다.</b> {@link useAsync} 는 새로 받는 동안
        먼저 받아 둔 쪽을 들고 있어서, 띠를 옮겨도 목록은 비지 않습니다 —
        여기서 할 일은 아래의 흐리게 두기입니다.
      */}
      {loading && !data ? <Skeleton rows={3} /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && data.posts.length === 0 ? (
        <Empty
          /*
            빈 자리마다 갈 길이 다릅니다.

            <p>한 줄에 「없다」와 「이렇게 하세요」를 붙여 적고 있었습니다.
            말로만 가리키면 그 화면을 찾아 나가야 하는데, 넷 중 셋은
            <b>한 번 누르면 되는 일</b>입니다 — 조건을 거두거나, 다른 칸으로
            옮기거나, 내 여행으로 가는 것.

            <p>그림도 갈래마다 다릅니다. 「좋아요」에는 안 답니다 — 하트를
            뜻하는 그림이 이 앱의 그림표에 없고, 뜻이 안 맞는 그림은 없는
            것보다 나쁩니다.
          */
          icon={view === 'mine' ? 'upload' : filtered ? 'search' : 'compass'}
          message={
            view === 'mine'
              ? '아직 내놓은 길이 없어요.'
              : view === 'liked'
                ? '아직 하트를 누른 글이 없어요.'
                : filtered
                  ? '조건에 맞는 길이 없어요.'
                  : '아직 올라온 길이 없어요.'
          }
          note={
            view === 'mine'
              ? '여행 요약 화면에서 「여행기 쓰기」로 내놓을 수 있어요.'
              : view === 'liked'
                ? '마음에 드는 길에 하트를 눌러 두면 여기 모입니다.'
                : filtered
                  ? '조건을 줄이면 더 보일 수 있어요.'
                  : '누군가 여행기를 내놓으면 여기 쌓입니다. 첫 번째가 되어 보세요.'
          }
          action={
            view === 'mine'
              ? { label: '내 여행 보기', onPress: () => router.push('/(app)/trips') }
              : view === 'liked'
                ? { label: '둘러보기', onPress: () => setView('all') }
                : filtered
                  ? { label: '조건 지우기', onPress: () => refilter(clearAll) }
                  : undefined
          }
        />
      ) : null}

      {/*
        큐레이션 줄 — 아무것도 안 걸고 첫 쪽을 볼 때만.

        <p>글이 적을 때는 줄이 안 섭니다 — 같은 몇 장이 줄마다 되풀이됐습니다
        ({@link Curation} 의 문서). 전체 글 수를 넘겨 그쪽이 가립니다.
      */}
      {view === 'all' && !filtered && page === 0 ? (
        <Curation
          /* 조건 고르는 판이 쓰는 것과 같은 목록입니다. 넘겨 주지 않으면
             한 화면이 같은 길을 두 번 묻습니다({@link Curation}). */
          tags={tagList?.tags ?? null}
          total={data?.total ?? 0}
          onOpen={(id) => router.push(`/community/${id}`)}
          onTag={(t) => refilter(() => setTag(t))}
        />
      ) : null}

      {/* 넓은 화면에서는 글 카드를 두세 칸으로 늘어놓습니다. 폰에서는
          감싸는 것이 없습니다 — 한 칸일 때는 격자가 아무 일도 안 합니다. */}
      <CardGrid>
        {data?.posts.map((post) => (
          <PostRow
            key={post.id}
            post={post}
            /* 쪽을 넘길 때도 흐려집니다. 쪽 넘기기는 이어 붙이는 것이 아니라
               목록을 갈아 끼우는 것이라, 띠를 옮기는 것과 같은 자리입니다. */
            stale={loading}
            onOpen={() => router.push(`/community/${post.id}`)}
            onLike={() => toggleLike(post)}
            onTag={(t) => refilter(() => setTag(t))}
          />
        ))}
      </CardGrid>

      {/*
        여행이 적을 때 — 장소는 많습니다. 그리고 내 여행도 내놓아 보라고.
      */}
      {view === 'all' && !filtered && data && data.total < 6 ? <FewPosts /> : null}

      <Pager
        page={data?.page ?? 0}
        totalPages={data?.totalPages ?? 0}
        onPage={setPage}
      />

      <SignUpGate intent={gate} onClose={() => setGate(null)} />
    </Screen>
  );
}

/**
 * 여행기가 적을 때 — 지금 뜨는 곳과 「내 여행도 내놓아 보세요」.
 *
 * <p>여행기가 적어도 장소 데이터는 많습니다. 그리고 지금 비어 보이는 까닭이
 * 내놓은 사람이 적어서라면, 다녀온 여행이 있는 사람에게 그 길을 바로 줍니다.
 */
function FewPosts() {
  const router = useRouter();
  const { data: top } = useAsync<{ places: PopularPlace[] }>((signal) => api.get('/api/popular/places', signal), []);
  return (
    <View style={styles.shelf}>
      {(top?.places.length ?? 0) > 0 ? <Body strong>지금 뜨는 곳</Body> : null}
      {top?.places.slice(0, 5).map((p, i, rows) => (
        <ListRow
          key={p.key}
          left={<Mark icon={glyphOf(p.icon)} />}
          title={p.name}
          subtitle={labelOf(p.icon) || undefined}
          last={i === rows.length - 1}
          onPress={() => router.push('/(app)/popular')}
        />
      ))}
      <Press onPress={() => router.push('/(app)/trips')} scale={0.99} style={styles.invite}>
        <Body strong>내 여행도 내놓아 보세요</Body>
        <Caption tone="secondary">다녀온 여행의 요약 화면에서 「여행기 쓰기」로 바로 올릴 수 있어요.</Caption>
      </Press>
    </View>
  );
}

/**
 * 글 한 장.
 *
 * <h3>그림이 판 밖으로 나갑니다</h3>
 *
 * <p>사진을 판 안쪽 여백 안에 두었습니다. 그러면 사진 둘레에 흰 테가 생겨
 * 카드가 <b>그림을 담은 액자</b>처럼 보이고, 정작 사진은 양옆 32픽셀만큼
 * 좁아집니다. 사진이 위를 가득 채우고 글만 여백을 가집니다 — 상용 앱의
 * 글 카드가 거의 다 이 모양입니다.
 *
 * <h3>하트는 사진 위로</h3>
 *
 * <p>카드 맨 아래에 글자 단추로 있었습니다. 그러면 같은 자리를 메타 줄과
 * 나눠 쓰면서 카드가 한 줄 더 길어지고, 무엇보다 <b>목록을 훑는 손이
 * 닿는 자리</b>가 아닙니다. 사진 오른쪽 위 흰 원으로 올립니다 — 숫자는
 * 메타 줄로 내려 하트에서 떼어 놓습니다.
 */
function PostRow({
  post,
  stale,
  onOpen,
  onLike,
  onTag,
}: {
  post: PostCard;
  /**
   * 바뀌기 전 것인지.
   *
   * <h3>띠를 옮겨도 목록이 비지 않습니다</h3>
   *
   * <p>13번은 「띠를 옮기면 목록이 한 번 비고 바퀴가 돈다」고 적었는데, 이
   * 화면에서는 그런 일이 없습니다. {@link useAsync} 는 새로 받는 동안
   * <b>먼저 받아 둔 쪽을 그대로 들고 있습니다</b> — {@code data} 를 비우는
   * 자리가 없습니다.
   *
   * <p>실제로 일어나는 일은 이쪽입니다. 띠를 옮기거나 조건을 걸면 바뀌기 전
   * 글들이 <b>아무 말 없이 그대로 서 있는 채로</b> 새것이 오고, 닿는 순간
   * 한꺼번에 갈립니다. 「내 글」을 눌렀는데 남의 글이 한 박자 더 보이는
   * 것입니다 — 눌렀는데 아무 일도 안 일어난 것처럼 보이고, 그 다음에 화면이
   * 저절로 바뀝니다.
   *
   * <p>그동안 흐리게 둡니다. 자리를 한 픽셀도 옮기지 않고 「아직 바뀌기 전
   * 것」을 말할 수 있는 유일한 방법입니다. 회색 칸으로 갈아 끼우는 쪽은
   * 안 됩니다 — 그러려면 아직 화면에 서 있는 글들을 일부러 걷어야 하고,
   * 그러면 13번이 적어 둔 「한 번 빈다」를 없는 데서 만들어 내는 셈입니다.
   */
  stale?: boolean;
  onOpen: () => void;
  onLike: () => void;
  /** 태그를 눌렀을 때. 그 태그로 좁힙니다. */
  onTag: (tag: string) => void;
}) {
  return (
    /*
      흐린 정도는 카드마다 입힙니다.

      <p>격자를 통째로 감싸는 쪽은 안 됩니다. 폰에서 {@link CardGrid} 는
      <b>아무것도 감싸지 않으므로</b>(한 칸일 때는 그냥 children 입니다),
      감싸는 칸 하나가 끼는 순간 카드들이 화면이 가진 간격 밖으로 나가 서로
      붙어 섭니다. 카드끼리 겹치지 않으니 한 장씩 입힌 것과 보이는 결과는
      같습니다.
    */
    <Card style={[styles.post, stale ? styles.stale : null]}>
      {/* 글로 들어가는 자리와 하트를 나눕니다. 카드 전체가 눌리면 하트를
          누르려다 글이 열립니다. */}
      <Pressable onPress={onOpen} accessibilityRole="button">
        {/*
          표지 → 첫 사진 → 동선 그림.

          <p>셋 다 "이 글이 무엇인가" 를 한눈에 말하는 자리입니다. 사진이 더
          빨리 말하지만 한 장도 없는 글도 많고, 동선 그림은 그것대로 쓸모가
          있습니다 — 오사카를 도는 선과 제주를 도는 선은 생김새가 다릅니다.

          <p>세 칸의 순서와 그 까닭은 {@link TripThumb} 에 있습니다. 여기와
          선반과 문에 각각 적어 두면 한 곳을 고칠 때 나머지가 남습니다.
        */}
        <View style={styles.media}>
          <TripThumb
            postId={post.id}
            coverPhotoId={post.coverPhotoId}
            firstPhotoId={post.firstPhotoId}
            height={180}
            label={post.title}
            style={styles.flat}
          />
          {/* 며칠 여행인지는 사진 위에서 가장 빨리 읽힙니다. 글자 줄로
              내리면 메타에 섞여 묻힙니다. */}
          <View style={styles.span}>
            <Text style={styles.spanLabel}>{post.dayCount}일</Text>
          </View>
        </View>

        <View style={styles.said}>
          <Body strong numberOfLines={2}>
            {post.title}
          </Body>
          {post.summary ? (
            <Body small tone="secondary" numberOfLines={2}>
              {post.summary}
            </Body>
          ) : null}
          {/*
            조회수를 안 냅니다.

            <p>글이 몇 개 없는 동안에는 "조회 1" 이 붙습니다. 그것을 본 사람에게
            이 글은 <b>아무도 안 본 글</b>이고, 그런 글이 목록에 늘어서 있으면
            앱 자체가 비어 보입니다. 세는 것은 계속하되(인기순이 씁니다) 보여
            주지는 않습니다.
          */}
          {/* 작은 숫자는 숨깁니다. 「♥ 1」은 세는 말이 아니라 「아무도 안 봤다」로
              읽힙니다. 셋부터 냅니다. 가져간 수가 하트보다 앞입니다 — 가져간
              것은 실제로 쓴다는 뜻입니다. */}
          <Caption tone="secondary">
            {[
              post.authorName,
              post.region,
              `${post.placeCount}곳`,
              post.fromGroup ? '여럿이' : null,
              (post.copyCount ?? 0) >= 3 ? `가져간 ${post.copyCount}명` : null,
              post.likeCount >= 3 ? `♥ ${post.likeCount}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Caption>
        </View>
      </Pressable>

      {/*
        태그.

        <p>누르는 자리 <b>밖</b>에 둡니다. 안에 넣으면 태그를 누르려다 글이
        열립니다 — 지도와 하트를 갈라 둔 것과 같은 까닭입니다.

        <p>눌러서 그 태그로 좁힙니다. 보여 주기만 하면 "아, 이런 게 있구나"
        에서 끝나고, 정작 같은 것을 더 보려면 거르는 판을 열어 찾아야
        합니다.
      */}
      {post.tags.length > 0 ? (
        <Row gap={Spacing.s2} style={[styles.applied, styles.tagRow]}>
          {post.tags.map((t) => (
            <Chip key={t} label={t} selected={false} onPress={() => onTag(t)} />
          ))}
        </Row>
      ) : null}

      {/* 하트는 목록에서 바로 누릅니다. 글을 열어야만 누를 수 있으면
          구경하다 마음에 든 것을 지나치게 됩니다. */}
      <Press
        onPress={onLike}
        scale={0.9}
        accessibilityLabel={post.liked ? '하트 빼기' : '하트 누르기'}
        accessibilityState={{ selected: post.liked }}
        hitSlop={Tap.compactSlop}
        style={styles.heart}>
        <Text style={[styles.heartMark, post.liked ? styles.heartOn : null]}>
          {post.liked ? '♥' : '♡'}
        </Text>
      </Press>
    </Card>
  );
}

const styles = StyleSheet.create({
  shelf: {
    gap: Spacing.s2,
    paddingBottom: Spacing.s3,
  },
  invite: {
    gap: Spacing.s1,
    padding: Spacing.s4,
    borderRadius: 12,
    backgroundColor: Colors.accentSoft,
  },
  /*
    탭 아래 선은 좌우 여백을 뚫고 나갑니다.

    <p>여백 안에 가두면 선이 양쪽에서 20픽셀씩 모자라, 화면을 가르는
    가닥이 아니라 내용 위에 얹힌 상자의 밑변으로 보입니다.
  */

  applied: {
    flexWrap: 'wrap',
  },
  /* 가로로 흐르는 조건 줄. 왼쪽 글자선에서 시작해 화면 오른쪽 끝까지 흐릅니다. */
  sieveBleed: {
    marginRight: -Gutter,
  },
  sieve: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
    paddingRight: Gutter,
  },

  /*
    글 카드.

    <p>여백을 걷습니다 — 사진이 판 끝까지 닿아야 하고, 글은 제 여백을
    따로 가집니다. 모서리 밖으로 삐져나오는 것은 판이 잘라 냅니다.
  */
  post: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
  },
  /* 바뀌기 전 글. 흐린 정도는 {@link Skeleton} 의 칸이 가장 흐려졌을 때와
     같은 값입니다 — 기다리는 것은 이 앱에서 한 가지 몸짓입니다. */
  stale: {
    opacity: 0.5,
  },
  media: {
    backgroundColor: Colors.fill,
  },
  /* 판이 이미 모서리를 쥐고 있으니 사진은 제 모서리와 테두리를 내놓습니다. */
  flat: {
    borderRadius: 0,
    borderWidth: 0,
  },
  said: {
    padding: Spacing.s4,
    gap: Spacing.s1,
  },
  /* 사진 위에 얹는 꼬리표. 어두운 사진에서도 읽히게 흰 바탕을 깝니다. */
  span: {
    position: 'absolute',
    left: Spacing.s3,
    bottom: Spacing.s3,
    paddingHorizontal: Spacing.s2,
    paddingVertical: 2,
    borderRadius: Radius.r1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  spanLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  tagRow: {
    paddingHorizontal: Spacing.s4,
    paddingBottom: Spacing.s4,
  },
  /* 사진 오른쪽 위에 떠 있는 흰 원. 지도 위 단추와 같은 생김새입니다. */
  heart: {
    position: 'absolute',
    top: Spacing.s3,
    right: Spacing.s3,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.float,
  },
  heartMark: {
    fontSize: 18,
    lineHeight: 22,
    color: Colors.textMuted,
  },
  heartOn: {
    color: Colors.like,
  },
});
