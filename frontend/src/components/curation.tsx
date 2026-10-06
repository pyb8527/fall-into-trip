import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { PopularRegion, PostPage } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { NearbyPlaces } from '@/components/nearby-places';
import { TripThumb } from '@/components/trip-thumb';
import { Colors, Spacing } from '@/constants/theme';
import { Body, Button, Caption, Press, Split } from '@/ui';

/**
 * 여러 기준으로 다시 묶어 보여 주는 줄들.
 *
 * <h3>왜 따로 빼는가</h3>
 *
 * <p>둘러보기 안에만 있었습니다. 그런데 같은 일이 필요한 자리가 하나 더
 * 있습니다 — <b>내 여행</b> 입니다. 여행이 하나도 없거나 다녀온 것만 남아
 * 있으면 그 화면은 할 일이 없는 화면이 되는데, 거기서 다음 여행이 시작됩니다.
 *
 * <p>두 화면이 같은 줄을 쓰지만 <b>같은 묶음을 쓰지는 않습니다.</b> 둘러보기는
 * 글을 고르러 온 자리라 글 묶음만 섭니다({@link Curation}). 내 여행은 다음
 * 여행을 꾸릴 자리라 지역·여행기·내 근처 셋이 서고, 줄마다 <b>누르면 가는
 * 데</b>가 다릅니다({@link WhereNext}).
 *
 * <h3>묶음은 서버가 거른 것만</h3>
 *
 * <p>한동안 「{@code 여행 이름 첫 낱말} 여행 모음」이라는 줄이 있었습니다.
 * 글 본문을 글자로 훑는 {@code q=} 로 찾는 것이라 걸리는 것이 그 지역
 * 여행기라는 보장이 없었고, 「엄마랑 셋이 가는 교토」는 「엄마랑 여행 모음」이
 * 됐습니다. 지웠습니다.
 *
 * <p>그래서 규칙이 하나 섭니다 — <b>묶음은 서버가 실제로 거르는 값</b>
 * ({@code sort=}·{@code region=}·{@code tag=})으로만 만듭니다. 제목에서
 * 짐작한 말은 묶음 이름이 될 수 없습니다.
 */

/**
 * 둘러보기의 큐레이션 줄들 — 이번 주 많이 가져간 · 새로 올라온 · 많이 쓴 태그 둘.
 *
 * <p>줄마다 몇 장만 받습니다(size). 줄 하나가 비면 그 줄은 안 그립니다.
 *
 * <h3>태그 목록은 받아 쓰기만 합니다</h3>
 *
 * <p>여기서 {@code /api/posts/tags} 를 직접 불렀습니다. 그런데 이 줄들을
 * 세우는 둘러보기 화면도 <b>조건 고르는 판을 위해 같은 길을 부릅니다</b>
 * ({@code community/index.tsx}). 둘이 같이 뜨므로 한 화면이 같은 것을 두
 * 번 물었습니다 — 서버는 글 전체의 태그를 세는 일을 두 번 했습니다.
 *
 * <p>그래서 값으로 받습니다. 받는 쪽을 <b>안 비워 둘 수 있게</b> 필수로
 * 둡니다 — 없으면 여기서 다시 부르게 만들면, 안 넘기는 자리가 하나
 * 생기는 순간 두 번 묻는 일이 조용히 돌아옵니다.
 *
 * @param tags 많이 쓰인 순서로 온 태그들. 아직 안 왔으면 {@code null}
 */
