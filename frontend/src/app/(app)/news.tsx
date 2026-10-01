import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { News, NewsItem } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Colors, Gutter, Palette, Radius, Spacing, Type, Weight } from '@/constants/theme';
import { ago } from '@/lib/countdown';
import { Band, Body, Caption, Empty, ErrorNote, Icon, Loading, Press, Screen } from '@/ui';
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

  return (
    <Screen>
      {items.length === 0 ? (
        <Empty message="아직 온 알림이 없어요. 같이 보는 사람이 일정을 고치면 여기에 쌓여요." />
      ) : (
        <>
          {group(items).map((lot) => (
            <View key={lot.label}>
              <Text style={styles.lotLabel}>{lot.label}</Text>
              {lot.items.map((item, index) => (
                <NewsRow key={`${item.kind}-${item.at}-${index}`} item={item} />
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
      {data?.mine ? <MineNote tipCount={data.mine.tipCount} viewCount={data.mine.viewCount} /> : null}
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
 * 내가 남긴 한 줄이 얼마나 쓰였는지.
 *
 * <p>한 줄 팁은 이 앱에서 <b>남에게 남기는</b> 거의 유일한 것인데, 남기고
 * 나면 아무것도 돌아오지 않았습니다. 남긴 사람에게 이 앱은 "한 번 글자를
 * 넣은 곳" 으로 끝났습니다.
 *
 * <p><b>"명" 이 아니라 "번" 입니다.</b> 같은 사람이 다음 주에 그 가게를 다시
 * 찾아보며 또 읽었다면 그것도 한 번 쓰인 것입니다. 사람 수를 세지 않으면서
 * "명" 이라고 적으면 아는 것과 다른 말을 하는 것이 됩니다.
 *
 * <p>뱃지도 등급도 없습니다. 수를 점수로 바꾸는 순간 수를 올리려는 행동이
 * 생기고, 그러면 팁 칸이 쓰레기로 찹니다.
 */
function MineNote({ tipCount, viewCount }: { tipCount: number; viewCount: number }) {
  return (
    <>
      {/* 선 한 가닥으로 갈랐습니다. 이 앱에서 구역을 가르는 것은 선이
          아니라 8픽셀 띠입니다 — 선은 목록 줄 사이에서만 씁니다. */}
      <Band />
      <View style={styles.mine}>
        <Body>
          {viewCount > 0
            ? `남긴 한 줄 ${tipCount}개가 ${viewCount}번 쓰였어요.`
            : `남긴 한 줄 ${tipCount}개. 아직 읽은 사람이 없어요.`}
        </Body>
        {/* 부풀리지 않습니다. 손님이 읽은 것은 셀 수가 없고(사람 번호가 없어
            "하루 한 번" 이 성립하지 않습니다), 그것을 안 밝히면 이 수 하나
            때문에 나머지 화면까지 못 믿게 됩니다. */}
        <Caption>로그인하고 본 것만 세어요. 실제로는 더 쓰였을 수 있어요.</Caption>
      </View>
    </>
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
    <Press
      onPress={() => router.push(item.url as never)}
      scale={1}
      style={[styles.row, item.fresh ? styles.unread : null]}>
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
  /*
    묶음 이름.

    <p>읽으라고 있는 것이 아니라 「여기서부터 다른 날」 이라는 표시입니다.
    그래서 본문보다 작고 흐리되 굵습니다.
  */
  lotLabel: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Palette.gray[500],
    paddingTop: Spacing.s6,
    paddingBottom: Spacing.s2,
  },
  /*
    소식 한 줄.

    <p>안 읽은 줄은 바탕이 옅게 물듭니다. 바탕은 좌우 여백을 뚫고 나가야
    줄 전체가 물든 것으로 읽힙니다 — 여백 안에서만 칠하면 글자 뒤에 색
    상자를 얹은 것처럼 보입니다.
  */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    minHeight: 72,
    paddingVertical: Spacing.s3,
    marginHorizontal: -Gutter,
    paddingHorizontal: Gutter,
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
  mine: {
    gap: Spacing.s1,
    paddingTop: Spacing.s4,
  },
});
