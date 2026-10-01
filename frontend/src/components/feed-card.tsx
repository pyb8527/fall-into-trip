import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { FeedPost } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { PhotoStrip } from '@/components/photo-strip';
import { Spacing } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import {
  Body,
  Caption,
  Card,
  Chip,
  ConfirmDialog,
  Divider,
  ErrorNote,
  Field,
  Icon,
  IconButton,
  Press,
  Row,
  Split,
} from '@/ui';

/**
 * 피드 글 한 편.
 *
 * <h3>사진이 먼저, 글이 아래, 태그가 그 아래</h3>
 *
 * <p>사람들이 피드를 내리면서 보는 것은 사진입니다. 글을 위에 두면 사진을
 * 보려고 글을 지나쳐야 하고, 그러면 둘 다 안 읽힙니다.
 *
 * <h3>댓글은 접어 둡니다</h3>
 *
 * <p>목록에서 글마다 댓글이 펼쳐져 있으면 세 편만 지나도 화면이 댓글로
 * 찹니다. 몇 개인지만 보여 주고, 누르면 열립니다 — 그때 불러옵니다.
 */
export function FeedCard({
  post,
  onChanged,
  onEdit,
}: {
  post: FeedPost;
  onChanged: () => void;
  /** 고치기를 누르면. 안 주면 고치기 단추를 안 냅니다. */
  onEdit?: (post: FeedPost) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function drop() {
    setBusy(true);
    setFailed(null);
    try {
      await api.delete(`/api/feed/${encodeURIComponent(post.id)}`);
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Split gap={Spacing.sm}>
        <Row gap={Spacing.xs} style={styles.who}>
          <Body>{faceOf(post.authorMark, post.authorName)}</Body>
          <Body strong>{post.authorName}</Body>
          <Caption tone="muted">{ago(post.createdAt)}</Caption>
        </Row>
        {/* 지우기는 글쓴이와 모임 주인이 합니다. 주인인지는 서버만 아는데,
            눌러 보고 알게 하는 것보다 눌러서 막히는 편이 낫습니다 — 치울
            길이 아예 안 보이면 치울 수 있다는 것도 모릅니다. */}
        <Row gap={Spacing.xs}>
          {post.mine && onEdit ? (
            <IconButton name="settings" label="이 글 고치기" bare onPress={() => onEdit(post)} />
          ) : null}
          <IconButton
            name="x"
            label="이 글 지우기"
            tone="danger"
            bare
            onPress={() => setDropping(true)}
          />
        </Row>
      </Split>

      {post.photoIds.length > 0 ? <PhotoStrip ids={post.photoIds} height={320} /> : null}

      {post.text ? <Body>{post.text}</Body> : null}

      {post.tags.length > 0 ? (
        <Row gap={Spacing.xs} style={styles.wrap}>
          {post.tags.map((t) => (
            <Caption key={t} tone="accent">
              #{t}
            </Caption>
          ))}
        </Row>
      ) : null}

      {/* 어느 여행 이야기인지. 누르면 그 여행으로 갑니다 — 「그때 어디였지」가
          글을 읽다가 가장 자주 드는 생각입니다. */}
      {post.tripId && post.tripTitle ? (
        <Press
          onPress={() => router.push({ pathname: '/trip/[id]', params: { id: post.tripId! } })}
          accessibilityLabel={`${post.tripTitle} 여행 보기`}
          style={styles.where}>
          <Icon name="map-pin" size={14} tone="muted" />
          <Caption tone="secondary">{post.tripTitle}</Caption>
        </Press>
      ) : null}

      {failed ? <ErrorNote message={failed} /> : null}

      <Press
        onPress={() => setOpen(!open)}
        accessibilityLabel={open ? '댓글 접기' : '댓글 보기'}
        style={styles.talk}>
        <Row gap={Spacing.xs}>
          <Icon name="message-square" size={14} tone="muted" />
          <Caption tone="secondary">
            {post.commentCount > 0 ? `댓글 ${post.commentCount}` : '댓글 남기기'}
          </Caption>
        </Row>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} tone="muted" />
      </Press>

      {open ? <Talk postId={post.id} onChanged={onChanged} /> : null}

      <ConfirmDialog
        visible={dropping}
        title="이 글을 지울까요?"
        message="사진은 안 지워져요. 글에서 떨어질 뿐이라 저장한 곳에는 그대로 있어요."
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

/** 댓글 한 토막. 펼쳤을 때만 불러옵니다. */
type Comment = {
  id: string;
  text: string;
  authorName: string;
  mine: boolean;
  createdAt: string;
};

function Talk({ postId, onChanged }: { postId: string; onChanged: () => void }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync<{ comments: Comment[] }>(
    (signal) => api.get(`/api/feed/${encodeURIComponent(postId)}/comments`, signal),
    [postId],
  );

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function send() {
    const clean = text.trim();
    if (!clean || busy) {
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      await api.post(`/api/feed/${encodeURIComponent(postId)}/comments`, { text: clean });
      /* 성공했을 때만 비웁니다 — 실패에도 비우면 길게 쓴 것이 통째로
         날아가고 다시 칠 수도 없습니다. */
      setText('');
      reload();
      /* 바깥의 댓글 수도 따라 움직여야 합니다. */
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  async function drop(id: string) {
    setFailed(null);
    try {
      await api.delete(`/api/comments/${encodeURIComponent(id)}`);
      reload();
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <View style={styles.comments}>
      <Divider />

      {loading && !data ? <Caption tone="muted">가져오는 중…</Caption> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data?.comments.map((c) => (
        <Split key={c.id} gap={Spacing.sm}>
          <View style={styles.said}>
            <Row gap={Spacing.xs}>
              <Caption strong>{c.authorName}</Caption>
              <Caption tone="muted">{ago(c.createdAt)}</Caption>
            </Row>
            <Body small>{c.text}</Body>
          </View>
          {c.mine || user ? (
            <IconButton name="x" label="이 댓글 지우기" bare onPress={() => drop(c.id)} />
          ) : null}
        </Split>
      ))}

      <Row gap={Spacing.xs}>
        <View style={styles.grow}>
          <Field
            label="한마디"
            value={text}
            onChangeText={setText}
            placeholder="좋았겠다"
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={send}
          />
        </View>
        <Chip label="남기기" selected={text.trim().length > 0} onPress={send} />
      </Row>
    </View>
  );
}

/**
 * 언제 적 것인지, 짧게.
 *
 * <p>목록에서 보고 싶은 것은 "2026-10-01 14:22" 가 아니라 "2시간 전" 입니다.
 * 며칠이 지나면 그때는 날짜가 더 쓸모 있습니다.
 */
function ago(iso: string) {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) {
    return '';
  }
  const sec = Math.max(0, (Date.now() - at) / 1000);
  if (sec < 60) {
    return '방금';
  }
  if (sec < 3600) {
    return `${Math.floor(sec / 60)}분 전`;
  }
  if (sec < 86400) {
    return `${Math.floor(sec / 3600)}시간 전`;
  }
  if (sec < 86400 * 7) {
    return `${Math.floor(sec / 86400)}일 전`;
  }
  return iso.slice(0, 10);
}

const styles = StyleSheet.create({
  who: {
    flexShrink: 1,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  where: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'transparent',
    paddingVertical: 2,
  },
  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    paddingVertical: Spacing.xs,
  },
  comments: {
    gap: Spacing.sm,
  },
  said: {
    flexShrink: 1,
    gap: 2,
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
  },
});
