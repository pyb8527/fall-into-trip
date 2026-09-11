import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { News, NewsItem } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Colors, Spacing } from '@/constants/theme';
import { ago } from '@/lib/countdown';
import { Body, Caption, Empty, ErrorNote, Icon, Loading, Press, Screen } from '@/ui';
import type { IconName } from '@/ui';

/**
 * 소식함 — 내가 없는 동안 무엇이 바뀌었나.
 *
 * <h3>왜 있나</h3>
 *
 * <p>함께 짜는 기능이 셋 있는데(투표장·챙길 것·같이 고치기) 누가 뭘 했는지는
 * 보이지 않았습니다. 동행자가 둘째 날에 가게를 하나 넣어도, 들어가서 일정
 * 전체를 다시 훑어야 알았습니다. 그래서 카톡으로 "야 투표해" 를 따로
 * 보냈습니다 — 앱 밖에서 앱을 쓰라고 알리고 있었던 셈입니다.
 *
 * <h3>열면 점이 꺼집니다</h3>
 *
 * <p>끝까지 내렸는지는 보지 않습니다. 그것을 재려면 화면이 훨씬 복잡해지고,
 * 얻는 것은 "정확히 다 읽었나" 하나뿐입니다.
 *
 * <p>점이 꺼져도 <b>줄은 그대로 남습니다.</b> 30일치가 늘 있습니다 — 열어 본
 * 뒤에 어제 것이 사라지면 "아까 그게 뭐였더라" 를 할 수 없습니다.
 *
 * <h3>한 곳에서 온 것은 한 줄입니다</h3>
 *
 * <p>글 하나가 좀 받은 날 추천이 서른 줄이 되면, 동행자가 고친 일정은 그
 * 아래로 밀려납니다. 그래서 서버가 글마다·후보마다 접어서 보냅니다. 여럿이
 * 접힌 줄에는 이름이 없고 몇 사람인지만 있습니다.
 */
export default function NewsScreen() {
  const { data, error, loading, reload } = useAsync<News>(
    (signal) => api.get('/api/news', signal),
    [],
  );

  /* 열었다고 한 번만 말합니다. 화면이 다시 그려질 때마다 보내면 서버에
     쓰기가 쌓이는데, 값은 첫 한 번과 똑같습니다. */
  const told = useRef(false);
  useEffect(() => {
    if (!data || told.current) {
      return;
    }
    told.current = true;
    /* 실패해도 그냥 둡니다. 목록은 이미 눈앞에 있고, 다음에 열면 다시
       보냅니다. 여기서 오류를 띄우면 읽는 일과 상관없는 것으로 막아섭니다. */
    api.put('/api/news/seen').catch(() => {});
  }, [data]);

  if (loading && !data) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen scroll={false}>
        <ErrorNote message={error} onRetry={reload} />
      </Screen>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <Screen scroll={false}>
        <Empty message="아직 온 소식이 없습니다. 동행자가 일정을 고치면 여기에 쌓입니다." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.list}>
        {items.map((item, index) => (
          <NewsRow key={`${item.kind}-${item.at}-${index}`} item={item} />
        ))}
      </View>
      {/* 30일이라고 미리 말해 둡니다. 어제 것이 안 보이는 날에 고장인지
          지난 것인지 알 수 있어야 합니다. */}
      <Caption>지난 30일치입니다.</Caption>
    </Screen>
  );
}

/**
 * 소식 한 줄.
 *
 * <p>누르면 그 일이 벌어진 자리로 갑니다. 어디로 갈지는 서버가 정해
 * 내려보냅니다 — 여행이냐 글이냐를 화면이 다시 판단하면, 갈래가 하나 늘 때
 * 두 군데를 고쳐야 합니다.
 */
function NewsRow({ item }: { item: NewsItem }) {
  const router = useRouter();
  const where = item.tripTitle ?? item.postTitle;

  return (
    <Press onPress={() => router.push(item.url as never)} scale={0.985} style={styles.row}>
      <View style={styles.mark}>
        <Icon name={iconOf(item.kind)} tone={item.fresh ? 'default' : 'muted'} />
      </View>
      <View style={styles.text}>
        {/* 이름이 없는 줄이 있습니다. 여럿이 한 줄로 접힌 것이고, 그때는
            몇 사람인지가 문장 안에 이미 들어 있습니다. */}
        <Body>
          {item.actorName ? (
            <>
              <Body strong>{item.actorName}</Body>
              {' 님이 '}
            </>
          ) : null}
          {item.text}
        </Body>
        {/* 어느 여행·어느 글인지와 얼마나 지났는지를 한 줄에 둡니다. 둘 다
            그 자체로는 볼 것이 아니고, 위 문장을 어디에 놓을지 정해 줍니다. */}
        <Caption>{where ? `${where} · ${ago(Date.parse(item.at))}` : ago(Date.parse(item.at))}</Caption>
      </View>
      {/* 새것에만 점을 답니다. 숫자는 안 적습니다 — 목록에서 셀 일이
          없습니다. */}
      {item.fresh ? <View style={styles.dot} /> : null}
    </Press>
  );
}

/**
 * 갈래마다 그림 하나.
 *
 * <p>글자만으로도 읽히지만, 목록이 길어지면 줄마다 처음부터 읽게 됩니다.
 * 그림이 있으면 찾던 갈래를 훑어서 지나갈 수 있습니다.
 */
function iconOf(kind: NewsItem['kind']): IconName {
  switch (kind) {
    case 'place.add':
      return 'map-pin';
    case 'place.edit':
      return 'edit-2';
    case 'candidate.add':
      return 'flag';
    case 'candidate.vote':
      return 'check';
    case 'post.like':
      return 'star';
    default:
      return 'message-square';
  }
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  mark: {
    width: 32,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
});
