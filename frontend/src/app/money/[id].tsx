import { Stack, useLocalSearchParams } from 'expo-router';
import { PathTitle } from '@/ui/nav';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Books, Person, Spend, Transfer, TripDetail, TripRates } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import {
  Colors,
  Gutter,
  Radius,
  Spacing,
  Tabular,
  Type,
  Weight,
  dayColor,
} from '@/constants/theme';
import type { IconName } from '@/ui';
import { decimalsOf, money, unitsOf } from '@/lib/money';
import {
  Badge,
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  Divider,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Mark,
  Picker,
  Press,
  Row,
  Screen,
  SegmentedTabs,
  Snack,
  Split,
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
 *
 * <h3>합계가 맨 위에 있습니다</h3>
 *
 * <p>「지금까지」 라는 작은 글자 아래에 합계를 적어 두었습니다. 그런데 이
 * 화면을 여는 이유의 절반은 그 숫자 하나입니다 — 그것이 화면에서 가장 큰
 * 글자여야 합니다.
 *
 * <p>그 아래에 <b>내가 받을 돈과 줄 돈</b>을 나란히 둡니다. 전에는 정산
 * 장을 열어야 알 수 있었는데, 정작 궁금한 사람은 길 위에서 쓴 돈을 적는
 * 사람입니다.
 */
export default function Money() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<'list' | 'settle'>('list');
  const { user } = useAuth();

  const { data: trip } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );
  const { data: mates } = useAsync<{ people: Person[] }>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/people`, signal),
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
    환전했을 때의 환율.

    <p>적어 둔 것과 <b>아직 안 적어 둔 통화</b>를 함께 받습니다. 적어 둔
    것만 받으면 화면이 「무엇을 적어야 합계가 나오는지」를 모릅니다 —
    처음에는 하나도 안 적어 둔 상태인데, 그때가 바로 물어봐야 할 때입니다.
  */
  const rates = useAsync<TripRates>(
    (signal) => api.get(`/api/trips/${encodeURIComponent(id)}/rates`, signal),
    [id],
  );

  /*
    판에 무엇을 띄울지.

    <p>{@code null} 이면 안 떠 있고, {@code 'new'} 면 새로 적는 것,
    지출이면 그것을 고치는 것입니다. 적는 칸과 고치는 칸이 똑같아서
    판을 두 개 둘 이유가 없습니다.
  */
  const [editing, setEditing] = useState<Spend | 'new' | null>(null);
  /* 환율을 적는 중인 통화. null 이면 판이 안 떠 있습니다. */
  const [noting, setNoting] = useState<string | null>(null);
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
  const people = mates?.people ?? [];
  const list = spent.data?.expenses ?? [];

  function refresh() {
    spent.reload();
    books.reload();
    /* 통화를 처음 쓴 지출이 들어오면 적어야 할 환율이 하나 늘어납니다. */
    rates.reload();
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
        message: `'${spend.name}' 을 지웠어요.`,
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

  /* 통화마다 얼마나 썼는지. 화면 맨 위 요약이 이것으로 섭니다 — 가계부를
     여는 이유의 절반은 "얼마나 썼지" 입니다. */
  const totals = useMemo(() => {
    const box = new Map<string, { sum: number; decimals: number }>();
    list.forEach((e) => {
      const had = box.get(e.currency) ?? { sum: 0, decimals: e.decimals };
      box.set(e.currency, { sum: had.sum + e.amount, decimals: e.decimals });
    });
    return [...box.entries()];
  }, [list]);

  /*
    적어 둔 환율로 셈한 원화 합계.

    <h3>서버가 셈한 것을 더합니다</h3>

    <p>통화별 장부에 {@code krw} 가 하나씩 붙어 옵니다. 화면에서 다시
    셈하지 않습니다 — 반올림을 두 군데서 하면 「합계」와 「통화별 합」이
    한두 원 어긋나고, 그 어긋남을 보는 사람은 어느 쪽을 믿어야 할지
    모릅니다.

    <p>하나라도 비어 있으면 합계를 안 냅니다. 엔만 바꿔 더한 값을
    「합계」로 내놓으면 <b>실제보다 적은 금액</b>이 그럴듯하게 뜹니다.
  */
  const krwTotal = useMemo(() => {
    const rows = books.data?.books ?? [];
    if (rows.length === 0 || rows.some((b) => b.krw == null)) {
      return null;
    }
    return rows.reduce((sum, b) => sum + (b.krw ?? 0), 0);
  }, [books.data]);

  /* 적어야 할 환율이 남았는지. 합계 자리에 무엇을 하라고 적을 때 씁니다. */
  const needed = rates.data?.needed ?? [];

  /*
    내 몫만 추려 냅니다.

    <p>정산표는 모든 사람의 몫을 늘어놓습니다. 그런데 요약에 적을 것은 <b>내
    것</b> 하나입니다 — 내가 받을지 줄지는 열 때마다 궁금하고, 남의 몫은
    정산 장을 열고 나서 봅니다.

    <p>통화가 여럿이면 더하지 않고 각각 셉니다. 엔으로 받을 돈과 원으로 줄
    돈은 더해지지 않습니다.
  */
  const mine = useMemo(() => {
    const rows = (books.data?.books ?? [])
      .map((book) => ({
        book,
        at: book.balances.find((b) => b.userId === user?.id) ?? null,
      }))
      .filter((row) => row.at !== null && row.at.balance !== 0);
    return {
      take: rows.filter((r) => (r.at?.balance ?? 0) > 0),
      give: rows.filter((r) => (r.at?.balance ?? 0) < 0),
    };
  }, [books.data, user]);

  return (
    <Screen
      /* 넓은 화면에서는 이 띠가 왼쪽 기둥입니다. 기둥 위쪽에 여행 이름이
         서므로 넘겨 줍니다 — 아래 띠에서는 안 씁니다. */
      tabs={<TripTabs tripId={id} active="money" title={trip?.trip.title} />}
      snack={<Snack undo={undo} onHide={hideUndo} />}
      footer={
        tab === 'list' ? (
          <Button label="쓴 돈 적기" onPress={() => setEditing('new')} />
        ) : undefined
      }>
      <Stack.Screen
        options={{
          title: trip?.trip.title ?? '가계부',
          headerTitle: () => (
            <PathTitle parent={trip?.trip.title ?? '여행'} title="가계부" />
          ),
        }}
      />

      {/*
        요약.

        <p>흰 바탕에 흰 카드를 얹으면 아무 일도 안 일어납니다. 여기만
        <b>면 카드</b>(회색 면)를 씁니다 — 눌러서 들어가는 물건이 아니라
        한 덩어리로 읽어야 하는 숫자 묶음입니다.
      */}
      {totals.length > 0 ? (
        <View style={styles.summary}>
          <Caption tone="secondary">총 쓴 돈</Caption>
          {/*
            적어 둔 환율로 전부 원화로 합칠 수 있으면 <b>원화가 큰 글자</b>입니다.

            <p>「엔으로 얼마」보다 「우리 돈으로 얼마」가 먼저 궁금한 숫자입니다.
            다만 통화 하나라도 환율이 비어 있으면 합치지 않습니다 — 엔만 바꿔
            더한 값은 실제보다 적은 금액이 그럴듯하게 뜹니다(krwTotal). 그때는
            지금처럼 첫 통화가 큰 글자입니다.
          */}
          {krwTotal != null && !(totals.length === 1 && totals[0][0] === 'KRW') ? (
            <>
              <Text style={styles.total}>{money(krwTotal, 'KRW', 0)}</Text>
              <Body small tone="secondary">
                {totals.map(([c, t]) => money(t.sum, c, t.decimals)).join(' · ')}
              </Body>
            </>
          ) : (
            <>
              {totals.map(([currency, t], at) =>
                at === 0 ? (
                  /* 첫 통화가 큰 글자입니다. 둘째부터는 한 줄로 이어 붙입니다 —
                     두 나라를 도는 여행에서만 생기는 일이라, 큰 글자를 둘
                     세우면 어느 쪽이 이 여행의 셈인지 알 수 없습니다. */
                  <Text key={currency} style={styles.total}>
                    {money(t.sum, currency, t.decimals)}
                  </Text>
                ) : null,
              )}
              {totals.length > 1 ? (
                <Body small tone="secondary">
                  {totals
                    .slice(1)
                    .map(([c, t]) => money(t.sum, c, t.decimals))
                    .join(' · ')}
                </Body>
              ) : null}
            </>
          )}

          {/*
            대충 얼마인지.

            <h3>왜 환율을 받아 오지 않는가</h3>

            <p>어디서 받아 오는 환율은 <b>중간값</b>입니다. 그 값으로 셈하면
            늘 조금씩 틀립니다 — 공항 환전은 중간값보다 한참 나쁘고, 카드는
            비자·마스터의 환율에 수수료가 또 붙습니다. 「대충 얼마 썼나」를
            보려고 띄우는 숫자인데 실제로 나간 돈과 다르면 보여 주는 뜻이
            없습니다.

            <p>환전할 때 영수증에 찍힌 값을 적어 둡니다. 그것이 그 사람이
            실제로 겪은 환율입니다.
          */}
          {krwTotal != null ? (
            <Caption tone="muted">적어 둔 환전 환율로 합친 금액이에요.</Caption>
          ) : needed.length > 0 ? (
            <Press onPress={() => setNoting(needed[0])} style={styles.askRate}>
              <Body small tone="brand">
                {needed.join(' · ')} 환전 환율을 적으면 원화로 합쳐 봐요 ›
              </Body>
            </Press>
          ) : null}

          {mine.take.length > 0 || mine.give.length > 0 ? (
            <>
              <Divider />
              <Split align="start">
                <View style={styles.myHalf}>
                  <Caption tone="secondary">내가 받을 돈</Caption>
                  {/* 없으면 색을 뺍니다. 「없음」이 주황·초록이면 할 일이 있는
                      줄로 읽힙니다. */}
                  <Text
                    style={[styles.myAmount, mine.take.length === 0 ? styles.none : styles.take]}>
                    {mine.take.length === 0
                      ? '없음'
                      : mine.take
                          .map((r) =>
                            money(
                              Math.abs(r.at?.balance ?? 0),
                              r.book.currency,
                              r.book.decimals,
                            ),
                          )
                          .join(' · ')}
                  </Text>
                </View>
                <View style={styles.myHalf}>
                  <Caption tone="secondary">내가 줄 돈</Caption>
                  <Text
                    style={[styles.myAmount, mine.give.length === 0 ? styles.none : styles.give]}>
                    {mine.give.length === 0
                      ? '없음'
                      : mine.give
                          .map((r) =>
                            money(
                              Math.abs(r.at?.balance ?? 0),
                              r.book.currency,
                              r.book.decimals,
                            ),
                          )
                          .join(' · ')}
                  </Text>
                </View>
              </Split>
            </>
          ) : null}
        </View>
      ) : null}

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
          {spent.data && list.length === 0 ? (
            <Empty message="아직 적어 둔 것이 없어요. 쓴 김에 적어 두면 돌아와서 편해요." />
          ) : null}

          {/* 날짜별로 묶습니다. 여행의 돈은 하루 단위로 기억됩니다 —
              "둘째 날에 많이 썼지" 처럼. */}
          {byDay(list, days).map((group, at) => (
            <View key={group.key}>
              {at > 0 ? <Band /> : null}
              {/*
                날짜 머리.

                <p>왼쪽에 4px 색 띠를 세우고 그 안에 줄을 담았습니다. 띠가
                세로로 길게 서면 그것이 구역의 테두리가 되어, 화면이 다시
                <b>테두리 쳐진 상자의 더미</b>가 됩니다.

                <p>색은 날짜를 가리키는 이름표일 뿐입니다. 동그라미 하나로
                줄이고, 구역을 가르는 일은 회색 띠가 맡습니다 — 일정 화면의
                날짜 머리와 같은 모양입니다.
              */}
              <Split align="baseline" style={styles.groupHead}>
                <Row gap={Spacing.s2}>
                  {group.color ? (
                    <View style={[styles.dayDot, { backgroundColor: group.color }]} />
                  ) : null}
                  <Text style={styles.groupLabel}>{group.label}</Text>
                </Row>
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
        <Settle
          tripId={id}
          me={user?.id ?? null}
          books={books.data?.books ?? []}
          loading={books.loading}
          onChanged={books.reload}
        />
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

      <RateSheet
        key={noting ?? 'none'}
        visible={noting !== null}
        tripId={id}
        currency={noting ?? ''}
        had={rates.data?.rates.find((r) => r.currency === noting)?.rate ?? null}
        onCancel={() => setNoting(null)}
        onDone={() => {
          setNoting(null);
          rates.reload();
          books.reload();
        }}
      />
    </Screen>
  );
}

/**
 * 환전했을 때의 환율을 적는 판.
 *
 * <h3>영수증에 적힌 대로 받습니다</h3>
 *
 * <p>「1엔 = ?원」 만 묻는 것으로는 모자랍니다. 환전소 영수증에 찍혀 있는
 * 것은 <b>준 돈과 받은 돈</b>이고, 거기서 환율을 끌어내려면 500,000 ÷ 54,000
 * 을 손으로 셈해야 합니다. 그 나눗셈을 하는 사람은 없습니다 — 대신 창구 위
 * 전광판에 적힌 숫자를 적게 되는데, 그 값에는 수수료가 안 들어 있어서
 * 실제로 겪은 환율이 아닙니다.
 *
 * <p>그래서 두 가지로 받습니다. 영수증 두 숫자를 넣으면 환율이 저절로 나오고,
 * 환율을 아는 사람은 그것만 적으면 됩니다. 어느 쪽으로 넣어도 저장되는 것은
 * 환율 하나입니다.
 */
function RateSheet({
  visible,
  tripId,
  currency,
  had,
  onCancel,
  onDone,
}: {
  visible: boolean;
  tripId: string;
  currency: string;
  /** 전에 적어 둔 값. 고치러 들어온 것이면 채워 둡니다 */
  had: string | null;
  onCancel: () => void;
  onDone: () => void;
}) {
  /* 영수증 쪽으로 넣는 중인지. 처음 적는 사람에게는 이쪽이 쉽습니다 —
     두 숫자를 옮겨 적기만 하면 됩니다. */
  const [bySlip, setBySlip] = useState(had == null);
  const [gave, setGave] = useState('');
  const [got, setGot] = useState('');
  const [rate, setRate] = useState(had ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
    영수증 두 숫자에서 끌어낸 환율.

    <p>준 돈 ÷ 받은 돈 입니다 — 500,000원 주고 54,000엔 받았으면
    1엔에 9.2593원입니다. 수수료가 이미 그 안에 들어 있습니다.
  */
  const derived = useMemo(() => {
    const won = Number(gave.replace(/[^0-9.]/g, ''));
    const foreign = Number(got.replace(/[^0-9.]/g, ''));
    if (!(won > 0) || !(foreign > 0)) {
      return null;
    }
    return won / foreign;
  }, [gave, got]);

  const picked = bySlip ? derived : Number(rate.replace(/[^0-9.]/g, '')) || null;

  async function save() {
    if (picked == null || !(picked > 0)) {
      setFailed(
        bySlip ? '준 돈과 받은 돈을 넣어 주세요.' : `1${currency} 가 몇 원인지 적어 주세요.`,
      );
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      await api.put(
        `/api/trips/${encodeURIComponent(tripId)}/rates/${encodeURIComponent(currency)}`,
        /* 자릿수를 여섯까지 둡니다. 동(0.0524)처럼 작은 값이 0 으로
           깎이지 않아야 합니다. */
        { rate: picked.toFixed(6) },
      );
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
      title={`${currency} 환전 환율`}
      onClose={onCancel}
      footer={<Button label="적어 두기" busy={busy} onPress={save} />}>
      <Caption tone="secondary">
        환전할 때 받은 영수증 그대로 넣어 주세요. 수수료까지 들어간 실제 환율이 나와요.
      </Caption>

      <SegmentedTabs
        items={[
          { value: 'slip', label: '영수증으로' },
          { value: 'rate', label: '환율 직접' },
        ]}
        value={bySlip ? 'slip' : 'rate'}
        onChange={(v) => setBySlip(v === 'slip')}
      />

      {bySlip ? (
        <>
          <Field
            label="준 돈 (원)"
            value={gave}
            onChangeText={setGave}
            keyboardType="numeric"
            placeholder="500000"
            unit="원"
          />
          <Field
            label={`받은 돈 (${currency})`}
            value={got}
            onChangeText={setGot}
            keyboardType="numeric"
            placeholder="54000"
            unit={currency}
          />
          {derived != null ? (
            <Body small tone="secondary">
              1{currency} = {derived.toLocaleString(undefined, { maximumFractionDigits: 4 })}원
            </Body>
          ) : null}
        </>
      ) : (
        <Field
          label={`1${currency} 는 몇 원인가요`}
          value={rate}
          onChangeText={setRate}
          keyboardType="numeric"
          placeholder="9.17"
          unit="원"
          hint="환전소 전광판 값에는 수수료가 안 들어 있어요."
        />
      )}

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
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
 *
 * <h3>앞에 갈래 그림이 섭니다</h3>
 *
 * <p>글자만 열 줄 서 있으면 어느 것이 밥이고 어느 것이 교통인지 <b>읽어야</b>
 * 압니다. 하루에 열 건을 적는 화면이라 그 열 번이 쌓입니다. 앞에 그림이
 * 있으면 훑는 눈이 먼저 갈래를 집습니다.
 */
function SpendRow({
  spend,
  people,
  placeName,
  onOpen,
}: {
  spend: Spend;
  people: Person[];
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
      <Mark icon={catMark(spend.cat)} />
      <View style={styles.grow}>
        <Row gap={Spacing.s2} style={styles.rowHead}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {spend.name}
          </Text>
          {spend.cat ? <Badge label={spend.cat} tone="muted" /> : null}
        </Row>
        <Caption tone="secondary" numberOfLines={1}>
          {spend.payerName} 님이 냄{shared ? ` · ${shared} 나눔` : ''}
          {spend.pay ? ` · ${spend.pay}` : ''}
          {placeName ? ` · ${placeName}` : ''}
        </Caption>
      </View>
      {/* 금액은 오른쪽 끝에 붙입니다. 지우기 단추가 빠지면서 자리가 났는데,
          숫자가 줄마다 다른 데서 시작하면 위아래로 훑어 견줄 수가 없습니다. */}
      <Text style={styles.amount}>
        {money(spend.amount, spend.currency, spend.decimals)}
      </Text>
    </Press>
  );
}

/**
 * 갈래를 가리키는 그림.
 *
 * <p>갈래는 사람이 적는 글입니다("밥", "저녁값", "교통"). 그래서 정해진
 * 목록에서 고르는 것이 아니라 <b>적힌 말에서 알아냅니다.</b> 못 알아내면
 * 지갑 하나로 둡니다 — 틀린 그림을 붙이는 것보다 아무 말 안 하는 쪽이
 * 낫습니다.
 */
function catMark(cat: string | null | undefined): IconName {
  const word = (cat ?? '').toLowerCase();
  if (!word) {
    return 'wallet';
  }
  if (/카페|커피|디저트|cafe/.test(word)) {
    return 'cafe';
  }
  if (/밥|식|먹|저녁|점심|아침|술|food/.test(word)) {
    return 'restaurant';
  }
  if (/교통|택시|기차|지하철|버스|렌트|항공|비행|기름/.test(word)) {
    return 'train';
  }
  if (/숙|호텔|방|집/.test(word)) {
    return 'bed';
  }
  if (/쇼핑|기념|선물|옷/.test(word)) {
    return 'bag';
  }
  if (/입장|관광|티켓|표|체험|놀이/.test(word)) {
    return 'ticket';
  }
  return 'wallet';
}

/**
 * 정산표.
 *
 * <p>통화마다 한 장입니다. 엔으로 받을 돈과 원으로 낼 돈은 더해지지 않습니다.
 * 환율로 합칠 수도 있지만 그러면 "언제 환율로" 가 남고, 그 답은 사람마다
 * 다릅니다.
 *
 * <h3>카드를 벗겼습니다</h3>
 *
 * <p>통화마다 흰 카드 한 장이었습니다. 바닥이 흰색이 되면서 카드가 바닥에
 * 녹아 없어졌습니다 — 그림자만 남아 화면이 흐릿해 보입니다. 통화 사이는
 * 회색 띠가 가릅니다.
 */
function Settle({
  tripId,
  me,
  books,
  loading,
  onChanged,
}: {
  tripId: string;
  me: string | null;
  books: Books[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
    「보냈어요 / 받았어요」.

    <p>제 쪽만 누릅니다 — 보낸 것은 보낸 사람이, 받은 것은 받은 사람이
    말합니다. 앱은 아무에게도 알리지 않습니다. 앱이 독촉하면 받는 사람에게는
    공개 망신이 됩니다.

    <p>본 금액을 같이 보냅니다. 그 사이에 지출이 바뀌어 줄이 달라졌으면 서버가
    물리고, 새로 받아 옵니다.
  */
  async function mark(t: Transfer, currency: string, change: { sent?: boolean; received?: boolean }) {
    setBusy(true);
    setFailed(null);
    try {
      await api.put(`/api/trips/${encodeURIComponent(tripId)}/settlement/mark`, {
        fromId: t.fromUserId,
        toId: t.toUserId,
        currency,
        amount: t.amount,
        ...change,
      });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  if (loading && books.length === 0) {
    return <Loading />;
  }
  if (books.length === 0) {
    return <Empty message="아직 나눌 것이 없어요." />;
  }

  /* 주고받을 것이 하나도 없으면 그 말만 합니다. 0 인 줄만 늘어놓은 표는
     읽을 것이 없습니다. */
  const done = books.every((book) => book.transfers.length === 0);
  if (done) {
    return <Empty icon="check" message="정산이 끝났어요." />;
  }

  return (
    <>
      {failed ? <ErrorNote message={failed} /> : null}
      {books.map((book, at) => (
        <View key={book.currency}>
          {at > 0 ? <Band /> : null}
          <Split align="baseline" style={styles.groupHead}>
            <Text style={styles.groupLabel}>{book.currency}</Text>
            <Caption tone="secondary">
              모두 {money(book.total, book.currency, book.decimals)}
            </Caption>
          </Split>

          {/* 누가 받고 누가 내는지. 0 인 사람은 적지 않습니다 — 줄만
              차지하고 할 일이 없습니다. */}
          {book.balances
            .filter((b) => b.balance !== 0)
            .map((b) => (
              <Split key={b.userId} style={styles.settleRow}>
                <Body>{b.name}</Body>
                <Text style={[styles.amount, b.balance > 0 ? styles.take : styles.give]}>
                  {b.balance > 0 ? '받을 ' : '줄 '}
                  {money(Math.abs(b.balance), book.currency, book.decimals)}
                </Text>
              </Split>
            ))}

          {book.transfers.length > 0 ? (
            <>
              <Divider />
              <Caption tone="secondary">이렇게 주고받으면 끝나요</Caption>
              {book.transfers.map((t, i) => {
                /* 둘 다 눌렀으면 끝난 줄입니다. 접어서 흐리게 둡니다 —
                   지우면 「아까 그 줄 어디 갔지」가 됩니다. */
                const settled = !!t.sentAt && !!t.receivedAt;
                return (
                  <View key={i} style={styles.sendRow}>
                    <Split style={styles.settleRow}>
                      <Body tone={settled ? 'muted' : undefined}>
                        {t.fromName} → {t.toName}
                      </Body>
                      <Text style={[styles.amount, settled ? styles.doneAmount : styles.give]}>
                        {money(t.amount, book.currency, book.decimals)}
                      </Text>
                    </Split>
                    {settled ? (
                      <Caption tone="success">주고받았어요</Caption>
                    ) : (
                      <Row gap={Spacing.s2}>
                        {t.sentAt ? (
                          <Caption tone="secondary">{t.fromName} 님이 보냈대요</Caption>
                        ) : null}
                        {me === t.fromUserId ? (
                          <Button
                            label={t.sentAt ? '보냈어요 거두기' : '보냈어요'}
                            variant={t.sentAt ? 'ghost' : 'secondary'}
                            compact
                            busy={busy}
                            onPress={() => mark(t, book.currency, { sent: !t.sentAt })}
                          />
                        ) : null}
                        {me === t.toUserId ? (
                          <Button
                            label="받았어요"
                            variant="secondary"
                            compact
                            busy={busy}
                            onPress={() => mark(t, book.currency, { received: true })}
                          />
                        ) : null}
                      </Row>
                    )}
                  </View>
                );
              })}
            </>
          ) : null}
        </View>
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
 * <h3>금액이 맨 위, 가장 큰 글자</h3>
 *
 * <p>「무엇에」 를 먼저 묻고 금액을 둘째로 두었습니다. 그런데 돈을 적으려고
 * 판을 여는 사람의 손에는 이미 영수증이 들려 있습니다 — 먼저 치는 것은
 * 늘 숫자입니다. 자판도 숫자판으로 열립니다.
 *
 * <p>통화는 그 옆에 붙입니다. 금액과 통화는 한 값이라 떨어져 있으면 "9000"
 * 이 원인지 엔인지를 두 군데서 확인해야 합니다.
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
  people: Person[];
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
      footer={<Button label={spend ? '고쳤어요' : '적기'} onPress={submit} busy={busy} />}>
      {/*
        금액과 통화는 한 줄입니다.

        <p>라벨을 안 답니다. 큰 숫자 하나와 통화 알약이 나란히 있으면 그것이
        금액이라는 것은 더 설명할 것이 없습니다. 자리 표시 글자가 그 일을
        합니다.
      */}
      <View style={styles.amountRow}>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          placeholder={decimals > 0 ? '12.50' : '0'}
          placeholderTextColor={Colors.textDisabled}
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel="얼마"
        />
        <Row gap={Spacing.s2} style={styles.chips}>
          {currencies.map((c) => (
            <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </Row>
      </View>
      {decimals > 0 ? (
        <Caption tone="muted">소수점 아래 두 자리까지 적을 수 있어요.</Caption>
      ) : null}

      <Field
        label="무엇에"
        value={name}
        onChangeText={setName}
        placeholder="첫날 저녁"
        returnKeyType="next"
      />

      {/* 안 고르면 적는 사람이 낸 것으로 봅니다. 대개 그렇습니다. */}
      {people.length > 1 ? (
        <View style={styles.pick}>
          <Text style={styles.pickLabel}>누가 냈나요?</Text>
          <Row gap={Spacing.s2} style={styles.chips}>
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
          <Text style={styles.pickLabel}>누가 나눠 내나요?</Text>
          <Row gap={Spacing.s2} style={styles.chips}>
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

      {/*
        날과 곳은 <b>고르는 칸</b>으로 둡니다.

        <p>칩으로 늘어놓고 있었습니다. 닷새짜리면 날이 다섯이고 하루에 스무
        곳을 넣은 날도 있어, 돈 하나 적으려고 칩 스물다섯을 지나야 했습니다.
        적는 칸(금액·무엇에)이 그만큼 아래로 밀립니다.

        <p>칩으로 남긴 것들(통화·누가 냈나)은 고를 것이 두셋뿐이라 한 번에
        다 보이고 한 번에 눌립니다. 그쪽이 낫습니다.
      */}
      {days.length > 0 ? (
        <View style={styles.pick}>
          <Text style={styles.pickLabel}>어느 날</Text>
          <Row gap={Spacing.s2} style={styles.chips}>
            <Picker
              label="날"
              allLabel="아직 모름"
              value={dayId}
              options={days.map((d) => ({ value: d.id, label: d.date || d.label }))}
              onChange={(next) => {
                setDayId(next);
                /* 곳은 날에 딸려 있습니다. 날을 바꾸면 앞서 고른 곳은 그
                   날의 것이 아닙니다. */
                setPlaceId(null);
              }}
            />
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
          <Text style={styles.pickLabel}>어디서</Text>
          <Row gap={Spacing.s2} style={styles.chips}>
            <Picker
              label="곳"
              allLabel="어디랄 것 없이"
              value={placeId}
              options={dayPlaces.map((p) => ({ value: p.id, label: p.name }))}
              onChange={setPlaceId}
            />
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
            variant="dangerText"
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

    지도의 핀과 동선, 일정 화면의 날짜 머리가 이미 이 색을 씁니다. 가계부만
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

/*
  고정폭 숫자.

  <p>토큰이 값을 읽기전용 배열로 적어 두어서 글자 모양에 그대로 못 넘깁니다.
  한 번 풀어 주고 금액 글자들이 같은 것을 씁니다 — 1 과 8 의 폭이 같아야
  위아래로 견줄 때 자리가 맞습니다.
*/

const styles = StyleSheet.create({
  /* 송금 줄 하나 — 금액 줄과 그 아래 「보냈어요」 줄. */
  sendRow: {
    gap: Spacing.s1,
    paddingBottom: Spacing.s2,
  },
  /* 끝난 줄의 금액. 주황을 빼고 흐리게 둡니다 — 더 할 일이 없습니다. */
  doneAmount: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },

  /* -------------------------------------------------------------- 요약 */
  /* 환율을 적으러 가는 줄. 글자만 있는 자리라 누르는 넓이를 위아래로
     조금 넓혀 둡니다. */
  askRate: {
    paddingVertical: Spacing.s1,
  },
  summary: {
    backgroundColor: Colors.fill,
    borderRadius: Radius.r4,
    padding: Spacing.s5,
    gap: Spacing.s1,
  },
  total: {
    ...Type.title1,
    ...Tabular,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  myHalf: {
    flex: 1,
    gap: 2,
  },
  myAmount: {
    ...Type.headline,
    ...Tabular,
    fontWeight: Weight.semibold,
  },
  /** 받을 돈. 완료·정해짐과 같은 초록입니다. */
  take: {
    color: Colors.success,
  },
  /** 줄 돈. 마감 임박과 같은 주황입니다 — 빨강은 지우기 자리입니다. */
  /* 받을 것·줄 것이 없을 때. 회색 — 할 일이 없습니다. */
  none: {
    color: Colors.textMuted,
  },
  give: {
    color: Colors.warning,
  },

  /* -------------------------------------------------------------- 목록 */
  /*
    묶음의 이름.

    <p>제목은 아래 것의 이름이니 아래와 가까워야 합니다. 위는 띠가 이미
    띄워 놓았으므로 여기서는 아래만 좁힙니다.
  */
  groupHead: {
    paddingTop: Spacing.s2,
    paddingBottom: Spacing.s1,
  },
  groupLabel: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Colors.textSecondary,
  },
  /* 날짜 색. 이름표 하나면 되므로 작습니다. */
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    paddingVertical: Spacing.s3,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowHead: {
    alignItems: 'center',
  },
  rowTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  grow: {
    flex: 1,
  },
  /* 오른쪽 끝에 맞춥니다. 자릿수가 다른 숫자들이 왼쪽에서 시작하면
     한눈에 어느 것이 큰지 안 보입니다. */
  amount: {
    ...Type.headline,
    ...Tabular,
    fontWeight: Weight.semibold,
    color: Colors.text,
    textAlign: 'right',
  },
  settleRow: {
    minHeight: 44,
  },

  /* ---------------------------------------------------------------- 판 */
  amountRow: {
    gap: Spacing.s2,
  },
  /*
    판에서 가장 큰 글자.

    <p>입력칸 테두리를 두르지 않습니다. 숫자 하나만 받는 자리라 테두리가
    없어도 어디를 치는지 헷갈리지 않고, 테두리를 두르면 아래 칸들과 같은
    무게가 되어 「맨 위에 크게」 가 무색해집니다.
  */
  amountInput: {
    ...Type.title1,
    ...Tabular,
    fontWeight: Weight.bold,
    color: Colors.text,
    paddingVertical: Spacing.s1,
  },
  pick: {
    gap: Spacing.s2,
  },
  pickLabel: {
    ...Type.caption,
    fontWeight: Weight.medium,
    color: Colors.textSecondary,
  },
  chips: {
    flexWrap: 'wrap',
  },
});
