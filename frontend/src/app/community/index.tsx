import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { api, API_BASE, query } from '@/api/client';
import type { PostCard, PostDays, PostPage, PostSort } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Row,
  Screen,
  SegmentedTabs,
  Subtitle,
} from '@/ui';

/**
 * 남들이 올린 일정.
 *
 * <p>로그인 없이도 열립니다. 추천을 누르거나 가져가려 할 때만 로그인을
 * 요구합니다.
 */
/**
 * 무엇을 볼지.
 *
 * 정렬과 "내 글" 은 성격이 다르지만 한 줄에 둡니다. 내 글을 보러 화면을 따로
 * 만들면 올리고 나서 그것을 어디서 찾는지가 또 하나의 질문이 됩니다.
 */
type Tab = PostSort | 'mine' | 'liked';

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
  { value: 'hot', label: '인기' },
  { value: 'new', label: '최신' },
  { value: 'top', label: '추천순' },
  /* 구경하다 마음에 든 것을 눌러 두고는 나중에 찾지 못했습니다. 추천이
     세는 데만 쓰이고 되찾는 길이 없었습니다. */
  { value: 'liked', label: '내가 누른' },
  { value: 'mine', label: '내 글' },
];

/** 나만 볼 수 있는 것들. 로그인하지 않았으면 띠에서 뺍니다. */
const PRIVATE: Tab[] = ['mine', 'liked'];

export default function Community() {
  const router = useRouter();
  const { user } = useAuth();
  const [view, setView] = useState<Tab>('hot');
  const [page, setPage] = useState(0);

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

  /** 무엇으로든 거르고 있는지. 아무것도 안 걸렸을 때만 안내를 띄웁니다. */
  const filtered = q !== '' || region !== null || days !== null;

  const { data, error, loading, reload, setData } = useAsync<PostPage>(
    (signal) =>
      view === 'mine' || view === 'liked'
        ? api.get(`/api/posts/${view}${query({ page })}`, signal)
        : api.get(`/api/posts${query({ sort: view, region, days, q, page })}`, signal),
    [view, page, region, days, q],
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
      router.push('/(auth)/login?next=/community');
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
      {/* 위 막대가 이미 이름을 적고 있습니다. */}
      <Body tone="secondary">
        남이 다녀온 길을 구경하고, 탐나면 통째로 가져오세요.
      </Body>

      <SegmentedTabs
        items={user ? TABS : TABS.filter((t) => !PRIVATE.includes(t.value))}
        value={view}
        onChange={(next) => {
          setView(next);
          setPage(0);
        }}
      />

      {/* 내 글에는 거르기를 두지 않습니다. 몇 개 안 되는 것을 또 거를 이유가
          없고, 서버도 내 글에는 조건을 받지 않습니다. */}
      {PRIVATE.includes(view) ? null : (
        <View style={styles.filters}>
          {/* 돋보기는 칸 안 오른쪽 끝에 붙입니다. 아래에 따로 두면 둘이 한
              벌로 안 읽히고 세로로만 길어집니다. */}
          <Field
            label="찾기"
            value={typed}
            onChangeText={setTyped}
            placeholder="도쿄, 온천, 아이와 함께"
            returnKeyType="search"
            onSubmitEditing={() => refilter(() => setQ(typed.trim()))}
            action={{
              icon: 'search',
              label: '찾기',
              onPress: () => refilter(() => setQ(typed.trim())),
            }}
          />
          {q ? (
            <Row gap={Spacing.sm}>
              <Button
                label={`"${q}" 지우기`}
                variant="ghost"
                compact
                onPress={() =>
                  refilter(() => {
                    setTyped('');
                    setQ('');
                  })
                }
              />
            </Row>
          ) : null}

          <Row gap={Spacing.xs}>
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

          <Row gap={Spacing.xs}>
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

          {data ? <Caption tone="secondary">{data.total.toLocaleString()}개</Caption> : null}
        </View>
      )}

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

      {data && data.totalPages > 1 ? (
        <Row style={styles.pager}>
          <Button
            label="이전"
            variant="secondary"
            compact
            disabled={page === 0}
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          />
          <Caption>
            {data.page + 1} / {data.totalPages}
          </Caption>
          <Button
            label="다음"
            variant="secondary"
            compact
            disabled={page >= data.totalPages - 1}
            onPress={() => setPage((p) => p + 1)}
          />
        </Row>
      ) : null}
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

      <Row style={styles.meta}>
        <Caption tone="secondary">조회 {post.viewCount.toLocaleString()}</Caption>
        {/* 하트는 목록에서 바로 누릅니다. 글을 열어야만 누를 수 있으면
            구경하다 마음에 든 것을 지나치게 됩니다. */}
        <Button
          label={`${post.liked ? '♥' : '♡'} ${post.likeCount}`}
          variant="ghost"
          compact
          onPress={onLike}
        />
      </Row>
    </Card>
  );
}


/**
 * 동선 그림.
 *
 * <p>서버가 구글에서 받아 우리 주소로 내보냅니다. 키를 안 넣어 두었거나
 * 좌표가 하나도 없는 일정이면 못 받아 오는데, 그때 자리를 그대로 두면 회색
 * 상자만 덩그러니 남습니다. 아예 비웁니다.
 */
function PostMap({ postId, title, height }: { postId: string; title: string; height: number }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return null;
  }
  return (
    <Image
      source={{ uri: `${API_BASE}/api/posts/${postId}/map` }}
      style={[styles.thumb, { height }]}
      resizeMode="cover"
      accessibilityLabel={`${title} 동선`}
      onError={() => setBroken(true)}
    />
  );
}

const styles = StyleSheet.create({
  filters: {
    gap: Spacing.sm,
  },
  tap: {
    gap: Spacing.xs,
  },
  thumb: {
    width: '100%',
    borderRadius: Radius.md,
    backgroundColor: Colors.fill,
  },
  meta: {
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pager: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
