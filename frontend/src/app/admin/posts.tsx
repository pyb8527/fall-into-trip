import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query } from '@/api/client';
import type { PageView } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorNote,
  Loading,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

/**
 * 신고된 글.
 *
 * <p>신고가 몇 건 쌓이면 글이 자동으로 감춰집니다. 사람이 볼 때까지 문제되는
 * 글을 첫 화면에 두지 않기 위해서인데, 그러면 되돌릴 통로도 있어야 합니다.
 * 몇 사람이 짜고 신고하면 멀쩡한 글도 내려가고, 되살릴 수 없으면 신고가 곧
 * 삭제가 됩니다.
 */
type ReportedPost = {
  id: string;
  title: string;
  authorName: string;
  hidden: boolean;
  reportCount: number;
  likeCount: number;
  viewCount: number;
  createdAt: string;
};

export default function AdminPosts() {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAsync<PageView<ReportedPost>>(
    (signal) => api.get(`/api/admin/posts${query({ page, size: 20 })}`, signal),
    [page],
  );

  return (
    <Screen>
      <Title>신고된 글</Title>
      <Body tone="secondary">
        신고가 쌓여 자동으로 감춰진 글과, 신고가 들어왔지만 아직 보이는 글입니다.
      </Body>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data && data.items.length === 0 ? <Empty message="살펴볼 글이 없습니다." /> : null}

      {data?.items.map((post) => (
        <PostRow key={post.id} post={post} onChanged={reload} />
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

function PostRow({ post, onChanged }: { post: ReportedPost; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function setHidden(hidden: boolean) {
    setFailed(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/posts/${post.id}/hidden`, { hidden });
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row style={styles.head}>
        <View style={styles.title}>
          <Subtitle>{post.title}</Subtitle>
          <Caption tone="secondary">
            {post.authorName} · {post.createdAt.slice(0, 10)}
          </Caption>
        </View>
        <Row gap={Spacing.xs}>
          <Badge label={`신고 ${post.reportCount}`} tone="danger" />
          {post.hidden ? <Badge label="감춰짐" tone="muted" /> : null}
        </Row>
      </Row>

      <Row gap={Spacing.md}>
        <Caption>추천 {post.likeCount}</Caption>
        <Caption>조회 {post.viewCount}</Caption>
      </Row>

      {failed ? <ErrorNote message={failed} /> : null}

      <Row gap={Spacing.sm}>
        {post.hidden ? (
          <Button
            label="다시 올리기"
            variant="secondary"
            compact
            busy={busy}
            onPress={() => setHidden(false)}
          />
        ) : (
          <Button label="감추기" variant="danger" compact busy={busy} onPress={() => setHidden(true)} />
        )}
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  title: {
    flexShrink: 1,
    gap: 2,
  },
  pager: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
