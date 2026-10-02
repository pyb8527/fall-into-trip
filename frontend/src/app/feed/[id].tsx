import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { api } from '@/api/client';
import type { FeedPost } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { FeedCard } from '@/components/feed-card';
import { ErrorNote, Loading, Screen } from '@/ui';
import { PathTitle } from '@/ui/nav';

/**
 * 피드 글 한 편.
 *
 * <h3>왜 이 화면이 따로 있어야 했나</h3>
 *
 * <p>글을 담는 표가 둘입니다. 피드 글({@code feed/domain/Post})과 둘러보기에
 * 내놓은 여행기({@code community/domain/TripPost})는 이름만 닮았고 서로 다른
 * 표입니다. 그런데 글 하나를 보는 화면은 여행기 쪽에만 있어서
 * ({@code app/community/[id]}), 여행 앨범에서 사진을 누르면 <b>피드 글 번호를
 * 들고 여행기 화면</b>으로 들어갔습니다. 그 화면이 {@code /api/posts/{번호}} 를
 * 부르고 서버는 없다고 답하니, 지운 적도 없는 글이 「글을 찾을 수 없어요」로
 * 보였습니다 — 애초에 그 표에서 찾은 적이 없습니다.
 *
 * <p>번호를 옮겨 주는 것으로는 안 됩니다. 두 표의 글은 생긴 것부터 다릅니다 —
 * 여행기는 일정 사본과 장소마다의 댓글을 들고 있고, 피드 글은 사진 몇 장과 한
 * 줄입니다. 한쪽 화면이 다른 쪽을 그릴 수 없으니 피드 글이 설 자리를 냅니다.
 *
 * <p>사진만 크게 띄우고 마는 길도 있었습니다({@code photo-viewer}). 값은 싼데,
 * 누가 올렸는지도 어떤 여행이었는지도 달린 말도 없이 사진 한 장만 떠서 <b>그
 * 글을 본 것</b>이 안 됩니다. 앨범에서 사진을 누르는 사람이 궁금한 것은 대개
 * 사진의 크기가 아니라 그 사진의 사연입니다.
 *
 * <h3>카드를 그대로 한 장 세웁니다</h3>
 *
 * <p>글 모양을 여기서 다시 그리지 않고 {@link FeedCard} 를 세웁니다. 목록과 이
 * 화면이 다르게 보이면 같은 글이 두 모습을 갖고, 꼬리표 하나를 고칠 때마다 두
 * 군데를 고치게 됩니다. 서버도 {@code GET /api/feed/{id}} 가 이미 있어 새로 낼
 * 길이 없습니다.
 *
 * <p>고치기 단추는 안 답니다. 고치는 판({@code FeedForm})은 피드가 들고 있고,
 * 그것을 여기까지 끌어오면 읽는 화면이 쓰는 화면을 겸하게 됩니다. 이 화면으로
 * 오는 길은 앨범의 사진이라 읽으러 온 자리입니다 — 고치는 일은 제 피드에서
 * 합니다.
 */
export default function FeedPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, error, loading, reload } = useAsync<{ post: FeedPost }>(
    (signal) => api.get(`/api/feed/${encodeURIComponent(id)}`, signal),
    [id],
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorNote message={error ?? '글을 찾을 수 없어요.'} onRetry={reload} />
      </Screen>
    );
  }

  const post = data.post;

  return (
    <Screen>
      {/* 막대의 큰 줄은 <b>어느 여행이었나</b>입니다 — 앨범에서 들어오므로 그
          이름을 들고 온 셈이고, 여행이 지워졌거나 안 묶인 글이면 올린 사람이
          그 자리에 섭니다. 「피드 글」만 크게 적어 두면 어느 글인지는 한 줄도
          안 말해 줍니다. */}
      {/* 장소에 묶인 글이면 <b>그 장소</b>가 큰 줄입니다. 여행 이름보다 좁은
          말이고, 앨범에서 사진을 누르는 사람이 알고 싶은 것도 「어느 여행」보다
          「어디서 찍은 것」입니다. 일정에서 장소가 빠진 글은 이름이 안 와서
          (ON DELETE SET NULL) 여행 이름으로 내려갑니다. */}
      <Stack.Screen
        options={{
          title: '피드 글',
          headerTitle: () => (
            <PathTitle
              parent={post.placeName ?? post.tripTitle ?? post.authorName}
              title="피드 글"
            />
          ),
        }}
      />

      {/* 지우면 여기 남을 것이 없습니다. 다시 읽으면 서버가 없다고 답하니
          「글을 찾을 수 없어요」가 뜨는데, 지운 사람에게 그건 오류가 아니라
          제가 한 일입니다. 조용히 왔던 곳으로 돌려보냅니다. */}
      <FeedCard
        post={post}
        commentsOpen
        onChanged={reload}
        onGone={() => router.back()}
      />
    </Screen>
  );
}
