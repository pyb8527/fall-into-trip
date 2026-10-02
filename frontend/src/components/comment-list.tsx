import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Comment, Itinerary } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Colors, Radius, Spacing, Type, Weight } from '@/constants/theme';
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
  Split,
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
        <Split align="baseline">
          <Subtitle>댓글</Subtitle>
          {comments ? <Caption tone="secondary">{comments.length}</Caption> : null}
        </Split>
      )}

      {failed ? <ErrorNote message={failed} /> : null}
      {error ? <ErrorNote message={error} /> : null}
      {comments === null ? <Loading /> : null}
      {comments && shown.length === 0 ? (
        <Empty
          message={
            at
              ? '이 장소에 대한 댓글은 아직 없어요. 먼저 남겨 보세요.'
              : '아직 댓글이 없어요. 먼저 남겨 보세요.'
          }
        />
      ) : null}

      {shown.map((comment, i) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          /* 장소별 판 안에서는 어느 장소인지 판 제목이 이미 말하고 있습니다.
             같은 말을 한 번 더 붙이지 않습니다. */
          where={at ? null : whereOf(comment)}
          first={i === 0}
          action={
            comment.mine ? (
              <IconButton
                name="trash-2"
                label="내가 쓴 댓글 지우기"
                tone="danger"
                bare
                disabled={busy}
                onPress={() => run(() => api.delete(`/api/comments/${comment.id}`))}
              />
            ) : user ? (
              <IconButton
                name="flag"
                label="이 댓글 신고"
                bare
                onPress={() => setReporting(comment)}
              />
            ) : null
          }
        />
      ))}

      <Divider />

      {user ? (
        <>
          <Field
            label={at ? '이 장소에 남기는 댓글' : '일정 전체에 남기는 댓글'}
            value={text}
            onChangeText={setText}
            placeholder={
              at ? '여기 말고 옆집이 더 나아요' : '첫날은 좀 빡세요. 하나 빼는 게 어떨까요?'
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
        message="여러 사람이 신고하면 운영자가 확인할 때까지 자동으로 감춰져요."
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
 * 댓글 한 줄.
 *
 * <p>목록과 {@link CommentPeek} 이 같은 것을 봅니다. 두 곳에 따로 적어 두면
 * 얼굴 자리 크기나 이름 줄의 모양이 한쪽만 바뀌어, <b>같은 댓글이 자리마다
 * 다른 모양</b>이 됩니다.
 *
 * @param where  어디에 달린 것인지. 장소별 판에서는 판 제목이 말하므로 안 답니다
 * @param action 이 줄에서 바로 하는 일 — 지우기·신고. 읽기만 하는 자리에는 없습니다
 * @param first  목록의 첫 줄인지. 첫 줄 위에는 선을 안 긋습니다
 */
function CommentRow({
  comment,
  where,
  action,
  first,
}: {
  comment: Comment;
  where?: string | null;
  action?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <View style={[styles.item, first ? null : styles.itemEdge]}>
      {/* 누가 말하는지를 얼굴 자리로 먼저 말합니다. 이름 첫 글자를
          동그라미에 담습니다 — 그림이 없어도 줄이 누구의 것인지
          한눈에 갈립니다. */}
      <View style={styles.face}>
        <Text style={styles.faceLetter}>{comment.authorName.slice(0, 1)}</Text>
      </View>

      <View style={styles.said}>
        {/*
          누가 말하는지를 먼저 답니다.

          <p>전에는 글이 먼저고 이름이 아래였습니다. 한둘일 때는 읽혔는데
          여남은 개가 이어지면 어느 이름이 위의 글 것인지 아래 글 것인지
          헷갈립니다 — 이름이 두 글 사이에 끼어 있기 때문입니다.
        */}
        <Split>
          <Caption tone="secondary">
            {comment.authorName} · {comment.createdAt.slice(0, 10)}
          </Caption>
          {action}
        </Split>
        {where ? <Badge label={where} tone="muted" /> : null}
        <Body small>{comment.text}</Body>
      </View>
    </View>
  );
}

/**
 * 먼저 보여 주는 몇 줄.
 *
 * <h3>단추 하나만 있었습니다</h3>
 *
 * <p>장소 판에 「댓글 남기기」 단추만 서 있었습니다. 그러면 그 판은 구글이
 * 아는 것만 적힌 자리이고, <b>남이 여기서 뭐라고 했는지</b>는 한 번 더 눌러야
 * 알 수 있었습니다 — 거기에 읽을 것이 있는지 모르는 채로는 대개 안 누릅니다.
 *
 * <p>{@link CommentList} 를 그대로 얹지는 않습니다. 그쪽은 적는 칸과 신고
 * 다이얼로그까지 거느린 <b>댓글을 다루는 자리</b>이고, 판에 필요한 것은
 * <b>읽을 줄 몇 개</b>입니다. 지우기·신고도 안 답니다 — 다루는 일이 두
 * 자리에 흩어지면 한쪽만 고치는 일이 생깁니다.
 *
 * @param max 몇 줄까지. 서버가 개수 한도를 안 받으므로 받아 온 것을 여기서 자릅니다
 */
export function CommentPeek({ comments, max = 5 }: { comments: Comment[]; max?: number }) {
  /* 서버는 쓴 순서(오래된 것부터)로 줍니다. 「최근 다섯」은 그래서 <b>뒤에서
     다섯</b>이고, 자른 뒤에 순서를 뒤집지는 않습니다 — 「더 보기」로 전체를
     열었을 때 같은 줄이 같은 순서로 서 있어야 방금 읽던 자리를 다시 찾습니다. */
  const shown = comments.slice(-max);

  return (
    <View style={styles.wrap}>
      {shown.map((comment, i) => (
        <CommentRow key={comment.id} comment={comment} first={i === 0} />
      ))}
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
    gap: Spacing.s2,
  },
  /*
    댓글 하나.

    <h3>카드에서 줄로</h3>

    <p>한동안 댓글마다 흰 판을 둘렀습니다. 회색 바닥 위에서는 그것이 「한
    장에 한 사람 말」 로 읽혔는데, 바닥이 흰색이 된 뒤로는 <b>판이 아예
    안 보이면서</b> 안쪽 여백만큼 글자를 밀어 넣는 일만 했습니다.

    <p>어디서 한 사람 말이 끝나는지는 선 한 가닥이 말합니다. 댓글은 눌러서
    들어가는 물건이 아니라 읽어 내려가는 줄입니다 — 줄 사이를 가르는 것은
    이 앱에서 선입니다.
  */
  item: {
    flexDirection: 'row',
    gap: Spacing.s3,
    paddingVertical: Spacing.s4,
  },
  /* 첫 줄 위에는 안 긋습니다 — 위의 제목과 사이가 선으로 막히면 제목이
     첫 댓글처럼 보입니다. */
  itemEdge: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  /* 이름 첫 글자가 드는 동그라미. 댓글 줄의 아바타 자리입니다. */
  face: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceLetter: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Colors.textSecondary,
  },
  said: {
    flex: 1,
    gap: Spacing.s1,
  },
});
