import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, query } from '@/api/client';
import type { PostCard, PostPage, PostSort } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import {
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorNote,
  Loading,
  Row,
  Screen,
  SegmentedTabs,
  Subtitle,
  Title,
} from '@/ui';

/**
 * 남들이 올린 일정.
 *
 * <p>로그인 없이도 열립니다. 추천을 누르거나 가져가려 할 때만 로그인을
 * 요구합니다.
 */
const SORTS: { value: PostSort; label: string }[] = [
  { value: 'hot', label: '인기' },
  { value: 'new', label: '최신' },
  { value: 'top', label: '추천순' },
];

export default function Community() {
  const router = useRouter();
  const { user } = useAuth();
  const [sort, setSort] = useState<PostSort>('hot');
  const [page, setPage] = useState(0);

  const { data, error, loading, reload, setData } = useAsync<PostPage>(
    (signal) => api.get(`/api/posts${query({ sort, page })}`, signal),
    [sort, page],
  );

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
      <View style={styles.head}>
        <Title>여행 이야기</Title>
        <Body tone="secondary">남이 다녀온 일정을 구경하고, 마음에 들면 그대로 가져오세요.</Body>
      </View>

      <SegmentedTabs
        items={SORTS}
        value={sort}
        onChange={(next) => {
          setSort(next);
          setPage(0);
        }}
      />

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && data.posts.length === 0 ? (
        <Empty message="아직 올라온 일정이 없습니다. 첫 번째가 되어 보세요." />
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
      <Pressable onPress={onOpen} accessibilityRole="button" style={styles.tap}>
        <Subtitle>{post.title}</Subtitle>
        {post.summary ? (
          <Body small tone="secondary" numberOfLines={2}>
            {post.summary}
          </Body>
        ) : null}
        <Caption tone="secondary">
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

const styles = StyleSheet.create({
  head: {
    gap: Spacing.xs,
  },
  tap: {
    gap: Spacing.xs,
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
