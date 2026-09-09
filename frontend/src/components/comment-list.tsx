import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Comment, Itinerary } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
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
 * 일정에 달린 의견.
 *
 * <p>글쓴이가 받겠다고 열어 둔 글에만 보입니다. 구경만 하라고 올린 글에 훈수가
 * 달리면 반갑지 않습니다.
 *
 * <p>장소 하나를 가리키는 댓글은 어디에 대한 말인지 함께 보여 줍니다. "여기
 * 말고 옆집" 은 어느 집인지가 붙어야 뜻이 통합니다.
 */
export function CommentList({
  postId,
  itinerary,
  /** 장소 옆 말풍선에서 열었을 때. 그 장소를 가리키는 댓글로 시작합니다. */
  at,
  onNeedLogin,
  onCountChanged,
}: {
  postId: string;
  itinerary: Itinerary;
  at?: { dayIndex: number; placeIndex: number } | null;
  onNeedLogin: () => void;
  onCountChanged: () => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Comment | null>(null);

  async function load() {
    try {
      const res = await api.get<{ comments: Comment[] }>(`/api/posts/${postId}/comments`);
      setComments(res.comments);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '불러오지 못했습니다.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function run(action: () => Promise<unknown>) {
    setFailed(null);
    setBusy(true);
    try {
      await action();
      await load();
      onCountChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '처리하지 못했습니다.');
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
    return place ? `${day?.shortName || day?.label || `${comment.dayIndex + 1}일차`} · ${place.name}` : null;
  }

  const shown = at
    ? (comments ?? []).filter((c) => c.dayIndex === at.dayIndex && c.placeIndex === at.placeIndex)
    : (comments ?? []);

  return (
    <View style={styles.wrap}>
      <Row style={styles.head}>
        <Subtitle>의견</Subtitle>
        {comments ? <Caption tone="secondary">{comments.length}</Caption> : null}
      </Row>

      {failed ? <ErrorNote message={failed} /> : null}
      {comments === null ? <Loading /> : null}
      {comments && shown.length === 0 ? (
        <Empty message="아직 의견이 없습니다. 먼저 남겨 보세요." />
      ) : null}

      {shown.map((comment) => {
        const where = whereOf(comment);
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
                  label="내가 남긴 의견 지우기"
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
            label={at ? '이 장소에 대한 의견' : '의견 남기기'}
            value={text}
            onChangeText={setText}
            placeholder="첫날은 좀 빡셉니다. 오후 일정을 하나 빼는 게 어떨까요?"
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
              ).then(() => setText(''))
            }
          />
        </>
      ) : (
        <Button label="로그인하고 의견 남기기" variant="secondary" onPress={onNeedLogin} />
      )}

      <ConfirmDialog
        visible={reporting !== null}
        title="이 의견을 신고할까요?"
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
