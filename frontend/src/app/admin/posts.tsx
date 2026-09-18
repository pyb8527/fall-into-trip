import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
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
  Pager,
  Row,
  Screen,
  SegmentedTabs,
  Split,
  Subtitle,
  Title,
} from '@/ui';

/** 신고는 일정 글과 한 줄 두 곳에서 들어옵니다. 한 화면에서 봅니다. */
type Kind = 'posts' | 'tips' | 'comments';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'posts', label: '일정 글' },
  { value: 'tips', label: '한 줄' },
  { value: 'comments', label: '댓글' },
];

/** 한 줄과 댓글은 같은 모양입니다. 본문·글쓴이·신고 수뿐입니다. */
type ReportedTip = {
  id: string;
  text: string;
  authorName: string;
  hidden: boolean;
  reportCount: number;
  createdAt: string;
};

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

/**
 * 신고된 것.
 *
 * <p>신고가 몇 건 쌓이면 자동으로 감춰집니다. 사람이 볼 때까지 문제되는 것을
 * 첫 화면에 두지 않기 위해서인데, 그러면 되돌릴 통로도 있어야 합니다. 몇
 * 사람이 짜고 신고하면 멀쩡한 것도 내려가고, 되살릴 수 없으면 신고가 곧
 * 삭제가 됩니다.
 */
export default function AdminPosts() {
  const [kind, setKind] = useState<Kind>('posts');
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAsync<PageView<ReportedPost | ReportedTip>>(
    (signal) => api.get(`/api/admin/${kind}${query({ page, size: 20 })}`, signal),
    [kind, page],
  );

  return (
    <Screen>
      <Title>신고된 것</Title>
      <Body tone="secondary">
        신고가 쌓여 자동으로 감춰진 것과, 신고가 들어왔지만 아직 보이는 것입니다.
      </Body>

      <SegmentedTabs
        items={KINDS}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setPage(0);
        }}
      />

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data && data.items.length === 0 ? <Empty message="살펴볼 것이 없습니다." /> : null}

      {data?.items.map((item) => (
        <ReportedRow key={item.id} kind={kind} item={item} onChanged={reload} />
      ))}

      <Pager
        page={data?.page ?? 0}
        totalPages={data?.totalPages ?? 0}
        onPage={setPage}
      />
    </Screen>
  );
}

function ReportedRow({
  kind,
  item,
  onChanged,
}: {
  kind: Kind;
  item: ReportedPost | ReportedTip;
  onChanged: () => void;
}) {
  /* 글에는 제목이, 한 줄에는 본문이 있습니다. 있는 쪽을 씁니다. */
  const title = 'title' in item ? item.title : item.text;
  const post = item as ReportedPost;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function setHidden(hidden: boolean) {
    setFailed(null);
    setBusy(true);
    try {
      await api.patch(`/api/admin/${kind}/${item.id}/hidden`, { hidden });
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Split align="start" gap={Spacing.md}>
        <View style={styles.title}>
          <Subtitle>{title}</Subtitle>
          <Caption tone="secondary">
            {item.authorName} · {item.createdAt.slice(0, 10)}
          </Caption>
        </View>
        <Row gap={Spacing.xs}>
          <Badge label={`신고 ${item.reportCount}`} tone="danger" />
          {item.hidden ? <Badge label="감춰짐" tone="muted" /> : null}
        </Row>
      </Split>

      {'likeCount' in item ? (
        <Row gap={Spacing.md}>
          <Caption>추천 {post.likeCount}</Caption>
          <Caption>조회 {post.viewCount}</Caption>
        </Row>
      ) : null}

      {failed ? <ErrorNote message={failed} /> : null}

      <Row gap={Spacing.sm}>
        {item.hidden ? (
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
  title: {
    flexShrink: 1,
    gap: 2,
  },
});
