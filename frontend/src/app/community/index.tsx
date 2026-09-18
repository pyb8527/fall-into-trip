import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, query } from '@/api/client';
import type { PostCard, PostDays, PostPage, PostSort } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { PostMap } from '@/components/post-map';
import { SignUpGate } from '@/components/signup-gate';
import { Spacing } from '@/constants/theme';
import type { Comeback } from '@/lib/comeback';
import {
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
  Loading,
  Pager,
  Row,
  Screen,
  SearchField,
  SegmentedTabs,
  Split,
  Subtitle,
} from '@/ui';

/**
 * 남들이 올린 일정.
 *
 * <p>로그인 없이도 열립니다. 추천을 누르거나 가져가려 할 때만 로그인을
 * 요구합니다.
 */
/**
 * 어느 글을 볼지.
 *
 * <h3>한 줄에 두 가지가 섞여 있었습니다</h3>
 *
 * <p>인기·최신·추천순·내가 누른·내 글, 다섯이 한 띠에 있었습니다. 그런데
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
  { value: 'liked', label: '내가 누른' },
  { value: 'mine', label: '내 글' },
];

/** 세우는 법. 조건 판 안에 있습니다. */
const SORTS: { value: PostSort; label: string }[] = [
  { value: 'hot', label: '인기순' },
  { value: 'new', label: '최신순' },
  { value: 'top', label: '추천순' },
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
  const [region, setRegion] = useState<string | null>(null);
  const [days, setDays] = useState<PostDays | null>(null);

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

  const { data, error, loading, reload, setData } = useAsync<PostPage>(
    (signal) =>
      view === 'mine' || view === 'liked'
        ? api.get(`/api/posts/${view}${query({ page })}`, signal)
        : api.get(`/api/posts${query({ sort, region, days, q, page })}`, signal),
    [view, sort, page, region, days, q],
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
    <Screen>
      <SegmentedTabs
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
        좁은 폰에서 석 줄이고, 그 위에 찾기 칸과 띠까지 있으니 <b>정작 보러
        온 목록이 늘 화면 밖에서 시작했습니다.</b>

        고를 수 있는 것은 판 안으로 넣고, 밖에는 <b>지금 걸려 있는 것</b>만
        남깁니다. 대개 하나나 둘이고, 아무것도 안 걸렸으면 한 줄도 안 먹습니다.
      */}
      {PRIVATE.includes(view) ? null : (
        <View style={styles.filters}>
          <SearchField
            label="찾기"
            value={typed}
            onChangeText={setTyped}
            placeholder="도쿄, 온천, 아이와 함께"
            onSearch={() => refilter(() => setQ(typed.trim()))}
          />

          <Split>
            <Row gap={Spacing.xs} style={styles.applied}>
              {/* 세우는 법은 늘 걸려 있으므로 조건 칩으로 안 뺍니다. 대신
                  지금 무엇으로 서 있는지를 단추에 적어 둡니다 — 판 안에만
                  두면 어떻게 서 있는지 보려고 판을 열어야 합니다. */}
              <Button
                label={
                  picked.length > 0
                    ? `${SORTS.find((x) => x.value === sort)?.label} · 조건 ${picked.length}`
                    : (SORTS.find((x) => x.value === sort)?.label ?? '인기순')
                }
                variant="secondary"
                compact
                onPress={() => setSifting(true)}
              />
              {picked.map((p) => (
                <FilterChip key={p.key} label={p.label} onRemove={() => refilter(p.clear)} />
              ))}
            </Row>
            {data ? <Caption tone="secondary">{data.total.toLocaleString()}개</Caption> : null}
          </Split>
        </View>
      )}

      <BottomSheet
        visible={sifting}
        title="조건"
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
          <Row gap={Spacing.sm}>
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
              <Button
                label="모두 지우기"
                variant="secondary"
                onPress={() =>
                  refilter(() => {
                    setRegion(null);
                    setDays(null);
                    setTyped('');
                    setQ('');
                  })
                }
              />
            ) : null}
          </Row>
        }>
        <Body small strong>
          세우는 법
        </Body>
        <Row gap={Spacing.xs} style={styles.applied}>
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
        <Row gap={Spacing.xs} style={styles.applied}>
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

        <Body small strong>
          며칠
        </Body>
        <Row gap={Spacing.xs} style={styles.applied}>
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

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && data.posts.length === 0 ? (
        <Empty
          message={
            view === 'mine'
              ? '아직 내놓은 길이 없습니다. 여행 화면에서 내놓을 수 있습니다.'
              : view === 'liked'
                ? '아직 하트를 누른 글이 없습니다. 마음에 드는 길에 눌러 두세요.'
                : filtered
                ? '조건에 맞는 길이 없습니다. 조건을 줄여 보세요.'
                : '아직 올라온 길이 없습니다. 첫 번째가 되어 보세요.'
          }
        />
      ) : null}

      {data?.posts.map((post) => (
        <PostRow
          key={post.id}
          post={post}
          onOpen={() => router.push(`/community/${post.id}`)}
          onLike={() => toggleLike(post)}
        />
      ))}

      <Pager
        page={data?.page ?? 0}
        totalPages={data?.totalPages ?? 0}
        onPage={setPage}
      />

      <SignUpGate intent={gate} onClose={() => setGate(null)} />
    </Screen>
  );
}

function PostRow({
  post,
  onOpen,
  onLike,
}: {
  post: PostCard;
  onOpen: () => void;
  onLike: () => void;
}) {
  return (
    <Card>
      {/* 글로 들어가는 자리와 하트를 나눕니다. 카드 전체가 눌리면 하트를
          누르려다 글이 열립니다. */}
      {/* 글자만 늘어놓으면 어떤 동선인지 열어 봐야 압니다. 지도 한 장이면
          어디를 어떻게 도는지가 한눈에 보입니다. */}
      <Pressable onPress={onOpen} accessibilityRole="button" style={styles.tap}>
        <PostMap postId={post.id} title={post.title} height={150} />
        <Subtitle>{post.title}</Subtitle>
        {post.summary ? (
          <Body small tone="secondary" numberOfLines={2}>
            {post.summary}
          </Body>
        ) : null}
        <Caption tone="secondary">
          {post.region ? `${post.region} · ` : ''}
          {post.authorName} · {post.dayCount}일 · {post.placeCount}곳
        </Caption>
      </Pressable>

      <Split gap={Spacing.sm}>
        <Caption tone="secondary">조회 {post.viewCount.toLocaleString()}</Caption>
        {/* 하트는 목록에서 바로 누릅니다. 글을 열어야만 누를 수 있으면
            구경하다 마음에 든 것을 지나치게 됩니다. */}
        <Button
          label={`${post.liked ? '♥' : '♡'} ${post.likeCount}`}
          variant="ghost"
          compact
          onPress={onLike}
        />
      </Split>
    </Card>
  );
}


const styles = StyleSheet.create({
  filters: {
    gap: Spacing.md,
  },
  applied: {
    flexWrap: 'wrap',
  },
  tap: {
    gap: Spacing.xs,
  },
});
