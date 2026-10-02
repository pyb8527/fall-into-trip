import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { FeedPost, FeedSlice } from '@/api/types';
import { FeedCard } from '@/components/feed-card';
import { FeedForm } from '@/components/feed-form';
import { Spacing } from '@/constants/theme';
import { Button, Caption, Chip, Empty, ErrorNote, Press, Row, SegmentedTabs, Skeleton, Split } from '@/ui';
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
  /**
   * 지금 받는 중인 쪽이 <b>이어 붙이는</b> 것인지.
   *
   * <p>{@code loading} 하나로는 두 가지가 구별되지 않습니다 — 「더 보기」로
   * 다음 쪽을 받는 중인 것과, 태그를 바꿔 목록을 갈아 끼우는 중인 것. 둘은
   * 화면에 보여 줄 것이 반대입니다. 이어 붙이는 동안 있던 글을 흐리게 하면
   * 읽던 글이 흐려지고, 갈아 끼우는 동안 단추만 돌고 있으면 바뀐 조건이
   * 먹혔는지 알 수 없습니다.
   */
  const [adding, setAdding] = useState(false);
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
      setAdding(onto);
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

      {/*
        처음 받는 동안 — 글이 올 자리를 미리 세웁니다.

        <p>{@link Loading} 이 섰습니다. 마이페이지의 「피드」 칸은 띠를 옮길
        때마다 이 부품이 새로 서는 자리라, 칸을 누를 때마다 점 셋이 한 번 돌고
        나서야 글이 들어섰습니다 — 13번이 「부자연스럽다」고 한 것이 이 자리에서
        가장 세게 보입니다.

        <p>둘입니다. {@link Skeleton} 의 칸은 {@link FeedCard} 의 <b>머리줄</b>
        (얼굴과 이름과 시각)만큼이라, 그 아래 사진 띠(320)까지 자리를 잡아 주지는
        못합니다. 그래도 가운데에서 도는 것보다는 위에서 자라는 쪽이 낫습니다 —
        사진 높이까지 비워 두려면 카드 꼴의 칸이 따로 있어야 하고 그것은
        {@link Skeleton} 쪽에서 낼 일입니다. 다섯을 세워 메우지는 않습니다.
        안 올 글을 약속하는 것이 비는 것보다 나쁩니다.
      */}
      {loading && posts.length === 0 ? <Skeleton rows={2} /> : null}

      {/* 못 받아 왔을 때는 안 답니다. 위에 「다시 시도」가 떠 있는 채로
          「아직 올린 글이 없어요」가 같이 적히면, 못 받은 것이 없는 것으로
          읽힙니다 — 글이 있는 사람에게 없다고 말하는 것입니다. */}
      {!loading && !error && posts.length === 0 ? (
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

      {/*
        태그를 바꾸는 동안 — 있던 글을 흐리게 둡니다.

        <p>여기서는 {@link Skeleton} 을 쓸 수가 없습니다. 태그를 바꾸면 다시
        받지만 {@code setPosts} 는 <b>닿았을 때만</b> 불리므로, 받는 동안
        화면에는 바뀌기 전 글들이 그대로 서 있습니다. 그 자리에 회색 칸을
        세우려면 있는 글을 일부러 걷어야 하고, 그러면 목록이 한 번 비는
        것으로 돌아갑니다.

        <p>대신 흐리게 둡니다. 「이건 아직 바뀌기 전 것」이라는 말을 자리를
        옮기지 않고 할 수 있는 유일한 방법입니다 — 글 위에 바퀴를 얹는 것도
        생각했는데, 그러면 가려진 글이 무엇인지 보려고 바퀴가 사라질 때까지
        기다리게 됩니다.

        <p>0.5 는 {@link Skeleton} 의 칸이 가장 흐려졌을 때와 같은 값입니다.
        기다리는 것은 이 앱에서 한 가지 몸짓입니다.

        <p>이어 붙이는 중({@code adding})에는 안 흐려집니다 — 읽고 있던 글이
        흐려질 일이 없어야 합니다.

        <p><b>감싸는 칸은 간격을 다시 가집니다.</b> 그냥 감싸면 카드들이
        {@code body} 의 gap 밖으로 나가 서로 붙어 섭니다. 글이 없으면 칸도 안
        냅니다 — 높이가 0 이어도 {@code body} 의 gap 은 빈 칸 앞뒤로 한 번씩
        들어가서, 빈 자리 아래가 까닭 없이 벌어집니다.
      */}
      {posts.length > 0 ? (
        <View style={[styles.list, loading && !adding ? styles.stale : null]}>
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
        </View>
      ) : null}

      {more ? (
        <Button
          label="더 보기"
          variant="secondary"
          /* 이어 붙이는 중에만 돕니다. {@code loading} 을 그대로 넘기면 태그를
             바꿀 때도 이 단추가 돌아서, 다음 쪽을 받는 중인 것처럼 보였습니다. */
          busy={loading && adding}
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
  /* 글들을 담는 칸. {@code body} 가 가진 것과 같은 간격을 다시 가집니다 —
     감싸는 칸이 하나 끼면 카드들은 그 안에서 서므로, 여기에 적지 않으면
     카드 넷이 붙어 한 덩어리로 읽힙니다. */
  list: {
    gap: Spacing.s5,
  },
  /* 바뀌기 전 목록. 흐린 정도는 {@link Skeleton} 의 칸이 가장 흐려졌을 때와
     같습니다. */
  stale: {
    opacity: 0.5,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
