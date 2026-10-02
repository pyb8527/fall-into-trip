import { useNavigation, useRouter } from 'expo-router';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { api } from '@/api/client';
import type { Maybe } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { TripMark } from '@/components/trip-mark';
import { Colors, Spacing, Tabular, Type, Weight } from '@/constants/theme';
import { formatSpan } from '@/lib/countdown';
import { money } from '@/lib/money';
import {
  Caption,
  Empty,
  ErrorNote,
  Grow,
  ListRow,
  Loading,
  Row,
  Screen,
  Title,
} from '@/ui';
import { NavLeft } from '@/ui/nav';

/** 한 여행에서 한 통화로 쓴 것. */
type Sum = { currency: string; decimals: number; total: number; items: number };

/** 목록의 한 줄 — 여행 하나와 그 여행에서 쓴 돈. */
type TripRow = {
  id: string;
  title: string;
  theme: Maybe<string>;
  emoji: Maybe<string>;
  startIso: string | null;
  endIso: string | null;
  sums: Sum[];
  items: number;
};

/**
 * 가계부 — 어느 여행의 것을 볼까.
 *
 * <h3>왜 화면이 따로 필요한가</h3>
 *
 * <p>가계부는 여행 하나에 딸려 있습니다. 그래서 아래 띠의 「가계부」를 누르면
 * <b>내 여행 목록</b>을 그대로 열었고, 띠는 그것을 보고 「내 여행」에 불을
 * 켰습니다 — 가계부를 눌렀는데 내 여행에 있는 셈이었습니다.
 *
 * <p>같은 여행들이지만 <b>다른 이야기</b>를 하는 목록입니다. 여행을 짜러 가는
 * 목록은 며칠인지 몇 곳인지를 말하고, 이쪽은 얼마를 썼는지 몇 건을 적었는지를
 * 말합니다. 화면이 갈리면 띠도 제자리를 찾습니다.
 *
 * <h3>아래 갈래 띠를 걷었습니다</h3>
 *
 * <p>띠에는 이 화면의 칸이 없습니다. 그래서 띠를 달아 두면 <b>어느 칸에도
 * 불이 안 켜진</b> 띠가 서 있었습니다 — 띠는 "지금 어디" 를 말하는 것인데
 * 아무 말도 안 하면서 자리만 먹습니다.
 *
 * <p>들어오는 길은 「내 여행」의 모아 보기 줄이고, 나가는 길은 위 막대의
 * 화살표입니다.
 *
 * <h3>한 건도 안 적은 여행도 냅니다</h3>
 *
 * <p>오히려 그쪽이 "여기 적어야 하는데" 를 떠올리게 하는 자리입니다. 목록에서
 * 빼 버리면 적기 시작하기 전까지는 이 화면에 아예 안 보입니다.
 *
 * <h3>통화를 합치지 않습니다</h3>
 *
 * <p>엔과 원을 더하려면 "언제 환율로" 가 남고, 그 답은 사람마다 다릅니다.
 * 정산 화면이 이미 같은 이유로 통화마다 한 장씩 냅니다.
 */
export default function MoneyList() {
  const router = useRouter();
  const navigation = useNavigation();
  const { data, error, loading, reload } = useAsync<{ trips: TripRow[] }>(
    (signal) => api.get('/api/expenses/summary', signal),
    [],
  );

  const rows = data?.trips ?? [];
  /* 적은 것이 있는 여행을 위로. 가계부를 열 때 찾는 것은 대개 지금 적고 있는
     여행이고, 그것은 곧 이미 적어 둔 것이 있는 여행입니다. */
  const sorted = [...rows].sort((a, b) => b.items - a.items);

  return (
    <Screen
      safeTop
      /*
        제목 줄 — 돌아갈 단추와 큰 제목.

        <p>제목을 막대 제목 크기로 적고, 돌아가는 단추도 이 화면이 직접
        그리고 있었습니다. 그래서 알림·설정·지금 뜨는 여행지와 <b>같은 깊이의
        화면인데 제목 크기와 돌아가는 길이 저마다 달랐습니다.</b>
        네 화면이 같은 줄을 씁니다 — 공용 단추 묶음(NavLeft) + 큰 제목.
      */
      header={
        <Row gap={Spacing.s2}>
          <NavLeft navigation={navigation} up="/(app)/trips" />
          <Grow>
            <Title>가계부</Title>
          </Grow>
        </Row>
      }>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {/*
        안내를 빈자리로 옮겼습니다.

        <p>"쓴 김에 적어 두면 돌아와서 편해요" 를 목록 위 카드에 늘 띄워
        두었습니다. 그런데 이미 적고 있는 사람은 그 말을 읽을 일이 없고,
        매번 여는 화면에서 같은 설명이 목록을 한 줄씩 아래로 밀었습니다.

        <p>설명이 필요한 사람은 아직 아무것도 없는 사람입니다. 그 자리에서만
        말합니다.
      */}
      {data && rows.length === 0 ? (
        <Empty message="아직 여행이 없어요. 여행을 하나 만들면 그 가계부가 여기 서요." />
      ) : null}

      {sorted.map((trip, i) => (
        <ListRow
          key={trip.id}
          last={i === sorted.length - 1}
          left={<TripMark theme={trip.theme} emoji={trip.emoji} />}
          title={trip.title}
          subtitle={[formatSpan(trip.startIso, trip.endIso), `${trip.items}건`]
            .filter(Boolean)
            .join(' · ')}
          /* 통화마다 한 줄. 대개 하나고, 두 나라를 도는 여행에서만 둘이 됩니다. */
          right={
            <View style={styles.sums}>
              {trip.sums.length === 0 ? (
                <Caption tone="muted">아직 없음</Caption>
              ) : (
                trip.sums.map((sum) => (
                  <Text key={sum.currency} style={styles.sum}>
                    {money(sum.total, sum.currency, sum.decimals)}
                  </Text>
                ))
              )}
            </View>
          }
          onPress={() => router.push({ pathname: '/money/[id]', params: { id: trip.id } })}
        />
      ))}
    </Screen>
  );
}

/*
  고정폭 숫자.

  <p>토큰이 값을 읽기전용 배열로 적어 두어서, 글자 모양으로 그대로 넘기면
  타입이 안 맞습니다. 한 번 풀어 주고 금액 글자들이 같은 것을 씁니다 —
  값은 토큰에 하나만 둡니다.
*/

const styles = StyleSheet.create({
  /*
    금액은 오른쪽 끝에.

    <p>자릿수가 다른 숫자들이 왼쪽에서 시작하면 위아래로 견줄 수가 없습니다.
    고정폭 숫자(Tabular-nums)까지 함께 줘야 1 과 8 의 폭이 같아져 자리가
    맞습니다.
  */
  sums: {
    alignItems: 'flex-end',
    gap: 1,
  },
  sum: {
    ...Type.headline,
    ...Tabular,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
});
