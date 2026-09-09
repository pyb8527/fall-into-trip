import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Comment, Itinerary } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  ConfirmDialog,
  Divider,
  Empty,
  ErrorNote,
  Field,
  IconButton,
  Loading,
  Row,
  Subtitle,
} from '@/ui';

/**
 * 일정에 달린 댓글.
 *
 * <p>글쓴이가 받겠다고 열어 둔 글에만 보입니다. 구경만 하라고 올린 글에 훈수가
 * 달리면 반갑지 않습니다.
 *
 * <p>댓글은 두 가지입니다. 일정 전체에 대한 것("첫날이 좀 빡세요")과 장소
 * 하나에 대한 것("여기 말고 옆집")입니다. 전에는 이 둘을 한 목록에 두고
 * 말풍선을 눌러 <b>걸러서</b> 봤는데, 눌러도 화면이 그대로인 것처럼 보여서
 * 무엇이 일어났는지 알 수 없었습니다. 되돌리는 단추도 따로 있었습니다.
 *
 * <p>이제 장소 댓글은 그 장소에 딸린 판에서 읽고 씁니다 — 한 줄 팁과 같은
 * 방식입니다. 아래 목록은 거르지 않고 전부 보여 줍니다.
 */

/**
 * 한 글의 댓글을 한 번만 받아 옵니다.
 *
 * <p>장소마다 몇 개인지 세는 것과 판에 펼쳐 보여 주는 것이 같은 것을 봐야
 * 합니다. 따로 받아 오면 하나 남긴 뒤 한쪽 숫자만 늘어납니다.
 */
export function useComments(postId: string, enabled: boolean) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setComments([]);
      return;
    }
    try {
      const res = await api.get<{ comments: Comment[] }>(`/api/posts/${postId}/comments`);
      setComments(res.comments);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }, [postId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { comments, failed, reload };
}

