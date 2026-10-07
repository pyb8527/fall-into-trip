import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { FeedAudience, FeedPost } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { BlockDialog } from '@/components/block-dialog';
import { PhotoStrip } from '@/components/photo-strip';
import { ProfileFace } from '@/components/profile-face';
import { Spacing } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import { openPerson } from '@/lib/person';
import {
  Body,
  BottomSheet,
  Caption,
  Card,
  Chip,
  ConfirmDialog,
  Divider,
  ErrorNote,
  Field,
  Icon,
  IconButton,
  ListRow,
  Press,
  Row,
  Split,
  Tag,
} from '@/ui';
import { formatInstant } from '@/lib/countdown';

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
 *
 * <p>글 하나만 서는 화면은 예외입니다({@code commentsOpen}).
 *
 * <h3>공개 범위는 제 글에만 적습니다</h3>
 *
 * <p>올린 사람이 <b>한눈에</b> 알아야 하는 값입니다. 모임 피드와 내 피드가 한
 * 벌의 카드로 섞여 서므로, 적어 두지 않으면 지금 보는 글이 모임 사람에게도
 * 보이는 것인지 나만 보는 것인지를 고치는 판을 열어야 압니다.
 *
 * <p>남의 글에는 안 적습니다. 보고 있다는 것이 이미 「볼 수 있다」는 답이고,
 * 그 위에 「이 사람은 모임 사람에게만 열어 두었다」를 얹으면 읽는 사람이 할
 * 일이 없는 말이 글마다 한 줄씩 붙습니다.
 */
