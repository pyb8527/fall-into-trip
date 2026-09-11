import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Books, Companion, Spend, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Colors, Spacing } from '@/constants/theme';
import { money } from '@/lib/money';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Card,
  Chip,
  ConfirmButton,
  Divider,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Row,
  Screen,
  SegmentedTabs,
  Subtitle,
} from '@/ui';

/**
 * 가계부와 정산.
 *
 * <h3>왜 이것이 필요한가</h3>
 *
 * <p>여행에서 동행자끼리 실제로 껄끄러워지는 자리는 돈입니다. 누가 얼마를
 * 냈는지 서로 기억이 다르고, 돌아와서 정산하려면 카톡을 거슬러 올라가야
 * 합니다.
 *
 * <h3>두 장으로 나눕니다</h3>
 *
 * <p>적는 것과 나누는 것은 다른 일입니다. 여행 중에는 적기만 하고, 정산은
 * 대개 돌아와서 한 번 봅니다. 한 화면에 섞으면 길에서 적을 때마다 정산표가
 * 눈에 들어옵니다.
 */
export default function Money() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<'list' | 'settle'>('list');

  const { data: trip } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );
  const { data: mates } = useAsync<{ members: Companion[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/members`, signal),
    [id],
  );
  const spent = useAsync<{ expenses: Spend[]; currencies: string[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/expenses`, signal),
    [id],
  );
  const books = useAsync<{ books: Books[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/settlement`, signal),
    [id],
  );

  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const days = trip?.days ?? [];
  const people = mates?.members ?? [];
  const list = spent.data?.expenses ?? [];

  function refresh() {
    spent.reload();
    books.reload();
  }

  async function remove(expenseId: string) {
    setFailed(null);
    try {
      await api.delete(`/api/expenses/${expenseId}`);
      refresh();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /* 통화마다 얼마나 썼는지. 목록 맨 위에 한 줄로 둡니다 — 가계부를 여는
     이유의 절반은 "얼마나 썼지" 입니다. */
  const totals = useMemo(() => {
    const box = new Map<string, { sum: number; decimals: number }>();
    list.forEach((e) => {
      const had = box.get(e.currency) ?? { sum: 0, decimals: e.decimals };
      box.set(e.currency, { sum: had.sum + e.amount, decimals: e.decimals });
    });
    return [...box.entries()];
  }, [list]);

  return (
    <Screen
      footer={
        tab === 'list' ? <Button label="쓴 돈 적기" onPress={() => setAdding(true)} /> : undefined
      }>
      <Stack.Screen options={{ title: trip?.trip.title ?? '가계부' }} />

      <SegmentedTabs
        items={[
          { value: 'list', label: '쓴 돈' },
          { value: 'settle', label: '정산' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {failed ? <ErrorNote message={failed} /> : null}
      {spent.loading && !spent.data ? <Loading /> : null}
      {spent.error ? <ErrorNote message={spent.error} onRetry={spent.reload} /> : null}

      {tab === 'list' ? (
        <>
          {totals.length > 0 ? (
            <Card>
              <Caption tone="secondary">지금까지</Caption>
              {totals.map(([currency, t]) => (
                <Row key={currency} style={styles.totalRow}>
                  <Subtitle>{money(t.sum, currency, t.decimals)}</Subtitle>
                  <Caption tone="muted">{list.filter((e) => e.currency === currency).length}건</Caption>
                </Row>
              ))}
            </Card>
          ) : null}

          {spent.data && list.length === 0 ? (
            <Empty message="아직 적어 둔 것이 없습니다. 쓴 김에 적어 두면 돌아와서 편합니다." />
          ) : null}

          {/* 날짜별로 묶습니다. 여행의 돈은 하루 단위로 기억됩니다 —
              "둘째 날에 많이 썼지" 처럼. */}
          {byDay(list, days).map((group) => (
            <View key={group.key} style={styles.group}>
              <Row style={styles.groupHead}>
                <Subtitle>{group.label}</Subtitle>
                <Caption tone="secondary">
                  {group.totals.map(([c, t]) => money(t.sum, c, t.decimals)).join(' · ')}
                </Caption>
              </Row>
              {group.items.map((e) => (
                <SpendRow key={e.id} spend={e} people={people} onRemove={() => remove(e.id)} />
              ))}
            </View>
          ))}
        </>
      ) : (
        <Settle books={books.data?.books ?? []} loading={books.loading} />
      )}

      <AddSheet
        visible={adding}
        tripId={id}
        days={days}
        people={people}
        currencies={spent.data?.currencies ?? ['KRW']}
        onCancel={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          refresh();
        }}
      />
    </Screen>
  );
}

/** 지출 한 줄. */
function SpendRow({
  spend,
  people,
  onRemove,
}: {
  spend: Spend;
  people: Companion[];
  onRemove: () => void;
}) {
  /* 전원이 나누면 굳이 적지 않습니다. 대개 그렇고, 매번 적으면 줄만
     길어집니다. 몇몇이 나눌 때만 누가 나누는지 말해 줍니다. */
  const shared =
    spend.share.length > 0 && spend.share.length < people.length
      ? people
          .filter((p) => spend.share.includes(p.id))
          .map((p) => p.name)
          .join('·')
      : null;

  return (
    <Row style={styles.row}>
      <View style={styles.grow}>
        <Row gap={Spacing.sm} style={styles.rowHead}>
          <Body strong numberOfLines={1}>
            {spend.name}
          </Body>
          {spend.cat ? <Badge label={spend.cat} tone="muted" /> : null}
        </Row>
        <Caption tone="secondary">
          {spend.payerName} 님이 냄{shared ? ` · ${shared} 나눔` : ''}
          {spend.pay ? ` · ${spend.pay}` : ''}
        </Caption>
      </View>
      <Body strong>{money(spend.amount, spend.currency, spend.decimals)}</Body>
      <ConfirmButton label="지우기" confirmLabel="정말" onConfirm={onRemove} />
    </Row>
  );
}

/**
 * 정산표.
 *
 * <p>통화마다 한 장입니다. 엔으로 받을 돈과 원으로 낼 돈은 더해지지 않습니다.
 * 환율로 합칠 수도 있지만 그러면 "언제 환율로" 가 남고, 그 답은 사람마다
 * 다릅니다.
 */
function Settle({ books, loading }: { books: Books[]; loading: boolean }) {
  if (loading && books.length === 0) {
    return <Loading />;
  }
  if (books.length === 0) {
    return <Empty message="아직 나눌 것이 없습니다." />;
  }

  return (
    <>
      {books.map((book) => (
        <Card key={book.currency}>
          <Row style={styles.totalRow}>
            <Subtitle>{book.currency}</Subtitle>
            <Caption tone="secondary">
              모두 {money(book.total, book.currency, book.decimals)}
            </Caption>
          </Row>

          <Divider />

          {/* 누가 받고 누가 내는지. 0 인 사람은 적지 않습니다 — 줄만
              차지하고 할 일이 없습니다. */}
          {book.balances
            .filter((b) => b.balance !== 0)
            .map((b) => (
              <Row key={b.userId} style={styles.totalRow}>
                <Body>{b.name}</Body>
                <Body strong tone={b.balance > 0 ? 'success' : 'danger'}>
                  {b.balance > 0 ? '받을 ' : '낼 '}
                  {money(Math.abs(b.balance), book.currency, book.decimals)}
                </Body>
              </Row>
            ))}

          {book.transfers.length > 0 ? (
            <>
              <Divider />
              <Caption tone="secondary">이렇게 주고받으면 끝납니다</Caption>
              {book.transfers.map((t, i) => (
                <Row key={i} style={styles.totalRow}>
                  <Body>
                    {t.fromName} → {t.toName}
                  </Body>
                  <Body strong tone="accent">
                    {money(t.amount, book.currency, book.decimals)}
                  </Body>
                </Row>
              ))}
            </>
          ) : (
            <Caption tone="success">주고받을 것이 없습니다.</Caption>
          )}
        </Card>
      ))}
    </>
  );
}

/** 쓴 돈 적기. */
function AddSheet({
  visible,
  tripId,
  days,
  people,
  currencies,
  onDone,
  onCancel,
}: {
  visible: boolean;
  tripId: string;
  days: TripDetail['days'];
  people: Companion[];
  currencies: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(currencies[0] ?? 'KRW');
  const [payer, setPayer] = useState<string | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [cat, setCat] = useState('');
  /* 비어 있으면 전원이 나눕니다. 여행 경비는 대개 그렇습니다. */
  const [share, setShare] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const decimals = DECIMALS[currency] ?? 0;

  async function submit() {
    setFailed(null);
    const units = unitsOf(amount, decimals);
    if (units === null) {
      setFailed('금액을 숫자로 넣어 주세요.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/trips/${tripId}/expenses`, {
        name: name.trim(),
        amount: units,
        currency,
        payerId: payer,
        dayId,
        cat: cat.trim() || null,
        share: share.length > 0 ? share : null,
      });
      setName('');
      setAmount('');
      setCat('');
      setShare([]);
      onDone();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="쓴 돈 적기"
      onClose={onCancel}
      footer={<Button label="적기" onPress={submit} busy={busy} />}>
      <Field
        label="무엇에"
        value={name}
        onChangeText={setName}
        placeholder="첫날 저녁"
        returnKeyType="next"
      />

      <Field
        label="얼마"
        value={amount}
        onChangeText={setAmount}
        placeholder={decimals > 0 ? '12.50' : '9000'}
        keyboardType="decimal-pad"
        inputMode="decimal"
        hint={decimals > 0 ? '소수점 아래 두 자리까지 적을 수 있습니다.' : undefined}
      />

      <View style={styles.pick}>
        <Caption tone="secondary">통화</Caption>
        <Row gap={Spacing.xs} style={styles.chips}>
          {currencies.map((c) => (
            <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </Row>
      </View>

      {/* 안 고르면 적는 사람이 낸 것으로 봅니다. 대개 그렇습니다. */}
      {people.length > 1 ? (
        <View style={styles.pick}>
          <Caption tone="secondary">누가 냈나요?</Caption>
          <Row gap={Spacing.xs} style={styles.chips}>
            <Chip label="내가" selected={payer === null} onPress={() => setPayer(null)} />
            {people.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={payer === p.id}
                onPress={() => setPayer(payer === p.id ? null : p.id)}
              />
            ))}
          </Row>
        </View>
      ) : null}

      {/* 여행 경비는 대개 다 같이 나눕니다. 한 사람 것일 때만 골라 줍니다. */}
      {people.length > 1 ? (
        <View style={styles.pick}>
          <Caption tone="secondary">누가 나눠 내나요?</Caption>
          <Row gap={Spacing.xs} style={styles.chips}>
            <Chip label="다 같이" selected={share.length === 0} onPress={() => setShare([])} />
            {people.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={share.includes(p.id)}
                onPress={() =>
                  setShare((was) =>
                    was.includes(p.id)
                      ? was.filter((x) => x !== p.id)
                      : [...was, p.id],
                  )
                }
              />
            ))}
          </Row>
        </View>
      ) : null}

      {days.length > 0 ? (
        <View style={styles.pick}>
          <Caption tone="secondary">어느 날</Caption>
          <Row gap={Spacing.xs} style={styles.chips}>
            <Chip label="아직 모름" selected={dayId === null} onPress={() => setDayId(null)} />
            {days.map((d) => (
              <Chip
                key={d.id}
                label={d.date || d.label}
                selected={dayId === d.id}
                onPress={() => setDayId(dayId === d.id ? null : d.id)}
              />
            ))}
          </Row>
        </View>
      ) : null}

      <Field label="갈래" value={cat} onChangeText={setCat} placeholder="밥 / 교통 / 쇼핑" />

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ 조각 */

