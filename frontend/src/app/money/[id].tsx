import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Books, Companion, Spend, TripDetail } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { Colors, Spacing, dayColor } from '@/constants/theme';
import { decimalsOf, money, unitsOf } from '@/lib/money';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Card,
  Chip,
  Divider,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Row,
  Press,
  Screen,
  SegmentedTabs,
  Snack,
  Split,
  Subtitle,
  useUndo,
} from '@/ui';
import { TripTabs } from '@/ui/tab-bar';

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

  /*
    판에 무엇을 띄울지.

    <p>{@code null} 이면 안 떠 있고, {@code 'new'} 면 새로 적는 것,
    지출이면 그것을 고치는 것입니다. 적는 칸과 고치는 칸이 똑같아서
    판을 두 개 둘 이유가 없습니다.
  */
  const [editing, setEditing] = useState<Spend | 'new' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { undo, show: showUndo, hide: hideUndo } = useUndo();

  const days = trip?.days ?? [];
  /*
    장소 번호 → 이름.

    지출에 장소가 붙어 있어도 번호뿐이라 그대로는 못 보여 줍니다. 줄마다
    날을 뒤지면 지출 수만큼 훑게 되므로 한 번만 만들어 둡니다.

    지워진 장소는 여기 없습니다. 그때는 이름을 안 적습니다 — 지출은 남고
    "어디서" 만 잃습니다.
  */
  const placeNames = useMemo(() => {
    const box = new Map<string, string>();
    days.forEach((d) => d.places.forEach((p) => box.set(p.id, p.name)));
    return box;
  }, [days]);
  const people = mates?.members ?? [];
  const list = spent.data?.expenses ?? [];

  function refresh() {
    spent.reload();
    books.reload();
  }

  /*
    지우고 나서 물러설 길을 줍니다.

    <h3>왜 미리 안 묻는가</h3>

    <p>"정말요?" 를 세우면 맞게 누른 사람도 한 번 더 눌러야 합니다. 열 번
    중 아홉 번은 맞게 누르는데 아홉 번 다 두 번씩 누르는 셈입니다. 먼저
    지우고 나중에 알리면 맞게 누른 사람은 아무것도 안 해도 됩니다.

    <h3>되돌리는 것은 다시 적는 것입니다</h3>

    <p>서버에는 되살리는 길이 없습니다. 그래서 되돌리기는 <b>같은 내용을
    다시 적습니다.</b> 번호가 새로 붙고 적은 시각이 지금이 되는데, 지출은
    번호로 남을 부르는 것이 아니라 상관없습니다.

    <p>지우는 것을 미뤄 뒀다가 나중에 보내는 방법도 있지만, 그러면 그
    사이에 앱을 닫은 사람의 지출이 안 지워진 채로 남습니다. 여럿이 같이
    보는 가계부에서 <b>지운 줄 알았는데 남아 있는</b> 것이 제일 나쁩니다.
  */
  async function remove(spend: Spend) {
    setFailed(null);
    try {
      await api.delete(`/api/expenses/${spend.id}`);
      refresh();
      showUndo({
        message: `'${spend.name}' 을 지웠습니다.`,
        onUndo: () => restore(spend),
      });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /** 지운 것을 같은 내용으로 다시 적습니다. */
  async function restore(spend: Spend) {
    setFailed(null);
    try {
      await api.post(`/api/trips/${id}/expenses`, {
        name: spend.name,
        amount: spend.amount,
        currency: spend.currency,
        payerId: spend.payerId,
        dayId: spend.dayId,
        placeId: spend.placeId,
        cat: spend.cat,
        pay: spend.pay,
        share: spend.share.length > 0 ? spend.share : null,
      });
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
      tabs={<TripTabs tripId={id} active="money" />}
      snack={<Snack undo={undo} onHide={hideUndo} />}
      footer={
        tab === 'list' ? (
          <Button label="쓴 돈 적기" onPress={() => setEditing('new')} />
        ) : undefined
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
                <Split key={currency}>
                  <Subtitle>{money(t.sum, currency, t.decimals)}</Subtitle>
                  <Caption tone="muted">{list.filter((e) => e.currency === currency).length}건</Caption>
                </Split>
              ))}
            </Card>
          ) : null}

          {spent.data && list.length === 0 ? (
            <Empty message="아직 적어 둔 것이 없습니다. 쓴 김에 적어 두면 돌아와서 편합니다." />
          ) : null}

          {/* 날짜별로 묶습니다. 여행의 돈은 하루 단위로 기억됩니다 —
              "둘째 날에 많이 썼지" 처럼. */}
          {byDay(list, days).map((group) => (
            <View
              key={group.key}
              style={[
                styles.group,
                group.color ? { borderLeftColor: group.color } : styles.groupPlain,
              ]}>
              <Split align="baseline">
                <Subtitle>{group.label}</Subtitle>
                <Caption tone="secondary">
                  {group.totals.map(([c, t]) => money(t.sum, c, t.decimals)).join(' · ')}
                </Caption>
              </Split>
              {group.items.map((e) => (
                <SpendRow
                  key={e.id}
                  spend={e}
                  people={people}
                  placeName={e.placeId ? (placeNames.get(e.placeId) ?? null) : null}
                  onOpen={() => setEditing(e)}
                />
              ))}
            </View>
          ))}
        </>
      ) : (
        <Settle books={books.data?.books ?? []} loading={books.loading} />
      )}

      {/*
        판을 대상마다 새로 답니다.

        칸 값들은 판 안에 있어서, 같은 판을 다른 지출로 다시 열면 앞의 것이
        남아 있습니다. key 를 바꿔 아예 새로 달면 그럴 일이 없습니다 —
        칸마다 언제 비울지 따로 챙기는 것보다 이쪽이 틀릴 데가 적습니다.
      */}
      <SpendSheet
        key={editing === 'new' || editing === null ? 'new' : editing.id}
        visible={editing !== null}
        spend={editing === 'new' ? null : editing}
        tripId={id}
        days={days}
        people={people}
        currencies={spent.data?.currencies ?? ['KRW']}
        onCancel={() => setEditing(null)}
        onRemove={(spend) => {
          setEditing(null);
          remove(spend);
        }}
        onDone={() => {
          setEditing(null);
          refresh();
        }}
      />
    </Screen>
  );
}

