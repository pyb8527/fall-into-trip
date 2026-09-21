import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { Maybe } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { TripMark } from '@/components/trip-mark';
import { Spacing } from '@/constants/theme';
import { formatSpan } from '@/lib/countdown';
import { money } from '@/lib/money';
import {
  Body,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorNote,
  Grow,
  Loading,
  Press,
  Screen,
  Split,
  Title,
} from '@/ui';
import { AppTabs } from '@/ui/tab-bar';

/** 한 여행에서 한 통화로 쓴 것. */
type Sum = { currency: string; decimals: number; total: number; items: number };

type Row = {
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
  const { data, error, loading, reload } = useAsync<{ trips: Row[] }>(
    (signal) => api.get('/api/expenses/summary', signal),
    [],
  );

  const rows = data?.trips ?? [];
  /* 적은 것이 있는 여행을 위로. 가계부를 열 때 찾는 것은 대개 지금 적고 있는
     여행이고, 그것은 곧 이미 적어 둔 것이 있는 여행입니다. */
  const sorted = [...rows].sort((a, b) => b.items - a.items);

  return (
    <Screen safeTop tabs={<AppTabs />}>
      <View style={styles.head}>
        <Title>가계부</Title>
        <Caption tone="secondary">
          여행에서 서로 껄끄러워지는 자리는 돈입니다. 쓴 김에 적어 두면 돌아와서 편합니다.
        </Caption>
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && rows.length === 0 ? (
        <Empty message="아직 여행이 없습니다. 여행을 하나 만들면 그 가계부가 여기 섭니다." />
      ) : null}

      {sorted.length > 0 ? (
        <Card style={styles.list}>
          {sorted.map((trip, i) => (
            <View key={trip.id}>
              {i > 0 ? <Divider /> : null}
              <Press
                onPress={() => router.push({ pathname: '/money/[id]', params: { id: trip.id } })}
                scale={0.995}
                accessibilityLabel={`${trip.title} 가계부 열기`}
                style={styles.row}>
                <Split align="center">
                  <TripMark theme={trip.theme} emoji={trip.emoji} />
                  <Grow gap={2} style={styles.text}>
                    <Body small strong numberOfLines={1}>
                      {trip.title}
                    </Body>
                    <Caption tone="muted">
                      {[formatSpan(trip.startIso, trip.endIso), `${trip.items}건`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Caption>
                  </Grow>
                  {/* 통화마다 한 줄. 대개 하나고, 두 나라를 도는 여행에서만
                      둘이 됩니다. */}
                  <View style={styles.sums}>
                    {trip.sums.length === 0 ? (
                      <Caption tone="muted">아직 없음</Caption>
                    ) : (
                      trip.sums.map((sum) => (
                        <Body key={sum.currency} small strong>
                          {money(sum.total, sum.currency, sum.decimals)}
                        </Body>
                      ))
                    )}
                  </View>
                </Split>
              </Press>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.xs,
  },
  /* 줄이 제 여백을 가집니다. 카드가 위아래 여백을 가지면 두 겹이 되고,
     머리카락 선이 카드 끝까지 안 닿습니다. */
  list: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    gap: 0,
  },
  row: {
    paddingVertical: Spacing.md,
  },
  text: {
    paddingLeft: Spacing.sm,
  },
  /* 금액은 오른쪽 끝에. 자릿수가 다른 숫자들이 왼쪽에서 시작하면 위아래로
     견줄 수가 없습니다. */
  sums: {
    alignItems: 'flex-end',
    gap: 1,
  },
});