export function FeedCard({
  post,
  onChanged,
  onEdit,
  commentsOpen = false,
  onGone,
}: {
  post: FeedPost;
  onChanged: () => void;
  /** 고치기를 누르면. 안 주면 고치기 단추를 안 냅니다. */
  onEdit?: (post: FeedPost) => void;
  /**
   * 댓글을 펼친 채로 시작할지.
   *
   * <p>목록에서는 접혀 있어야 합니다(위 설명). 그런데 이 글 하나만 서는
   * 화면({@code app/feed/[id]})에서는 접을 이유가 없습니다 — 거기서 읽을
   * 것은 이 글과 이 글에 달린 말이 전부고, 들어온 사람은 그것을 보러 온
   * 것입니다. 한 번 더 누르게 할 일이 아닙니다.
   */
  commentsOpen?: boolean;
  /**
   * 이 글이 지워졌으면.
   *
   * <p>안 주면 {@code onChanged} 가 대신 불립니다 — 목록에서는 다시 읽으면
   * 이 카드가 그 자리에서 빠지므로 그것으로 충분합니다. 글 하나만 서는
   * 화면은 다시 읽을 것이 없어서(서버가 없다고 답합니다) 지운 직후에
   * 「글을 찾을 수 없어요」가 뜹니다. 지운 사람에게 그건 오류가 아니라
   * 제가 한 일이라, 그 화면은 돌려보내는 쪽을 고릅니다.
   */
  onGone?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(commentsOpen);
  const [dropping, setDropping] = useState(false);
  /* 이 글 다루기 판. 고치기와 지우기를 그림 둘로 세워 두었는데, 지우기가
     빨간 X 라 글마다 빨강이 하나씩 떠 있었습니다. ⋯ 하나로 접습니다. */
  const [acting, setActing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /* 남의 글에서 하는 두 가지 — 신고와 차단. 「모두」로 열어 둔 글은 모르는
     사람도 보므로, 문제되는 글을 내릴 길이 글 옆에 있어야 합니다. */
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState<{ id: string; name: string } | null>(null);
  /* 신고가 들어갔다는 한 줄. 아무 말이 없으면 눌린 줄도 모릅니다. */
  const [said, setSaid] = useState<string | null>(null);

  async function report() {
    setBusy(true);
    setFailed(null);
    try {
      await api.post(`/api/feed/${encodeURIComponent(post.id)}/report`, { reason: '' });
      setSaid('신고했어요. 운영자가 확인해요.');
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  async function drop() {
    setBusy(true);
    setFailed(null);
    try {
      await api.delete(`/api/feed/${encodeURIComponent(post.id)}`);
      (onGone ?? onChanged)();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Split gap={Spacing.s2}>
        {/*
          글쓴이. 누르면 그 사람 페이지로.

          <p>동그라미와 그 안의 크기를 이 카드가 손수 그리고 있었습니다. 사진이
          들어오면서 <b>사진 · 표식 · 이름</b> 세 갈래가 이 파일에도 한 벌
          생길 자리였습니다 — 한 칸으로 묶습니다({@link ProfileFace}).

          <p>{@code faceOf} 를 {@code mark} 자리에 넘깁니다. 그 함수가 곧
          「표식, 없으면 이름 첫 글자」라서, 사진이 먼저 걸리고 없을 때 이것이
          서는 것이 그대로 세 갈래의 차례입니다.

          <p>40 입니다. 댓글 줄의 이름보다 한 단 큽니다 — 글 한 편의
          주인입니다.
        */}
        <Press
          onPress={() => openPerson(router, post.authorId, user?.id)}
          scale={0.98}
          accessibilityLabel={`${post.authorName} 페이지`}
          style={[styles.who, styles.whoRow]}>
          <ProfileFace
            photoId={post.authorPhotoId}
            mark={faceOf(post.authorMark, post.authorName)}
            size={40}
            label={`${post.authorName}의 얼굴`}
          />
          <View style={styles.name}>
            <Body strong numberOfLines={1}>
              {post.authorName}
            </Body>
            {/* 시간 옆에 붙입니다. 줄을 따로 두면 카드마다 한 줄이 늘어나
                목록이 그만큼 짧아집니다. */}
            <Row gap={Spacing.s2}>
              <Caption tone="muted">{ago(post.createdAt)}</Caption>
              {post.mine ? <Seen audience={post.audience} /> : null}
            </Row>
          </View>
        </Press>
        {/* 지우기는 글쓴이와 모임 주인이 합니다. 주인인지는 서버만 아는데,
            눌러 보고 알게 하는 것보다 눌러서 막히는 편이 낫습니다 — 치울
            길이 아예 안 보이면 치울 수 있다는 것도 모릅니다. */}
        <IconButton
          name="more-horizontal"
          label="이 글 다루기"
          bare
          onPress={() => setActing(true)}
        />
      </Split>

      {post.photoIds.length > 0 ? <PhotoStrip ids={post.photoIds} height={320} /> : null}

      {post.text ? <Body>{post.text}</Body> : null}

      {/*
        꼬리표.

        <p>{@code tone="accent"} 로 적고 있었습니다. 그런데 이 앱에서 글자의
        accent 는 <b>검정</b>이라, "#온천" 이 본문과 똑같은 검정 글씨였습니다 —
        누를 수 있는 것처럼 보이면서 누를 수도 없었습니다. 작은 회색 면에
        담아 「붙어 있는 이름표」 로 둡니다.

        <p>그 면을 여기서 손으로 그리고 있었습니다. 이 카드가 둘러보기·좋아요·
        내 글 세 화면에 서는데 꼬리표 모양은 이 파일에만 적혀 있어서, 다른
        데의 같은 꼬리표와 조용히 어긋났습니다. 공용 {@link Tag} 로 돌립니다.
      */}
      {post.tags.length > 0 ? (
        <Row gap={Spacing.s2} style={styles.wrap}>
          {post.tags.map((t) => (
            <Tag key={t} label={`#${t}`} />
          ))}
        </Row>
      ) : null}

      {/* 어느 여행 이야기인지. 누르면 그 여행으로 갑니다 — 「그때 어디였지」가
          글을 읽다가 가장 자주 드는 생각입니다. */}
      {post.tripId && post.tripTitle ? (
        <Press
          onPress={() => router.push({ pathname: '/trip/[id]', params: { id: post.tripId! } })}
          accessibilityLabel={
            post.placeName
              ? `${post.placeName} · ${post.tripTitle} 여행 보기`
              : `${post.tripTitle} 여행 보기`
          }
          style={styles.where}>
          <Icon name="map-pin" size={14} tone="muted" />
          {/* 장소까지 적습니다. 핀 그림이 이미 「어디」를 뜻하는데 여행 이름만
              서 있으면, 그 글이 그 여행의 <b>어느 자리</b>인지는 한 줄도 안
              말해 줍니다.

              일정에서 장소가 빠진 글은 이름이 안 와서(ON DELETE SET NULL) 여행
              이름만 남습니다. 그 글도 글자와 사진은 그대로입니다 — 장소 한 줄을
              빼는 일이 남의 글을 지우는 일이면 안 됩니다. */}
          <Caption tone="secondary">
            {post.tripTitle}
            {post.placeName ? ` · ${post.placeName}` : ''}
          </Caption>
        </Press>
      ) : null}

      {failed ? <ErrorNote message={failed} /> : null}
      {said ? <Caption tone="secondary">{said}</Caption> : null}

      <Press
        onPress={() => setOpen(!open)}
        accessibilityLabel={open ? '댓글 접기' : '댓글 보기'}
        style={styles.talk}>
        <Row gap={Spacing.s2}>
          <Icon name="message-square" size={14} tone="muted" />
          <Caption tone="secondary">
            {post.commentCount > 0 ? `댓글 ${post.commentCount}` : '댓글 남기기'}
          </Caption>
        </Row>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} tone="muted" />
      </Press>

      {open ? <Talk postId={post.id} onChanged={onChanged} /> : null}

      <BottomSheet visible={acting} title="이 글" onClose={() => setActing(false)}>
        {post.mine && onEdit ? (
          <ListRow
            left={<Icon name="edit-2" tone="secondary" />}
            title="고치기"
            onPress={() => {
              setActing(false);
              onEdit(post);
            }}
          />
        ) : null}
        {/* 남의 글이면 신고와 차단이 먼저입니다. 지우기는 모임 주인만 되는
            일이라(위 설명) 대개 막히고, 남의 글에서 사람이 찾는 것은 이 둘입니다. */}
        {!post.mine && user ? (
          <>
            <ListRow
              left={<Icon name="flag" tone="secondary" />}
              title="신고"
              onPress={() => {
                setActing(false);
                setReporting(true);
              }}
            />
            <ListRow
              left={<Icon name="user-minus" tone="secondary" />}
              title="이 사람 차단"
              onPress={() => {
                setActing(false);
                setBlocking({ id: post.authorId, name: post.authorName });
              }}
            />
          </>
        ) : null}
        <ListRow
          left={<Icon name="trash-2" tone="secondary" />}
          title="지우기"
          last
          onPress={() => {
            setActing(false);
            setDropping(true);
          }}
        />
      </BottomSheet>

      <ConfirmDialog
        visible={reporting}
        title="이 글을 신고할까요?"
        message="여러 사람이 신고하면 운영자가 확인할 때까지 자동으로 감춰져요."
        confirmLabel="신고"
        danger
        busy={busy}
        onCancel={() => setReporting(false)}
        onConfirm={() => {
          setReporting(false);
          report();
        }}
      />

      {/* 막으면 그 사람의 글이 목록에서 빠집니다. 글 하나만 서는 화면은 다시
          읽을 것이 없어 돌려보냅니다 — 지웠을 때와 같은 갈래입니다. */}
      <BlockDialog
        person={blocking}
        onCancel={() => setBlocking(null)}
        onDone={() => {
          setBlocking(null);
          (onGone ?? onChanged)();
        }}
        onFailed={setFailed}
      />

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

/**
 * 누가 볼 수 있는지, 그림 하나와 한 마디로.
 *
 * <p>그림만 두지 않습니다. 눈 그림과 사람 그림을 가려 읽으라고 하면 처음 보는
 * 사람은 못 읽고, 작은 회색 그림이라 더 그렇습니다. 말만 두지도 않습니다 —
 * 시간 옆에 글자만 더 붙으면 날짜의 일부로 읽힙니다.
 *
 * <p>「내 모임 사람만」을 「내 모임」으로 줄입니다. 이 자리는 알림이 아니라
 * 표라서, 줄여 적어도 뜻이 안 흐려지고 긴 글자는 이름 줄을 밀어냅니다.
 */
function Seen({ audience }: { audience: FeedAudience }) {
  const shown = SEEN[audience];
  return (
    <Row gap={Spacing.s1}>
      <Icon name={shown.icon} size={12} tone="muted" />
      <Caption tone="muted">{shown.label}</Caption>
    </Row>
  );
}

/** 값은 서버의 {@code feed/domain/Audience} 와 같아야 합니다. */
const SEEN: Record<FeedAudience, { icon: 'eye' | 'users' | 'eye-off'; label: string }> = {
  EVERYONE: { icon: 'eye', label: '모두' },
  MATES: { icon: 'users', label: '내 모임' },
  ONLY_ME: { icon: 'eye-off', label: '나만' },
};

/** 댓글 한 토막. 펼쳤을 때만 불러옵니다. */
type Comment = {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
  mine: boolean;
  createdAt: string;
};

function Talk({ postId, onChanged }: { postId: string; onChanged: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
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

      {loading && !data ? <Caption tone="muted">가져오고 있어요</Caption> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data?.comments.map((c) => (
        <Split key={c.id} gap={Spacing.s2}>
          <View style={styles.said}>
            <Row gap={Spacing.s2}>
              <Press onPress={() => openPerson(router, c.authorId, user?.id)} scale={0.97}>
                <Caption strong>{c.authorName}</Caption>
              </Press>
              <Caption tone="muted">{ago(c.createdAt)}</Caption>
            </Row>
            <Body small>{c.text}</Body>
          </View>
          {c.mine || user ? (
            <IconButton name="x" label="이 댓글 지우기" bare onPress={() => drop(c.id)} />
          ) : null}
        </Split>
      ))}

      <Row gap={Spacing.s2}>
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
  return formatInstant(iso);
}

const styles = StyleSheet.create({
  whoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
  },
  who: {
    flexShrink: 1,
  },
  name: {
    flexShrink: 1,
    gap: 2,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  where: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s1,
    backgroundColor: 'transparent',
    paddingVertical: 2,
  },
  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    paddingVertical: Spacing.s1,
  },
  comments: {
    gap: Spacing.s2,
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