/**
 * 지출 한 줄.
 *
 * <p>줄 끝에 "지우기" 가 붙어 있었습니다. 줄마다 빨간 단추가 서 있어서
 * 목록을 훑을 때 눈이 자꾸 거기로 갔고, 정작 <b>고치는 길은 없었습니다</b>
 * — 오타 하나를 고치려면 지우고 처음부터 다시 적어야 했습니다.
 *
 * <p>줄 전체를 누르면 열립니다. 지우는 것도 거기 있습니다.
 */
function SpendRow({
  spend,
  people,
  placeName,
  onOpen,
}: {
  spend: Spend;
  people: Companion[];
  /** 어디서 썼는지. 안 정했거나 그 장소가 지워졌으면 비어 있습니다. */
  placeName: string | null;
  onOpen: () => void;
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
    <Press
      onPress={onOpen}
      scale={0.995}
      accessibilityLabel={`${spend.name} 고치기`}
      style={styles.row}>
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
          {placeName ? ` · ${placeName}` : ''}
        </Caption>
      </View>
      {/* 금액은 오른쪽 끝에 붙입니다. 지우기 단추가 빠지면서 자리가 났는데,
          숫자가 줄마다 다른 데서 시작하면 위아래로 훑어 견줄 수가 없습니다. */}
      <Body strong style={styles.amount}>
        {money(spend.amount, spend.currency, spend.decimals)}
      </Body>
    </Press>
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
          <Split>
            <Subtitle>{book.currency}</Subtitle>
            <Caption tone="secondary">
              모두 {money(book.total, book.currency, book.decimals)}
            </Caption>
          </Split>

          <Divider />

          {/* 누가 받고 누가 내는지. 0 인 사람은 적지 않습니다 — 줄만
              차지하고 할 일이 없습니다. */}
          {book.balances
            .filter((b) => b.balance !== 0)
            .map((b) => (
              <Split key={b.userId}>
                <Body>{b.name}</Body>
                <Body strong tone={b.balance > 0 ? 'success' : 'danger'}>
                  {b.balance > 0 ? '받을 ' : '낼 '}
                  {money(Math.abs(b.balance), book.currency, book.decimals)}
                </Body>
              </Split>
            ))}

          {book.transfers.length > 0 ? (
            <>
              <Divider />
              <Caption tone="secondary">이렇게 주고받으면 끝납니다</Caption>
              {book.transfers.map((t, i) => (
                <Split key={i}>
                  <Body>
                    {t.fromName} → {t.toName}
                  </Body>
                  <Body strong tone="accent">
                    {money(t.amount, book.currency, book.decimals)}
                  </Body>
                </Split>
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
/**
 * 쓴 돈을 적는 판. 고칠 때도 같은 판입니다.
 *
 * <p>적는 칸과 고치는 칸이 똑같습니다. 판을 두 벌 두면 한쪽에 칸을 더할
 * 때마다 다른 쪽을 잊게 됩니다.
 *
 * @param spend 고칠 것. {@code null} 이면 새로 적습니다.
 */
function SpendSheet({
  visible,
  spend,
  tripId,
  days,
  people,
  currencies,
  onDone,
  onCancel,
  onRemove,
}: {
  visible: boolean;
  spend: Spend | null;
  tripId: string;
  days: TripDetail['days'];
  people: Companion[];
  currencies: string[];
  onDone: () => void;
  onCancel: () => void;
  onRemove: (spend: Spend) => void;
}) {
  const [name, setName] = useState(spend?.name ?? '');
  /* 서버는 최소 단위(엔은 1원, 달러는 1센트)로 셉니다. 사람이 고칠 것은
     "12.50" 이므로 열 때 되돌려 놓습니다. */
  const [amount, setAmount] = useState(
    spend ? amountText(spend.amount, spend.decimals) : '',
  );
  const [currency, setCurrency] = useState(spend?.currency ?? currencies[0] ?? 'KRW');
  const [payer, setPayer] = useState<string | null>(spend?.payerId ?? null);
  const [dayId, setDayId] = useState<string | null>(spend?.dayId ?? null);
  /* 장소는 날에 딸려 있습니다. 날을 바꾸면 비웁니다 — 안 그러면 어제 고른
     가게가 오늘 지출에 붙습니다. */
  const [placeId, setPlaceId] = useState<string | null>(spend?.placeId ?? null);
  const [cat, setCat] = useState(spend?.cat ?? '');
  /* 비어 있으면 전원이 나눕니다. 여행 경비는 대개 그렇습니다. */
  const [share, setShare] = useState<string[]>(spend?.share ?? []);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const decimals = decimalsOf(currency);
  /** 고른 날의 장소들. 날을 안 골랐으면 비어 있습니다. */
  const dayPlaces = days.find((d) => d.id === dayId)?.places ?? [];

  async function submit() {
    setFailed(null);
    const units = unitsOf(amount, decimals);
    if (units === null) {
      setFailed('금액을 숫자로 넣어 주세요.');
      return;
    }
    setBusy(true);
    const draft = {
      name: name.trim(),
      amount: units,
      currency,
      payerId: payer,
      dayId,
      placeId,
      cat: cat.trim() || null,
      share: share.length > 0 ? share : null,
    };
    try {
      if (spend) {
        /*
          고칠 때는 <b>비어 있음을 빈 글로</b> 보냅니다.

          <p>서버는 고치기에서 {@code null} 을 "안 보냈으니 그대로 둬라" 로
          읽습니다. 그래서 갈래를 지우거나 날짜를 "아직 모름" 으로 되돌려
          놓고 저장하면, 화면에서는 비워졌는데 서버는 옛 값을 그대로 들고
          있습니다 — 다시 열면 슬그머니 돌아와 있습니다.

          <p>빈 글("")과 빈 목록([])은 "비워라" 로 읽힙니다. 보석함 메모도
          같은 약속을 씁니다.

          <p>version 도 같이 보냅니다. 여럿이 같이 보는 가계부라, 내가 판을
          열어 둔 사이에 남이 같은 줄을 고쳤을 수 있습니다. 그때는 서버가
          막고, 나중에 누른 사람이 다시 열어 보게 됩니다.
        */
        await api.patch(`/api/expenses/${spend.id}`, {
          ...draft,
          payerId: payer ?? spend.payerId,
          dayId: dayId ?? '',
          placeId: placeId ?? '',
          cat: cat.trim(),
          share,
          version: spend.version,
        });
      } else {
        await api.post(`/api/trips/${tripId}/expenses`, draft);
      }
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
      title={spend ? '고치기' : '쓴 돈 적기'}
      onClose={onCancel}
      footer={<Button label={spend ? '고쳤습니다' : '적기'} onPress={submit} busy={busy} />}>
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
                onPress={() => {
                  const next = dayId === d.id ? null : d.id;
                  setDayId(next);
                  setPlaceId(null);
                }}
              />
            ))}
          </Row>
        </View>
      ) : null}

      {/*
        어디서 썼는지.

        날을 고른 뒤에만 뜹니다. 장소는 날에 딸려 있어서, 날을 모르면 고를
        목록도 없습니다. 그 날에 장소를 아직 안 넣었으면 이 칸 자체가
        안 뜹니다 — 빈 칸을 내밀면 뭔가 빠뜨린 것처럼 보입니다.

        안 고르는 것이 기본입니다. 숙소비나 항공권처럼 어느 한 곳에 붙지
        않는 돈이 많습니다.
      */}
      {dayPlaces.length > 0 ? (
        <View style={styles.pick}>
          <Caption tone="secondary">어디서</Caption>
          <Row gap={Spacing.xs} style={styles.chips}>
            <Chip label="어디랄 것 없이" selected={placeId === null} onPress={() => setPlaceId(null)} />
            {dayPlaces.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={placeId === p.id}
                onPress={() => setPlaceId(placeId === p.id ? null : p.id)}
              />
            ))}
          </Row>
        </View>
      ) : null}

      <Field label="갈래" value={cat} onChangeText={setCat} placeholder="밥 / 교통 / 쇼핑" />

      {/* 지우는 것은 맨 아래, 조용하게. 미리 묻지 않습니다 — 지운 뒤에
          목록 위로 되돌리는 띠가 잠깐 뜹니다. */}
      {spend ? (
        <>
          <Divider />
          <Button
            label="이 지출 지우기"
            variant="danger"
            onPress={() => onRemove(spend)}
          />
        </>
      ) : null}

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ 조각 */

/**
 * 최소 단위로 세어 둔 돈을 사람이 고칠 글로.
 *
 * <p>{@link money} 는 "￥1,250" 처럼 통화 기호와 쉼표를 붙여 <b>읽으라고</b>
 * 만듭니다. 그것을 입력칸에 넣으면 다시 숫자로 못 읽습니다.
 */
function amountText(units: number, decimals: number) {
  if (decimals === 0) {
    return String(units);
  }
  const div = 10 ** decimals;
  return (units / div).toFixed(decimals);
}


/** 날짜별로 묶고, 묶음마다 통화별 합계를 답니다. */
function byDay(list: Spend[], days: TripDetail['days']) {
  const order = ['', ...days.map((d) => d.id)];
  const labels = new Map(days.map((d) => [d.id, d.date || d.label]));
  /*
    날짜 색도 함께 꺼냅니다.

    지도의 핀과 동선, 일정 화면의 날짜 카드가 이미 이 색을 씁니다. 가계부만
    무채색으로 남아 있어서, 같은 "둘째 날" 이 두 화면에서 다른 것처럼
    보였습니다. 색이 날짜를 뜻한다면 그 말을 앱 어디서나 해야 합니다.
  */
  const colors = new Map(days.map((d, i) => [d.id, d.color || dayColor(i)]));

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
        /* 어느 날인지 모르는 것에는 색이 없습니다. */
        color: colors.get(key) ?? null,
        items,
        totals: [...sums.entries()],
      };
    });
}

const styles = StyleSheet.create({
  /* 일정 화면의 날짜 카드가 쓰는 것과 같은 띠입니다. 같은 날이 두 화면에서
     같은 색으로 읽혀야 색이 날짜를 뜻하는 말이 됩니다. */
  group: {
    gap: Spacing.xs,
    borderLeftWidth: 4,
    paddingLeft: Spacing.md,
  },
  /* 어느 날인지 모르는 묶음. 띠 자리는 남겨 두어야 다른 묶음과 줄이 맞습니다. */
  groupPlain: {
    borderLeftColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowHead: {
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  /* 오른쪽 끝에 맞춥니다. 자릿수가 다른 숫자들이 왼쪽에서 시작하면
     한눈에 어느 것이 큰지 안 보입니다. */
  amount: {
    textAlign: 'right',
  },
  pick: {
    gap: Spacing.xs,
  },
  chips: {
    flexWrap: 'wrap',
  },
});