/** 그 장소를 가리키는 댓글이 몇 개인지. 목록에서 바로 셀 수 있게 키로 만듭니다. */
export function countByPlace(comments: Comment[] | null) {
  const out = new Map<string, number>();
  for (const c of comments ?? []) {
    if (c.dayIndex == null || c.placeIndex == null) {
      continue;
    }
    const key = `${c.dayIndex}:${c.placeIndex}`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

type ListProps = {
  postId: string;
  itinerary: Itinerary;
  comments: Comment[] | null;
  failed: string | null;
  reload: () => void;
  onNeedLogin: () => void;
  /** 개수가 달라졌으니 글 머리의 숫자도 다시 세야 합니다. */
  onCountChanged: () => void;
  /** 이 자리를 가리키는 것만. 비우면 전부 보여 줍니다. */
  at?: { dayIndex: number; placeIndex: number } | null;
  /** 판 안에 들어갈 때는 제목을 두지 않습니다. 판이 이미 제목을 답니다. */
  bare?: boolean;
};

export function CommentList({
  postId,
  itinerary,
  comments,
  failed,
  reload,
  onNeedLogin,
  onCountChanged,
  at,
  bare,
}: ListProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Comment | null>(null);

  /**
   * 서버에 한 번 다녀옵니다.
   *
   * <p>됐는지를 돌려줍니다. 적어 둔 글을 비우는 것은 성공했을 때뿐입니다 —
   * 실패에도 비우면 길게 쓴 것이 통째로 날아가고 다시 칠 수도 없습니다.
   */
  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await reload();
      onCountChanged();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** 어느 장소를 두고 한 말인지. 사본의 자리라 나중에 어긋나지 않습니다. */
  function whereOf(comment: Comment) {
    if (comment.dayIndex == null || comment.placeIndex == null) {
      return null;
    }
    const day = itinerary.days[comment.dayIndex];
    const place = day?.places[comment.placeIndex];
    return place
      ? `${day?.shortName || day?.label || `${comment.dayIndex + 1}일차`} · ${place.name}`
      : null;
  }

  const shown = at
    ? (comments ?? []).filter((c) => c.dayIndex === at.dayIndex && c.placeIndex === at.placeIndex)
    : (comments ?? []);

  return (
    <View style={styles.wrap}>
      {bare ? null : (
        <Row style={styles.head}>
          <Subtitle>댓글</Subtitle>
          {comments ? <Caption tone="secondary">{comments.length}</Caption> : null}
        </Row>
      )}

      {failed ? <ErrorNote message={failed} /> : null}
      {error ? <ErrorNote message={error} /> : null}
      {comments === null ? <Loading /> : null}
      {comments && shown.length === 0 ? (
        <Empty
          message={
            at
              ? '이 장소에 대한 댓글은 아직 없습니다. 먼저 남겨 보세요.'
              : '아직 댓글이 없습니다. 먼저 남겨 보세요.'
          }
        />
      ) : null}

      {shown.map((comment) => {
        /* 장소별 판 안에서는 어느 장소인지 판 제목이 이미 말하고 있습니다.
           같은 말을 한 번 더 붙이지 않습니다. */
        const where = at ? null : whereOf(comment);
        return (
          <View key={comment.id} style={styles.item}>
            {where ? <Badge label={where} tone="muted" /> : null}
            <Body>{comment.text}</Body>
            <Row style={styles.meta}>
              <Caption tone="secondary">
                {comment.authorName} · {comment.createdAt.slice(0, 10)}
              </Caption>
              {comment.mine ? (
                <IconButton
                  name="trash-2"
                  label="내가 쓴 댓글 지우기"
                  tone="danger"
                  disabled={busy}
                  onPress={() => run(() => api.delete(`/api/comments/${comment.id}`))}
                />
              ) : user ? (
                <Button label="신고" variant="ghost" compact onPress={() => setReporting(comment)} />
              ) : null}
            </Row>
          </View>
        );
      })}

      <Divider />

      {user ? (
        <>
          <Field
            label={at ? '이 장소에 남기는 댓글' : '일정 전체에 남기는 댓글'}
            value={text}
            onChangeText={setText}
            placeholder={
              at ? '여기 말고 옆집이 더 낫습니다' : '첫날은 좀 빡셉니다. 하나 빼는 게 어떨까요?'
            }
            hint="500자까지"
          />
          <Button
            label="남기기"
            busy={busy}
            disabled={!text.trim()}
            onPress={() =>
              run(() =>
                api.post(`/api/posts/${postId}/comments`, {
                  text: text.trim(),
                  dayIndex: at?.dayIndex,
                  placeIndex: at?.placeIndex,
                }),
              ).then((done) => {
                if (done) {
                  setText('');
                }
              })
            }
          />
        </>
      ) : (
        <Button label="로그인하고 댓글 남기기" variant="secondary" onPress={onNeedLogin} />
      )}

      <ConfirmDialog
        visible={reporting !== null}
        title="이 댓글을 신고할까요?"
        message="여러 사람이 신고하면 운영자가 확인할 때까지 자동으로 감춰집니다."
        confirmLabel="신고"
        danger
        busy={busy}
        onCancel={() => setReporting(null)}
        onConfirm={() => {
          const target = reporting;
          setReporting(null);
          if (target) {
            run(() => api.post(`/api/comments/${target.id}/report`, {}));
          }
        }}
      />
    </View>
  );
}

/**
 * 장소 하나에 대한 댓글만 모아 보는 판.
 *
 * <p>한 줄 팁과 같은 방식입니다. 이미 아는 몸짓이라 따로 배울 것이 없습니다.
 *
 * <p>제목에 장소 이름을 답니다. "여기 말고 옆집" 은 어느 집인지가 붙어야 뜻이
 * 통합니다.
 */
export function PlaceComments({
  visible,
  placeName,
  onClose,
  ...rest
}: ListProps & { visible: boolean; placeName: string; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} title={`${placeName} 댓글`} onClose={onClose}>
      {visible ? <CommentList {...rest} bare /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.md,
  },
  head: {
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  item: {
    gap: Spacing.xs,
  },
  meta: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