export function Curation({
  tags,
  total,
  onOpen,
  onTag,
}: {
  tags: { tag: string; posts: number }[] | null;
  /** 걸러지지 않은 전체 글 수. 적으면 줄을 안 세웁니다. */
  total: number;
  onOpen: (id: string) => void;
  onTag: (tag: string) => void;
}) {
  const shelfTags = (tags ?? []).slice(0, 2).map((t) => t.tag);
  const paths = [
    '/api/posts?sort=copied&size=6',
    '/api/posts?sort=new&size=6',
    ...shelfTags.map((tag) => `/api/posts?sort=hot&size=6&tag=${encodeURIComponent(tag)}`),
  ];
  const enough = total >= CURATION_MIN;
  const { data } = useAsync<PostPage[]>(
    (signal) => (enough ? Promise.all(paths.map((path) => api.get<PostPage>(path, signal))) : Promise.resolve([])),
    [enough, paths.join('|')],
  );
  if (!enough || !data) {
    return null;
  }

  /*
    같은 글은 한 화면에 한 번만.

    <p>「같은 여행이 여러 줄에 나와도 괜찮다 — 여러 기준으로 다시 묶어 보여
    주면 열 개뿐이어도 고를 맛이 난다」고 적어 두고 있었습니다. 운영 서버에서
    눌러 보니 반대였습니다 — 글이 셋일 때 같은 세 장이 「많이 가져간」 ·
    「새로 올라온」 · #발리 · #우붓 · 아래 목록까지 다섯 번 섰고, 화면은
    고를 맛이 아니라 <b>이것뿐</b>이라는 말을 다섯 번 했습니다.

    <p>그래서 위 줄에 선 글은 아래 줄에서 뺍니다. 빼고 나서 세 장이 안 되는
    줄은 안 세웁니다 — 한두 장짜리 줄은 「묶음」이 아니라 빈자리입니다. 그리고
    글이 {@link CURATION_MIN} 개보다 적으면 줄을 아예 안 세웁니다. 그때는
    아래 목록 하나가 전부를 보여 주고, 줄은 그 목록을 되풀이할 뿐입니다.
  */
  const seen = new Set<string>();
  const rows = data.map((page, i) => {
    let posts = page.posts.filter((p) => !seen.has(p.id));
    /* 아무도 안 가져간 글은 「많이 가져간」 줄에 서면 안 됩니다. 서버의
       sort=copied 는 차례만 정하고 거르지는 않습니다(목록의 정렬로도 써서). */
    if (i === 0) {
      posts = posts.filter((p) => (p.copyCount ?? 0) > 0);
    }
    if (posts.length < SHELF_MIN) {
      return { posts: [] as PostPage['posts'] };
    }
    posts.forEach((p) => seen.add(p.id));
    return { posts };
  });

  return (
    <>
      <Shelf title="많이 가져간 여행" posts={rows[0].posts} onOpen={onOpen} />
      <Shelf title="새로 올라온 여행" posts={rows[1].posts} onOpen={onOpen} />
      {shelfTags.map((tag, i) => (
        <Shelf
          key={tag}
          title={`#${tag}`}
          posts={rows[2 + i]?.posts ?? []}
          onOpen={onOpen}
          onMore={() => onTag(tag)}
        />
      ))}
    </>
  );
}

/** 이보다 글이 적으면 둘러보기에 줄을 안 세웁니다. 줄 둘(여섯 장씩)이 서로 안 겹칠 만큼. */
const CURATION_MIN = 12;
/** 겹치는 것을 빼고 나서 이보다 적으면 그 줄은 안 섭니다. */
const SHELF_MIN = 3;

/**
 * 내 여행에 서는 추천 묶음 — 다음은 어디로.
 *
 * <h3>보여 주고 끝이 아닙니다</h3>
 *
 * <p>썸네일만 늘어놓으면 「볼 거리」로 끝납니다. 줄마다 <b>다음 한 걸음</b>을
 * 정해 둡니다 — 지역은 그 지역 둘러보기로, 여행기는 그 글로(거기서 내 여행
 * 으로 가져옵니다), 내 근처는 장소 판으로(거기서 보석함에 담습니다).
 *
 * <p>셋 다 서버가 거르는 값으로 만듭니다. 지역은 올린 글을 세어 나온
 * 것({@code /api/popular/regions})이고, 여행기는 추천 순({@code sort=top})
 * 이고, 내 근처는 내 좌표로 서버가 세운 것입니다.
 *
 * <p>로그인 없이도 다 열립니다. 여행이 하나도 없는 사람이 보는 자리라
 * 여기서 가입을 묻지 않습니다 — 담으려 할 때 그 자리에서 묻습니다.
 */
export function WhereNext() {
  const router = useRouter();
  return (
    <>
      <RegionShelf onRegion={(region) => router.push(`/community?region=${encodeURIComponent(region)}`)} />
      <ShelfRow
        title="하트 많은 여행기"
        /* 추천 순입니다. 글이 적을 때도 비지 않는 줄이라 첫 줄로 두지
           않았습니다 — 첫 줄은 「어디로」를 묻는 지역이 맡습니다. */
        path="/api/posts?sort=top&size=6"
        note="누르면 그 여행기를 보고 내 여행으로 가져올 수 있어요."
        onOpen={(id) => router.push(`/community/${id}`)}
      />
      <NearbyPlaces />
    </>
  );
}

/**
 * 보석함에 서는 추천 묶음 — 장소가 먼저입니다.
 *
 * <h3>왜 {@link WhereNext} 와 순서가 다른가</h3>
 *
 * <p>내 여행은 「다음 여행을 어디로 짤까」를 묻는 자리라 지역 · 여행기 ·
 * 장소 차례가 맞습니다. 보석함은 <b>장소를 모으는</b> 자리입니다 — 열어서
 * 보고 싶은 것이 남의 여행기가 아니라 담을 만한 곳입니다.
 *
 * <p>줄을 그대로 재사용하고 차례만 뒤집습니다. 내 근처를 맨 앞에,
 * 지역 레일을 그다음에 두고, 하트 많은 여행기는 맨 뒤로 보냅니다 — 보석함을
 * 연 사람에게도 여전히 쓸모 있지만 이 화면의 주인공은 아닙니다.
 */
export function SavedShelf() {
  const router = useRouter();
  return (
    <>
      <NearbyPlaces />
      <RegionShelf onRegion={(region) => router.push(`/community?region=${encodeURIComponent(region)}`)} />
      <ShelfRow
        title="하트 많은 여행기"
        path="/api/posts?sort=top&size=6"
        note="누르면 그 여행기를 보고 내 여행으로 가져올 수 있어요."
        onOpen={(id) => router.push(`/community/${id}`)}
      />
    </>
  );
}

