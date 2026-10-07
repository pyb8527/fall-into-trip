import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, query, UNEXPECTED } from '@/api/client';
import type { PageView } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Gutter, Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Loading,
  Pager,
  Row,
  Screen,
  Split,
  Subtitle,
  Tabs,
  Title,
} from '@/ui';

/**
 * 신고는 다섯 곳에서 들어옵니다. 한 화면에서 봅니다.
 *
 * <p>피드 글과 프로필이 나중에 붙었습니다(스토어 준비 3단계). 피드 글은 한 줄과
 * 모양이 같아 같은 줄로 그리고, 프로필은 다루는 일이 달라(감추기가 아니라
 * 신고 거두기 · 비우기) 줄을 따로 둡니다.
 */
type Kind = 'posts' | 'feed' | 'tips' | 'comments' | 'profiles';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'posts', label: '일정 글' },
  { value: 'feed', label: '피드 글' },
  { value: 'tips', label: '한 줄' },
  { value: 'comments', label: '댓글' },
  { value: 'profiles', label: '프로필' },
];

/**
 * 신고된 프로필 한 줄.
 *
 * <p>세 사람이 신고하면 남에게 보이는 소개와 사진이 감춰집니다({@code held}).
 * 이름은 안 감춥니다 — 모임 안에서 누가 누구인지는 알아야 합니다.
 */
type ReportedProfile = {
  userId: string;
  name: string;
  bio?: string | null;
  photoId?: string | null;
  reportCount: number;
  held: boolean;
  reasons: string[];
  lastAt: string;
};

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
  const { data, error, loading, reload } = useAsync<
    PageView<ReportedPost | ReportedTip | ReportedProfile>
  >(
    (signal) => api.get(`/api/admin/${kind}${query({ page, size: 20 })}`, signal),
    [kind, page],
  );

  return (
    <Screen>
      <Title>신고된 것</Title>
      <Body tone="secondary">
        신고가 쌓여 자동으로 감춰진 것과, 신고가 들어왔지만 아직 보이는 거예요.
      </Body>

      {/* 밑줄 탭입니다. 칸마다 부르는 길이 다르고 줄에 달리는 단추도 다릅니다 —
          같은 목록을 다르게 늘어놓는 것이 아니라 볼 것이 통째로 바뀝니다. */}
      <Tabs
        items={KINDS}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setPage(0);
        }}
      />

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {/* 여기가 비어 있는 것은 <b>좋은 일</b>입니다. 다른 화면의 빈 자리와
          달리 할 일을 달지 않고, 비어 있는 까닭만 적습니다. */}
      {data && data.items.length === 0 ? (
        <Empty
          icon="check"
          message="살펴볼 것이 없어요."
          note="신고가 들어오면 여기에 쌓입니다."
        />
      ) : null}

      {data?.items.map((item) =>
        kind === 'profiles' ? (
          <ProfileRow
            key={(item as ReportedProfile).userId}
            item={item as ReportedProfile}
            onChanged={reload}
          />
        ) : (
          <ReportedRow
            key={(item as ReportedPost | ReportedTip).id}
            kind={kind}
            item={item as ReportedPost | ReportedTip}
            onChanged={reload}
          />
        ),
      )}

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

  const [dropping, setDropping] = useState(false);

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

  /*
    피드 글만 지우기가 있습니다.

    <p>다른 것들은 감추기로 충분했습니다 — 여행기는 사본이고 한 줄은 이레면
    안 보입니다. 피드 글은 사진이 실리고 「모두」로 열어 둔 것은 번호만 알면
    누구나 봅니다. 운영자가 문제가 맞다고 본 사진을 감춘 채로만 둘 까닭이
    없습니다. 사진 파일은 올린 사람의 보관함에 남습니다(글에서 떼기만 합니다).
  */
  async function drop() {
    setFailed(null);
    setBusy(true);
    try {
      await api.delete(`/api/feed/${encodeURIComponent(item.id)}`);
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
          <Button label="감추기" variant="dangerText" compact busy={busy} onPress={() => setHidden(true)} />
        )}
        {kind === 'feed' ? (
          <Button
            label="지우기"
            variant="dangerText"
            compact
            busy={busy}
            onPress={() => setDropping(true)}
          />
        ) : null}
      </Row>

      <ConfirmDialog
        visible={dropping}
        title="이 피드 글을 지울까요?"
        message="글과 댓글이 지워지고 되돌릴 수 없어요. 사진 파일은 올린 사람에게 남아요."
        confirmLabel="지우기"
        danger
        busy={busy}
        onCancel={() => setDropping(false)}
        onConfirm={() => {
          setDropping(false);
          drop();
        }}
      />
    </Card>
  );
}

/**
 * 신고된 프로필.
 *
 * <p>할 일이 둘입니다. <b>괜찮다</b>면 신고를 거둡니다 — 감춰져 있던 소개와
 * 사진이 다시 보입니다. <b>문제가 맞다</b>면 소개와 사진을 비웁니다 — 그 사람이
 * 새로 적는 것은 다시 보입니다. 이름은 어느 쪽이든 그대로입니다.
 */
function ProfileRow({ item, onChanged }: { item: ReportedProfile; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setFailed(null);
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  const id = encodeURIComponent(item.userId);

  return (
    <Card>
      <Split align="start" gap={Spacing.md}>
        <View style={styles.title}>
          <Subtitle>{item.name}</Subtitle>
          <Caption tone="secondary">
            {item.bio ? item.bio : '한 줄 소개 없음'}
            {item.photoId ? ' · 사진 있음' : ''}
          </Caption>
        </View>
        <Row gap={Spacing.xs}>
          <Badge label={`신고 ${item.reportCount}`} tone="danger" />
          {item.held ? <Badge label="감춰짐" tone="muted" /> : null}
        </Row>
      </Split>

      {item.reasons.length > 0 ? (
        <Caption tone="secondary">{item.reasons.join(' · ')}</Caption>
      ) : null}

      {failed ? <ErrorNote message={failed} /> : null}

      <Row gap={Spacing.sm}>
        <Button
          label="신고 거두기"
          variant="secondary"
          compact
          busy={busy}
          onPress={() => run(() => api.delete(`/api/admin/profiles/${id}/reports`))}
        />
        <Button
          label="소개 · 사진 비우기"
          variant="dangerText"
          compact
          busy={busy}
          onPress={() => setWiping(true)}
        />
      </Row>

      <ConfirmDialog
        visible={wiping}
        title={`${item.name} 님의 소개와 사진을 비울까요?`}
        message="이름은 그대로예요. 사진 파일은 그 사람의 보관함에 남아요."
        confirmLabel="비우기"
        danger
        busy={busy}
        onCancel={() => setWiping(false)}
        onConfirm={() => {
          setWiping(false);
          run(() => api.post(`/api/admin/profiles/${id}/wipe`, {}));
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  /*
    탭 아래 선은 좌우 여백을 뚫고 나갑니다.

    <p>여백 안에 가두면 선이 양쪽에서 20픽셀씩 모자라, 화면을 가르는
    가닥이 아니라 내용 위에 얹힌 상자의 밑변으로 보입니다.
  */

  title: {
    flexShrink: 1,
    gap: 2,
  },
});