/**
 * 자주 쓰는 통화의 자릿수.
 *
 * <p>적을 때 "12.50" 을 1250 으로 바꾸는 데 씁니다. 서버가 통화마다 정확한
 * 자릿수를 함께 보내 주지만, 그것은 이미 적힌 것에 딸려 옵니다 — 아직 안
 * 적은 것에는 없어서 여기 둡니다.
 */
const DECIMALS: Record<string, number> = {
  KRW: 0,
  JPY: 0,
  VND: 0,
  TWD: 0,
  USD: 2,
  EUR: 2,
  HKD: 2,
  THB: 2,
  SGD: 2,
  CNY: 2,
};

/**
 * 사람이 친 것을 가장 작은 단위로.
 *
 * <p>"12.50" 을 1250 으로. 자릿수가 0인 통화에서는 소수점을 무시합니다 —
 * 9000.5엔 같은 것은 없습니다.
 */
function unitsOf(raw: string, decimals: number): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 10 ** decimals);
}

/** 날짜별로 묶고, 묶음마다 통화별 합계를 답니다. */
function byDay(list: Spend[], days: TripDetail['days']) {
  const order = ['', ...days.map((d) => d.id)];
  const labels = new Map(days.map((d) => [d.id, d.date || d.label]));

  const box = new Map<string, Spend[]>();
  list.forEach((e) => {
    const key = e.dayId ?? '';
    box.set(key, [...(box.get(key) ?? []), e]);
  });

  return order
    .filter((key) => box.has(key))
    .map((key) => {
      const items = box.get(key) ?? [];
      const sums = new Map<string, { sum: number; decimals: number }>();
      items.forEach((e) => {
        const had = sums.get(e.currency) ?? { sum: 0, decimals: e.decimals };
        sums.set(e.currency, { sum: had.sum + e.amount, decimals: e.decimals });
      });
      return {
        key,
        label: key === '' ? '날짜 없음' : (labels.get(key) ?? '날짜 없음'),
        items,
        totals: [...sums.entries()],
      };
    });
}

const styles = StyleSheet.create({
  totalRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  group: {
    gap: Spacing.xs,
  },
  groupHead: {
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  row: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowHead: {
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  pick: {
    gap: Spacing.xs,
  },
  chips: {
    flexWrap: 'wrap',
  },
});
