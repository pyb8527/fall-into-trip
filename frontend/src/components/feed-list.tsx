import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { FeedPost, FeedSlice } from '@/api/types';
import { FeedCard } from '@/components/feed-card';
import { FeedForm } from '@/components/feed-form';
import { Spacing } from '@/constants/theme';
import { Button, Caption, Chip, Empty, ErrorNote, Loading, Press, Row, SegmentedTabs, Split } from '@/ui';
import { OurPhoto } from '@/components/our-photo';

/**
 * 피드 한 벌.
 *
 * <p>모임 안의 띠와 (나중에) 마이페이지가 같이 씁니다. 보는 자리만 다르고
 * 모양은 같습니다 — 두 벌로 두면 한쪽만 고치는 날이 옵니다.
 *
 * <h3>더 보기로 이어 붙입니다</h3>
 *
 * <p>끝없이 흐르게 하지 않습니다. 이 피드는 아는 사람들끼리의 것이라 글이
 * 수천 편이 되지 않고, 저절로 불러오면 「어디까지 봤더라」를 잃습니다.
 */
export function FeedList({
  /** 모임 피드면 그 모임. 안 주면 내 피드입니다. */
  groupId,
  groupName,
  compact = false,
  authorId,
}: {
  groupId?: string | null;
  groupName?: string | null;
  /**
   * 마이페이지처럼 위에 이미 할 것이 많은 자리. 올리기 단추를 판 폭 회색
   * 상자 대신 오른쪽 작은 단추로 줄이고, 목록 · 사진 보기를 고를 수 있게 합니다.
   */
  compact?: boolean;
  /**
   * 남의 피드. 서버가 나와 함께 속한 모임에 올린 글만 줍니다. 올리기 단추는
   * 안 둡니다 — 남의 피드에 내가 쓸 일은 없습니다.
   */
  authorId?: string | null;
}) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [tag, setTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [writing, setWriting] = useState(false);
  /* 사진만 격자로 보기. 내 피드는 「무엇을 찍었나」를 훑는 자리이기도 합니다. */
  const [grid, setGrid] = useState(false);
  const [editing, setEditing] = useState<FeedPost | null>(null);

  const where = groupId
    ? `group=${encodeURIComponent(groupId)}`
    : authorId
      ? `author=${encodeURIComponent(authorId)}`
      : 'mine=true';

  /**
   * 한 쪽 받아 옵니다.
   *
   * @param at   몇 쪽
   * @param onto true 면 이어 붙이고, false 면 갈아 끼웁니다
   */
  const load = useCallback(
    async (at: number, onto: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const q = tag ? `&tag=${encodeURIComponent(tag)}` : '';
        const got = await api.get<FeedSlice>(`/api/feed?${where}&page=${at}${q}`);
        setPosts((was) => (onto ? [...was, ...got.posts] : got.posts));
        setMore(got.more);
        setPage(at);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : UNEXPECTED);
      } finally {
        setLoading(false);
      }
    },
    [where, tag],
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  /** 쓰거나 지운 뒤. 보던 자리를 잃지 않게 첫 쪽부터 다시 받습니다. */
  const refresh = useCallback(() => load(0, false), [load]);

  /* 글에 달린 태그들을 모읍니다. 고를 거리를 따로 받아 오지 않습니다 —
     지금 보고 있는 것들에서 뽑으면 충분하고, 왕복이 하나 줍니다. */
  const seen = Array.from(new Set(posts.flatMap((p) => p.tags))).slice(0, 12);

  return (
    <View style={styles.body}>
      {/* 채운 단추로 두지 않습니다. 이 띠가 서는 자리(모임 상세)에는 이미
          머리에 채운 단추가 하나 있고, 한 화면에 가득 찬 브랜드색은 하나여야
          어느 것이 주된 일인지 보입니다. */}
      {authorId ? null : compact ? (
        <Split align="center">
          <SegmentedTabs
            items={[
              { value: 'list', label: '목록' },
              { value: 'grid', label: '사진' },
            ]}
            value={grid ? 'grid' : 'list'}
            onChange={(v) => setGrid(v === 'grid')}
          />
          <Button label="올리기" icon="plus" variant="ghost" compact onPress={() => setWriting(true)} />
        </Split>
      ) : (
        <Button
          label={groupName ? `${groupName}에 올리기` : '피드에 올리기'}
          variant="secondary"
          onPress={() => setWriting(true)}
        />
      )}

      {(seen.length > 0 || tag) ? (
        <Row gap={Spacing.s2} style={styles.wrap}>
          <Chip label="전체" selected={tag === null} onPress={() => setTag(null)} />
          {/* 고른 태그가 지금 보이는 글에 없을 수도 있습니다(걸러진 뒤라
              그 태그만 남습니다). 그래도 칸은 서 있어야 풀 수 있습니다. */}
          {(tag && !seen.includes(tag) ? [tag, ...seen] : seen).map((t) => (
            <Chip
              key={t}
              label={`#${t}`}
              selected={tag === t}
              onPress={() => setTag(tag === t ? null : t)}
            />
          ))}
        </Row>
      ) : null}

      {error ? <ErrorNote message={error} onRetry={refresh} /> : null}
      {loading && posts.length === 0 ? <Loading /> : null}

      {!loading && posts.length === 0 ? (
        <Empty
          message={
            tag
              ? `#${tag} 가 달린 글이 없어요.`
              : groupId
                ? '아직 올라온 글이 없어요. 사진 몇 장이면 돼요.'
                : '아직 올린 글이 없어요. 사진 몇 장이면 돼요.'
          }
        />
      ) : null}

      {grid ? (
        /* 사진 격자 — 세 칸. 누르면 그 글의 고치기 판이 아니라 글이 있는
           목록으로 돌아갑니다(한 장만 크게 보는 자리는 글 카드가 이미 합니다). */
        <View style={styles.grid}>
          {posts.flatMap((p) =>
            p.photoIds.map((id) => (
              <Press key={`${p.id}-${id}`} onPress={() => setGrid(false)} scale={0.97} style={styles.cell}>
                <OurPhoto id={id} height={110} />
              </Press>
            )),
          )}
        </View>
      ) : (
        posts.map((p) => <FeedCard key={p.id} post={p} onChanged={refresh} onEdit={setEditing} />)
      )}

      {more ? (
        <Button
          label="더 보기"
          variant="secondary"
          busy={loading}
          onPress={() => load(page + 1, true)}
        />
      ) : null}

      {posts.length > 0 && !more ? (
        <Caption tone="muted">여기까지예요.</Caption>
      ) : null}

      <FeedForm
        visible={writing}
        groupId={groupId}
        groupName={groupName}
        onClose={() => setWriting(false)}
        onDone={() => {
          setWriting(false);
          refresh();
        }}
      />

      <FeedForm
        visible={editing !== null}
        groupId={groupId}
        groupName={groupName}
        post={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          refresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  /* 세 칸에서 사이 2 를 뺀 몫. */
  cell: {
    width: '32.6%',
  },
  /* 글 카드 사이. s2(8) 였습니다 — 카드 넷이 거의 붙어 서서 한 덩어리로
     읽혔습니다. 한 편과 다음 편 사이는 카드 안쪽 여백보다 넓어야 합니다. */
  body: {
    gap: Spacing.s5,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