/**
 * 많이 다녀온 지역.
 *
 * <h3>왜 글 카드가 아닌가</h3>
 *
 * <p>지역은 글이 아니라 <b>묶음 이름</b>입니다. 썸네일을 붙이려면 그 지역의
 * 글 하나를 골라 그 사진을 써야 하는데, 그러면 「일본」이 어쩌다 맨 위에 선
 * 글 한 장으로 대표됩니다. 이름과 글 수만 적습니다 — 고르는 데 필요한 것이
 * 그 둘입니다.
 *
 * <p>목록은 서버가 글을 세어 세운 것입니다({@code /api/popular/regions}).
 * 고를 수 있는 지역 여덟을 그냥 늘어놓지 않습니다 — 아직 글이 없는 지역을
 * 누르면 빈 목록이 나오고, 그러면 누른 사람은 자기가 뭘 잘못 눌렀나 합니다.
 */
function RegionShelf({ onRegion }: { onRegion: (region: string) => void }) {
  const { data } = useAsync<{ regions: PopularRegion[] }>(
    (signal) => api.get('/api/popular/regions', signal),
    [],
  );
  const regions = data?.regions ?? [];
  if (regions.length === 0) {
    return null;
  }
  return (
    <View style={styles.shelf}>
      <Body strong>인기 여행지</Body>
      <Caption tone="secondary">누르면 그 지역 여행기를 둘러봐요.</Caption>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
        {regions.map((r) => (
          <Press key={r.region} onPress={() => onRegion(r.region)} scale={0.97} style={styles.regionCard}>
            <Body strong numberOfLines={1}>
              {r.region}
            </Body>
            <Caption tone="muted">{`여행 ${r.posts}개`}</Caption>
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * 글 몇 장을 가로로 흘리는 줄.
 *
 * @param path 서버에서 받아 올 주소. 거르는 값이 주소에 다 적혀 있어야
 *             합니다 — 받아 놓고 화면에서 고르면 여섯 장이 아무 여섯 장이
 *             됩니다
 * @param note 누르면 무엇이 되는지. 그 줄의 다음 한 걸음이 자명하지 않을
 *             때만 답니다 — 「새로 올라온 여행」에는 붙일 말이 없습니다
 */
function ShelfRow({
  title,
  path,
  note,
  onOpen,
  onMore,
}: {
  title: string;
  path: string;
  note?: string;
  onOpen: (id: string) => void;
  onMore?: () => void;
}) {
  const { data } = useAsync<PostPage>((signal) => api.get(path, signal), [path]);
  return <Shelf title={title} posts={data?.posts ?? []} note={note} onOpen={onOpen} onMore={onMore} />;
}

/** 받아 온 글들을 가로로 흘립니다. 비었으면 안 그립니다. */
function Shelf({
  title,
  posts,
  note,
  onOpen,
  onMore,
}: {
  title: string;
  posts: PostPage['posts'];
  note?: string;
  onOpen: (id: string) => void;
  onMore?: () => void;
}) {
  if (posts.length === 0) {
    return null;
  }
  return (
    <View style={styles.shelf}>
      <Split>
        <Body strong>{title}</Body>
        {onMore ? <Button label="더 보기" variant="text" size="xs" onPress={onMore} /> : null}
      </Split>
      {note ? <Caption tone="secondary">{note}</Caption> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
        {posts.map((p) => (
          <Press key={p.id} onPress={() => onOpen(p.id)} scale={0.97} style={styles.shelfCard}>
            <TripThumb
              postId={p.id}
              coverPhotoId={p.coverPhotoId}
              firstPhotoId={p.firstPhotoId}
              height={96}
              label={p.title}
              style={styles.flat}
            />
            <View style={styles.shelfText}>
              <Body small strong numberOfLines={2}>
                {p.title}
              </Body>
              <Caption tone="muted" numberOfLines={1}>
                {[p.region, `${p.dayCount}일`, (p.copyCount ?? 0) >= 3 ? `가져간 ${p.copyCount}명` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Caption>
            </View>
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: {
    gap: Spacing.s2,
    paddingBottom: Spacing.s3,
  },
  shelfRow: {
    gap: Spacing.s3,
  },
  /* 큐레이션 카드. 목록 카드라 모서리 12. */
  shelfCard: {
    width: 168,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  shelfText: {
    padding: Spacing.s2,
    gap: 2,
  },
  /* 판이 이미 모서리를 쥐고 있으니 사진은 제 모서리와 테두리를 내놓습니다. */
  flat: {
    borderRadius: 0,
    borderWidth: 0,
  },
  /* 지역 칸. 사진이 없으니 글 카드보다 좁고, 글자 두 줄 높이로만 섭니다. */
  regionCard: {
    minWidth: 104,
    gap: 2,
    paddingVertical: Spacing.s3,
    paddingHorizontal: Spacing.s4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
