import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { News, NewsItem } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Colors, Gutter, Radius, Spacing } from '@/constants/theme';
import { ago } from '@/lib/countdown';
import {
  Band,
  Body,
  Caption,
  Empty,
  ErrorNote,
  Icon,
  Loading,
  Press,
  Screen,
  SectionHeader,
} from '@/ui';
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
 *
 * <h3>언제 온 것인지로 묶습니다</h3>
 *
 * <p>줄마다 "3시간 전" 이 적혀 있는데도 스무 줄을 훑으면 어디까지가 오늘
 * 것인지 흐려집니다. 날짜 머리를 세워 두면 <b>안 읽은 동안이 어디까지인지</b>
 * 한 번에 보이고, 아래로 내려갈 이유도 함께 보입니다.
 *
 * <h3>안 읽은 줄은 바탕을 깝니다</h3>
 *
 * <p>7픽셀 점 하나만 달아 두었습니다. 그만한 점은 줄 끝에서 거의 안
 * 보이는데, 특히 줄이 두 줄짜리면 점이 어느 줄의 것인지도 모호했습니다.
 * 옅은 바탕을 깔고 점을 하나 더 키웁니다 — 바탕은 훑을 때, 점은 들여다볼
 * 때 쓰입니다.
 *
 * <h3>제목이 상단바에서 본문으로 내려왔습니다</h3>
 *
 * <p>작은 제목이 막대 가운데에 있었습니다. 둘러보기·모임·저장은 이미 큰
 * 제목을 본문 맨 위에 두고 있어서, 갈래에서 바로 열리는 화면들끼리 <b>제목이
 * 서는 자리가 달랐습니다</b> — 화면을 옮겨 다니면 제목이 위아래로 뛰었습니다.
 *
 * <p>여기도 큰 제목으로 내립니다. 다만 이 화면은 홈에서 들어오는 곳이라
 * 돌아갈 길이 있어야 하므로, 제목 왼쪽에 뒤로·처음 단추를 함께 둡니다.
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

  /*
    제목 줄은 어느 갈래에서도 똑같이 섭니다.

    <p>받아 오는 동안에도, 못 받아 왔을 때도 같은 줄이 서야 합니다. 세
    갈래에 따로 적어 두면 받아 오는 동안에는 제목도 돌아갈 단추도 없는
    흰 화면이 됩니다.
  */

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

  return (
    <Screen>

      {items.length === 0 ? (
        <Empty message="아직 온 알림이 없어요. 같이 보는 사람이 일정을 고치면 여기에 쌓여요." />
      ) : (
        <>
          {group(items).map((lot, at) => (
            <View key={lot.label}>
              {/* 날짜 묶음도 구역입니다. 묶음 사이를 띠가 가르고 이름은
                  다른 화면의 구역 제목과 같은 부품이 씁니다 — 「오늘」이
                  여기서만 다른 크기면 화면이 또 제각각이 됩니다. */}
              {at > 0 ? <Band /> : null}
              <SectionHeader title={lot.label} tight={at > 0} />
              {lot.items.map((item, index) => (
                <NewsRow
                  key={`${item.kind}-${item.at}-${index}`}
                  item={item}
                  last={index === lot.items.length - 1}
                />
              ))}
            </View>
          ))}
          {/* 30일이라고 미리 말해 둡니다. 어제 것이 안 보이는 날에 고장인지
              지난 것인지 알 수 있어야 합니다. 판에 담지 않습니다 — 읽고
              지나갈 한 줄이고, 판은 눌러서 들어갈 것에만 씁니다. */}
          <Caption>30일이 지난 알림은 지워져요.</Caption>
        </>
      )}
      {/* 소식이 하나도 없어도 이 줄은 섭니다. 위 목록과 성격이 달라서입니다 —
          소식은 읽으면 지나가지만 이것은 사라지지 않고 쌓입니다. */}
    </Screen>
  );
}

/**
 * 언제 온 것인지로 묶습니다.
 *
 * <p>서버가 내려보내는 순서(새것부터)를 그대로 따릅니다 — 여기서 다시
 * 세우면 서버가 정한 순서와 어긋날 수 있고, 어긋나면 어느 쪽이 맞는지
 * 화면만 보고는 알 수 없습니다.
 *
 * <p>빈 묶음은 안 냅니다. "이번 주 — 없음" 을 적어 두면 없는 것을 읽게
 * 하는 셈입니다.
 */
function group(items: NewsItem[]): { label: string; items: NewsItem[] }[] {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const lots: { label: string; items: NewsItem[] }[] = [
    { label: '오늘', items: [] },
    { label: '이번 주', items: [] },
    { label: '지난 30일', items: [] },
  ];

  for (const item of items) {
    const since = now - Date.parse(item.at);
    const at = since < day ? 0 : since < 7 * day ? 1 : 2;
    lots[at].items.push(item);
  }

  return lots.filter((lot) => lot.items.length > 0);
}

/**
 * 소식 한 줄.
 *
 * <p>누르면 그 일이 벌어진 자리로 갑니다. 어디로 갈지는 서버가 정해
 * 내려보냅니다 — 여행이냐 글이냐를 화면이 다시 판단하면, 갈래가 하나 늘 때
 * 두 군데를 고쳐야 합니다.
 *
 * <h3>{@code ListRow} 를 안 쓰는 까닭</h3>
 *
 * <p>목록 줄은 {@link ListRow} 로 통일했지만 이 줄은 둘을 더 해야 합니다 —
 * 안 읽은 줄의 바탕이 좌우 여백 밖까지 물들어야 하고, 문장이 두 줄까지
 * 늘어나야 합니다({@link ListRow} 의 제목은 한 줄에서 잘립니다). 알림은
 * 문장 자체가 내용이라 자르면 무슨 일이 있었는지가 사라집니다.
 *
 * <p>생김새는 맞춥니다. 높이·여백·아래 선을 {@link ListRow} 와 같게 두고
 * 마지막 줄에는 선을 안 긋습니다.
 */
function NewsRow({ item, last }: { item: NewsItem; last?: boolean }) {
  const router = useRouter();
  const where = item.tripTitle ?? item.postTitle;

  /*
    바탕은 밖으로, 선은 안으로.

    <p>안 읽은 줄의 색은 좌우 여백을 뚫고 나가야 줄 전체가 물든 것으로
    읽히고, 줄을 가르는 선은 글이 시작하는 자리에 맞아야 띠로 안 보입니다.
    한 겹으로는 둘을 같이 할 수 없어 바탕을 겉껍데기가 쥡니다.
  */
  return (
    <View style={[styles.rowBleed, item.fresh ? styles.unread : null]}>
      <Press
        onPress={() => router.push(item.url as never)}
        scale={1}
        style={[styles.row, last ? null : styles.rowLine]}>
        {/* 선 아이콘은 맨몸으로 서지 않고 회색 원에 담깁니다. 줄마다 그림
            넓이가 달라지면 그 오른쪽 글자도 함께 흔들립니다. */}
        <View style={styles.mark}>
          <Icon name={iconOf(item.kind)} size={20} tone={item.fresh ? 'default' : 'muted'} />
        </View>
        <View style={styles.text}>
          {/* 이름이 없는 줄이 있습니다. 여럿이 한 줄로 접힌 것이고, 그때는
              몇 사람인지가 문장 안에 이미 들어 있습니다. */}
          <Body small>
            {item.actorName ? (
              <>
                <Body small strong>
                  {item.actorName}
                </Body>
                {' 님이 '}
              </>
            ) : null}
            {item.text}
          </Body>
          {/* 어느 여행·어느 글인지와 얼마나 지났는지를 한 줄에 둡니다. 둘 다
              그 자체로는 볼 것이 아니고, 위 문장을 어디에 놓을지 정해 줍니다. */}
          <Caption>
            {where ? `${where} · ${ago(Date.parse(item.at))}` : ago(Date.parse(item.at))}
          </Caption>
        </View>
        {/* 새것에만 점을 답니다. 숫자는 안 적습니다 — 목록에서 셀 일이
            없습니다. */}
        {item.fresh ? <View style={styles.dot} /> : null}
      </Press>
    </View>
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
    case 'feed.post':
      return 'image';
    case 'group.join':
      return 'users';
    case 'notice.edit':
      return 'clipboard';
    default:
      return 'message-square';
  }
}

const styles = StyleSheet.create({
  /*
    안 읽은 줄의 바탕.

    <p>바탕은 좌우 여백을 뚫고 나가야 줄 전체가 물든 것으로 읽힙니다 —
    여백 안에서만 칠하면 글자 뒤에 색 상자를 얹은 것처럼 보입니다.
  */
  rowBleed: {
    marginHorizontal: -Gutter,
  },
  /* 소식 한 줄. 높이와 여백을 목록 줄({@code ListRow})에 맞춥니다. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    minHeight: 72,
    paddingVertical: Spacing.s3,
    paddingHorizontal: Gutter,
  },
  /* 줄을 가르는 선. 마지막 줄에는 안 긋습니다 — 목록이 끝났는데 선이
     하나 더 있으면 아래에 뭔가 더 있는 줄 압니다. */
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  unread: {
    backgroundColor: Colors.accentSoft,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
});
