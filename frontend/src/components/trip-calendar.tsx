import { Fragment, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { api, API_BASE } from '@/api/client';
import type { FeedPost, FeedSlice, OpenDate, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { OurPhoto } from '@/components/our-photo';
import { Colors, Radius, Spacing, Tabular, Type, Weight } from '@/constants/theme';
import { formatSpan, todayIso } from '@/lib/countdown';
import { Body, Caption, Icon, Mark, Press, Row } from '@/ui';

/**
 * 날마다 내가 올린 글 수 — {@code GET /api/feed/days}.
 *
 * <p>{@code api/types.ts} 가 아니라 여기 둡니다. 이 꼴을 받는 자리가 이 부품
 * 하나라, 공용 표에 올려 두면 어디서 쓰는지 찾아야 알게 됩니다. 쓰는 자리가
 * 둘이 되면 그때 옮깁니다.
 *
 * <p>글이 없는 날은 <b>칸이 없습니다</b>. 서른 칸을 다 채워 받으면 글 두 편
 * 올린 달에 0 이 스물여덟 개 옵니다.
 */
type FeedDays = { days: Record<string, number> };

/**
 * 여행이 달린 달력.
 *
 * <h3>두 자리가 같은 것을 씁니다</h3>
 *
 * <p>모임 캘린더는 「우리 모임은 언제 뭐 하지」를, 마이페이지 캘린더는
 * 「나는 언제 어디 가지」를 묻습니다. 묻는 것은 다르지만 그리는 것은
 * 같습니다 — 날짜를 가로지르는 막대. 부품을 둘 두면 한쪽만 고쳐집니다.
 *
 * <h3>칸 달력을 화면 가득 두지 않습니다</h3>
 *
 * <p>여행은 일 년에 몇 번입니다. 한 달을 가득 그리면 <b>대부분이 빈칸</b>
 * 이고, 그 빈칸이 화면의 절반을 먹습니다. 달력은 위에 작게 두고 — 한 칸이
 * 글자 하나 들어갈 만큼 — 아래에 그 달의 여행 목록을 붙입니다.
 *
 * <p>여행이 없는 달에는 다음 여행으로 건너뛰는 줄을 둡니다. 빈 달에서
 * 화살표를 몇 번 눌러 찾게 두지 않습니다.
 *
 * <h3>날짜가 없는 여행</h3>
 *
 * <p>달력에 못 올립니다. 목록 맨 아래 「날짜 미정」으로 모읍니다 — 안
 * 모으면 그 여행들이 아무 달에도 안 보여서 사라진 것처럼 됩니다.
 *
 * <h3>날을 누르면 그날 동선이 그려집니다</h3>
 *
 * <p>글자만 있던 자리입니다. 「오전 10시 절, 오후 1시 시장」을 읽어도 그것이
 * 한 동네 안인지 도시를 가로지르는 하루인지는 안 보입니다. 그림 한 장이 그
 * 하나를 말합니다({@link DayRoute}).
 *
 * <p><b>누른 날 하나만</b> 그립니다. 그림 한 장이 구글 호출 한 번이라, 달력
 * 칸마다 달면 달을 넘길 때마다 서른 번입니다. 미리 받아 두지도 않습니다 —
 * 옆날을 끼워 두면 안 누른 날에 요금을 내는 셈입니다.
 *
 * <h3>그날 내가 올린 글</h3>
 *
 * <p>칸에 작은 수 하나, 누르면 아래에 그 글들({@link DayPosts}). {@code onPost}
 * 를 받은 자리에서만 합니다.
 *
 * <p>모임 달력에는 안 답니다. 세는 것이 <b>보는 사람이 올린 글 전부</b>라서
 * 모임을 안 가립니다 — 모임 달력에 적으면 「이 모임에 올린 글」로 읽히는데 그
 * 수가 아니고, 모임이 셋이면 셋 다 같은 수가 적힙니다. 모임별로 세려면 서버가
 * 모임 칸을 하나 더 받아야 하는데, 쓸 자리가 생기기 전에 길을 내 두지
 * 않습니다.
 *
 * <p><b>달은 한 번만 묻습니다.</b> 날을 눌러도 그 달의 수는 다시 안 받고, 누른
 * 날의 글만 한 번 더 받습니다.
 */
export function TripCalendar({
  trips,
  onOpen,
  showGroup = false,
  polls = [],
  onPoll,
  onPick,
  onPost,
}: {
  trips: TripSummary[];
  onOpen: (trip: TripSummary) => void;
  /** 모임 이름을 줄에 붙일지. 마이페이지에서는 켭니다(여러 모임이 섞입니다) */
  showGroup?: boolean;
  /**
   * 아직 정하는 중인 날짜 후보(모임 달력).
   *
   * <p>여행 막대와 섞이지 않게 <b>속이 빈 점</b>으로 찍습니다. 정해진 것과
   * 정하는 중인 것이 같은 모양이면 「그날 가기로 했나」로 읽힙니다.
   */
  polls?: OpenDate[];
  /** 후보 줄을 누르면 그 여행의 「언제 갈까」 판을 엽니다 */
  onPoll?: (tripId: string) => void;
  /** 날을 눌렀을 때(풀면 null). 마이페이지가 그날 장소와 쓴 돈을 아래에 그립니다 */
  onPick?: (iso: string | null) => void;
  /**
   * 그날 내가 올린 글을 눌렀을 때.
   *
   * <p><b>주면 켜집니다</b> — 칸에 글 수를 적고 누른 날 아래에 그 글들을
   * 세웁니다. 안 주면 서버에 아무것도 묻지 않습니다(모임 달력이 그 자리입니다.
   * 위 설명).
   *
   * <p>켜는 깃발과 누르는 자리를 따로 두지 않습니다. 둘이면 하나만 주는 길이
   * 생기는데, 그때는 글이 줄로 서 있으면서 눌러도 아무 일이 없습니다.
   */
  onPost?: (postId: string) => void;
}) {
  /* 보고 있는 달. 오늘이 든 달에서 시작합니다. */
  const [at, setAt] = useState(() => {
    const now = new Date(todayIso());
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  /* 눌러 둔 날. 누르면 아래 목록이 그날로 좁혀집니다. */
  const [picked, setPicked] = useState<string | null>(null);

  const dated = useMemo(() => trips.filter((t) => t.startIso != null), [trips]);
  const undated = useMemo(() => trips.filter((t) => t.startIso == null), [trips]);

  /*
    이 달에 걸치는 여행.

    <p>이 달에 <b>시작하는</b> 것이 아니라 걸치는 것입니다 — 말일에
    시작해 다음 달까지 가는 여행은 두 달에 다 보여야 합니다.
  */
  const month = useMemo(() => {
    const first = `${at.year}-${String(at.month + 1).padStart(2, '0')}-01`;
    const last = `${at.year}-${String(at.month + 1).padStart(2, '0')}-31`;
    return dated.filter((t) => {
      const from = t.startIso as string;
      const to = t.endIso ?? from;
      return from <= last && to >= first;
    });
  }, [dated, at]);

  /** 날짜(1~말일) → 그날 걸치는 여행들. 칸을 칠하는 데 씁니다. */
  const byDay = useMemo(() => {
    const box = new Map<number, TripSummary[]>();
    const days = new Date(at.year, at.month + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const iso = `${at.year}-${String(at.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const on = month.filter((t) => {
        const from = t.startIso as string;
        return from <= iso && (t.endIso ?? from) >= iso;
      });
      if (on.length > 0) {
        box.set(d, on);
      }
    }
    return box;
  }, [month, at]);

  /** 날짜 → 그날 걸치는 후보 수. 속 빈 점을 찍는 데 씁니다. */
  const pollDay = useMemo(() => {
    const box = new Map<number, number>();
    const days = new Date(at.year, at.month + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const iso = `${at.year}-${String(at.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const n = polls.filter((p) => p.startIso <= iso && p.endIso >= iso).length;
      if (n > 0) {
        box.set(d, n);
      }
    }
    return box;
  }, [polls, at]);

  /* 이 달에 걸치는 후보. 날을 눌러 두면 그날 것만. */
  const monthPolls = useMemo(() => {
    const first = `${at.year}-${String(at.month + 1).padStart(2, '0')}-01`;
    const last = `${at.year}-${String(at.month + 1).padStart(2, '0')}-31`;
    return polls.filter(
      (p) =>
        p.startIso <= last &&
        p.endIso >= first &&
        (picked == null || (p.startIso <= picked && p.endIso >= picked)),
    );
  }, [polls, at, picked]);

  /*
    서버에 물을 이 달의 양 끝.

    <p>위의 칸 거르기가 쓰는 {@code -31} 과 다릅니다. 저쪽은 글자 비교의
    위쪽 울타리라 넘쳐도 되는데, 이쪽은 <b>서버가 날짜로 읽습니다</b> —
    2월에 31일을 적어 보내면 날짜가 아닙니다.
  */
  const span = useMemo(() => {
    const mm = String(at.month + 1).padStart(2, '0');
    const end = new Date(at.year, at.month + 1, 0).getDate();
    return { from: `${at.year}-${mm}-01`, to: `${at.year}-${mm}-${String(end).padStart(2, '0')}` };
  }, [at]);

  /*
    이 달에 날마다 내가 올린 글 수.

    <p>한 달에 한 번입니다. 칸마다 묻는 길이면 달을 넘길 때마다 서른 번인데,
    아직 아무 날도 안 누른 화면에서 그렇습니다.

    <p>{@code onPost} 를 <b>있나 없나로만</b> 봅니다. 그 함수를 그대로 두면
    부르는 쪽이 매번 새 화살표를 넘기므로, 날을 누를 때마다(부모가 다시 그릴
    때마다) 한 달을 또 받습니다.
  */
  const counted = useAsync<FeedDays | null>(
    (signal) =>
      onPost
        ? api.get(`/api/feed/days?from=${span.from}&to=${span.to}`, signal)
        : Promise.resolve(null),
    [onPost != null, span.from, span.to],
  );

  /*
    누른 날 내가 올린 글.

    <p>날이 바뀔 때만 받습니다. 달의 수와 따로 받는 까닭은 되묻는 때가
    다르기 때문입니다 — 날은 자주 바뀌고 달은 드물게 바뀝니다.
  */
  const dayFeed = useAsync<FeedSlice | null>(
    (signal) =>
      onPost && picked
        ? api.get(`/api/feed?mine=true&on=${encodeURIComponent(picked)}`, signal)
        : Promise.resolve(null),
    [onPost != null, picked],
  );

  /* 칸에 적을 수. 받기 전에는 빈 표라 어느 칸에도 안 적힙니다 — 0 을 깔아
     두면 글이 있는 날에 0 이 한 박자 보입니다. */
  const wrote = counted.data?.days ?? {};

  /*
    누른 날의 글. <b>아직 안 왔으면 {@code null} 입니다.</b>

    <p>{@code onPost} 가 없으면 묻지 않으므로 빈 배열입니다 — 거기서는 글이
    없는 것이 확정이라 아래 「아무것도 없어요」가 기다릴 이유가 없습니다.
  */
  const postsOn: FeedPost[] | null = onPost ? (dayFeed.data?.posts ?? null) : [];

  /* 이 달에 아무것도 없을 때 건너뛸 곳. 오늘 이후로 가장 가까운 여행입니다. */
  const next = useMemo(() => {
    const today = todayIso();
    return dated
      .filter((t) => (t.endIso ?? (t.startIso as string)) >= today)
      .sort((a, b) => (a.startIso as string).localeCompare(b.startIso as string))[0];
  }, [dated]);

  const days = new Date(at.year, at.month + 1, 0).getDate();
  /*
    첫 날이 무슨 요일인가.

    <p>일요일부터 시작합니다. 한국 달력이 그렇습니다 — 월요일 시작은
    주를 세는 자리(업무용)에서 씁니다.
  */
  const lead = new Date(at.year, at.month, 1).getDay();
  const shown = picked ? month.filter((t) => covers(t, picked)) : month;

  /*
    「이날은 아무것도 없어요」를 적을 때.

    <p>여행도 없고 글도 없어야 하고, <b>글을 받아 본 뒤</b>여야 합니다. 받기
    전에 적으면 글이 셋 있는 날에도 그 말이 한 박자 먼저 뜨고, 사람은 없다고
    읽은 자리에 글이 들어서는 것을 봅니다.
  */
  const sayDayEmpty =
    picked != null && shown.length === 0 && postsOn != null && postsOn.length === 0;

  function move(by: number) {
    setPicked(null);
    onPick?.(null);
    setAt((was) => {
      const m = was.month + by;
      return { year: was.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <View style={styles.page}>
      <Row gap={Spacing.s2} style={styles.head}>
        <Press onPress={() => move(-1)} accessibilityLabel="지난 달" style={styles.arrow}>
          <Icon name="chevron-left" size={20} tone="secondary" />
        </Press>
        <Text style={styles.month}>
          {at.year}년 {at.month + 1}월
        </Text>
        <Press onPress={() => move(1)} accessibilityLabel="다음 달" style={styles.arrow}>
          <Icon name="chevron-right" size={20} tone="secondary" />
        </Press>
      </Row>

      {/* 요일 머리. 토·일만 색이 다릅니다 — 일곱을 다 물들이면 아무것도
          구별되지 않습니다. */}
      <View style={styles.grid}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <View key={d} style={CELL}>
            <Text style={[styles.dow, i === 0 ? styles.sun : null]}>{d}</Text>
          </View>
        ))}

        {/* 첫 주의 빈 칸. */}
        {Array.from({ length: lead }, (_, i) => (
          <View key={`lead-${i}`} style={CELL} />
        ))}

        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const iso = `${at.year}-${String(at.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const on = byDay.get(d) ?? [];
          const today = iso === todayIso();
          return (
            <Press
              key={iso}
              onPress={() => {
                const next = picked === iso ? null : iso;
                setPicked(next);
                onPick?.(next);
              }}
              accessibilityLabel={`${at.month + 1}월 ${d}일${on.length > 0 ? ` 여행 ${on.length}` : ''}${
                wrote[iso] ? ` 글 ${wrote[iso]}` : ''
              }`}
              accessibilityState={{ selected: picked === iso }}
              scale={1}
              style={CELL}>
              <View
                style={[
                  styles.dayBox,
                  today ? styles.todayBox : null,
                  picked === iso ? styles.pickedBox : null,
                ]}>
                {/*
                  그날 내가 올린 글 수.

                  <p>여행 점과 <b>섞이면 안 됩니다</b>. 점은 색이 찍힌
                  동그라미가 날짜 아래 가운데 서는 것이고, 이것은 칸 오른쪽 위에
                  선 옅은 숫자입니다 — 자리도 모양도 색도 달라서 「이날 여행이
                  하나 더」로 안 읽힙니다.

                  <p>동그라미에 담지 않습니다. 담으면 소식함의 안 읽은 수처럼
                  <b>답해야 할 것</b>으로 보이는데, 이것은 이미 내가 한 일의
                  수입니다.

                  <p>0 은 안 적습니다. 서른 칸에 0 이 스물여덟 개 적히면 숫자가
                  칸을 설명하는 것이 아니라 칸을 덮습니다.
                */}
                {wrote[iso] ? <Text style={styles.wrote}>{wrote[iso]}</Text> : null}
                <Text style={[styles.day, (i + lead) % 7 === 0 ? styles.sun : null]}>{d}</Text>
                {/*
                  그날 걸치는 여행을 점으로.

                  <p>막대로 이으려면 칸을 가로질러 그려야 하고, 그러려면
                  달력이 격자가 아니라 겹쳐 그리는 판이 됩니다. 점 하나가
                  「이날 뭐 있다」를 말하는 데 충분합니다 — 무엇인지는 바로
                  아래 목록이 적습니다.

                  <p>셋까지만 찍습니다. 넷이 겹치는 날은 점이 칸을 넘칩니다.
                */}
                {on.length > 0 || pollDay.has(d) ? (
                  <View style={styles.dots}>
                    {on.slice(0, 3).map((t) => (
                      <View
                        key={t.id}
                        style={[styles.dot, { backgroundColor: t.theme ?? Colors.accent }]}
                      />
                    ))}
                    {pollDay.has(d) && on.length < 3 ? <View style={styles.pollDot} /> : null}
                  </View>
                ) : null}
              </View>
            </Press>
          );
        })}
      </View>

      {/*
        정하는 중인 날짜.

        <p>여행 목록 위에 둡니다. 답해야 하는 일이 이미 정해진 일보다
        먼저입니다 — 아래에 두면 여행이 많은 달에 안 보입니다.
      */}
      {monthPolls.map((p) => (
        <Press key={p.id} onPress={() => onPoll?.(p.tripId)} scale={1} style={styles.row}>
          <View style={[styles.mark, styles.pollMark]} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {p.tripTitle}
            </Text>
            <Caption tone="secondary" numberOfLines={1}>
              날짜 후보 · {formatSpan(p.startIso, p.endIso)}
              {p.mine ? '' : ' · 아직 답 안 함'}
            </Caption>
          </View>
          <Icon name="chevron-right" size={20} tone="muted" />
        </Press>
      ))}

      {/*
        누른 날 내가 올린 글.

        <p>여행 목록 <b>위</b>에 둡니다. 아래에 두면 여행 줄과 그 줄에 딸린
        것들(그날 동선 그림, 마이페이지가 그 아래 잇는 장소와 쓴 돈) 사이를
        가르게 되는데, 그 셋은 한 여행의 한 덩어리입니다.
      */}
      {picked && onPost ? <DayPosts posts={postsOn} onOpen={onPost} /> : null}

      {/* 이 달 목록. 날을 눌러 두면 그날로 좁혀집니다. */}
      {shown.length > 0 ? (
        shown.map((t) => (
          <Fragment key={t.id}>
            <Press onPress={() => onOpen(t)} scale={1} style={styles.row}>
              <View style={[styles.mark, { backgroundColor: t.theme ?? Colors.accent }]} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {t.title}
                </Text>
                <Caption tone="secondary" numberOfLines={1}>
                  {formatSpan(t.startIso, t.endIso)}
                  {showGroup && t.groupName ? ` · ${t.groupName}` : ''}
                </Caption>
              </View>
              <Icon name="chevron-right" size={20} tone="muted" />
            </Press>
            {/*
              그날 동선. 누른 날에만 섭니다.

              <p>여행마다 한 장입니다. 한 날에 혼자 여행과 모임 여행이 겹치면
              두 장이 되는데, 둘을 한 장에 겹쳐 그리면 같은 색 선 둘이 섞여
              어느 것이 어느 여행인지 알 수 없습니다. 줄 바로 아래에 두어
              위의 이름과 짝이 보이게 합니다.

              <p>날이 바뀌면 다시 세웁니다({@code key} 에 날짜가 들어
              있습니다). 안 그러면 그림을 못 받아 숨은 자리가 다음 날에도
              숨은 채로 남습니다.
            */}
            {picked ? <DayRoute key={`${t.id}-${picked}`} trip={t} iso={picked} /> : null}
          </Fragment>
        ))
      ) : sayDayEmpty ? (
        <Caption tone="secondary">이날은 아무것도 없어요.</Caption>
      ) : picked ? (
        /* 글이 오는 중입니다. 여기서 「없어요」를 적으면 바로 뒤에 글이
           들어섭니다({@code sayDayEmpty}). */
        null
      ) : next ? (
        /* 빈 달에서 화살표를 몇 번 눌러 찾게 두지 않습니다. */
        <Press
          onPress={() => {
            const from = new Date(next.startIso as string);
            setPicked(null);
            setAt({ year: from.getFullYear(), month: from.getMonth() });
          }}
          scale={1}
          style={styles.row}>
          <Caption tone="brand">
            다음 여행: {formatSpan(next.startIso, next.endIso)} · {next.title} ›
          </Caption>
        </Press>
      ) : (
        <Caption tone="secondary">이 달에는 아무것도 없어요.</Caption>
      )}

      {/* 날짜를 아직 안 정한 것들. 달력에 올릴 수 없어서 여기 모읍니다. */}
      {undated.length > 0 && !picked ? (
        <>
          <Caption tone="muted">날짜 미정</Caption>
          {undated.map((t) => (
            <Press key={t.id} onPress={() => onOpen(t)} scale={1} style={styles.row}>
              <View style={[styles.mark, { backgroundColor: t.theme ?? Colors.accent }]} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {t.title}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} tone="muted" />
            </Press>
          ))}
        </>
      ) : null}
    </View>
  );
}

/**
 * 그날 동선 한 장.
 *
 * <h3>왜 줄 아래 폭을 다 쓰는가</h3>
 *
 * <p>줄 안에 네모로 끼워 넣어 봤습니다. 줄 높이가 56 이라 그 안에 들어가는
 * 그림은 한 변이 48 이고, 하루에 네 곳을 돈 동선이 그 안에서는 <b>점 네 개가
 * 겹친 얼룩</b>입니다. 보여 주려던 것이 「어느 동네를 어떻게 도는가」인데 그
 * 크기에서는 그것이 안 남습니다.
 *
 * <p>비율은 서버가 그리는 크기(600×320)를 그대로 받습니다. 높이를 못 박고
 * 잘라 쓰면 위아래 핀이 날아가, 하루의 처음과 끝이 사라집니다.
 *
 * <h3>묻지 않는 때</h3>
 *
 * <p>곳이 한 군데도 없는 여행은 어느 날을 눌러도 그릴 것이 없습니다. 여행
 * 목록이 이미 그 수를 들고 있으니({@code placeCount}) 서버에 묻지 않습니다 —
 * 날짜만 안 넣은 여행이 달력에 줄로 서 있는 일이 흔합니다.
 *
 * <p>그 날만 비어 있는 경우는 여기서 알 수 없습니다. 서버가 400 으로
 * 답하는데, 그 전에 걸러지므로 <b>구글 호출은 일어나지 않습니다</b>. 그때는
 * 이 자리를 아예 접습니다 — 빈 회색 네모가 남으면 「안 불러온 것」으로
 * 읽힙니다.
 */
function DayRoute({ trip, iso }: { trip: TripSummary; iso: string }) {
  /* wait 받는 중 · drawn 그려짐 · none 그릴 것이 없음(또는 지도가 꺼져 있음) */
  const [state, setState] = useState<'wait' | 'drawn' | 'none'>('wait');

  if (trip.placeCount === 0 || state === 'none') {
    return null;
  }

  return (
    <View style={styles.route}>
      {/* 기다리는 동안. 그림이 오면 그 위를 덮습니다. */}
      {state === 'wait' ? (
        <View style={styles.routeWait}>
          <Caption tone="muted">동선을 가져오고 있어요</Caption>
        </View>
      ) : null}
      <Image
        source={{
          uri: `${API_BASE}/api/trips/${encodeURIComponent(trip.id)}/map?date=${encodeURIComponent(iso)}`,
        }}
        style={styles.routeImage}
        resizeMode="cover"
        accessibilityLabel={`${trip.title} 그날 동선`}
        onLoad={() => setState('drawn')}
        onError={() => setState('none')}
      />
    </View>
  );
}

/**
 * 누른 날 내가 올린 글 — <b>카드가 아니라 줄</b>입니다.
 *
 * <h3>왜 {@code FeedCard} 를 안 세우나</h3>
 *
 * <p>그 카드는 글쓴이 얼굴과 이름, 사진 묶음, 글, 태그, 공개 범위 꼬리표,
 * 접힌 댓글, 다루기 판을 다 들고 있습니다. 여기서는 셋이 어긋납니다.
 *
 * <ul>
 *   <li>글쓴이가 <b>늘 나</b>입니다 — 서버가 내 글만 내주는 길입니다. 글마다
 *       내 얼굴과 내 이름이 한 번씩 더 섭니다
 *   <li>위에 달력 한 판과 그날 동선 그림(600×320)이 이미 서 있습니다. 카드
 *       셋이면 <b>달력이 화면에서 밀려 나갑니다</b> — 다른 날을 누르려면 다시
 *       올려야 하는데, 그 누르는 일이 이 화면을 쓰는 방법입니다
 *   <li>아래 형제가 여행 줄과 그날 장소 글자입니다. 그 사이에 카드가 끼면
 *       다른 화면을 꿰매 붙인 것처럼 보입니다
 * </ul>
 *
 * <p>잃는 것은 없습니다. 누르면 글 한 편이 서는 화면이 열리고
 * ({@code app/feed/[id]}) 거기에 그 카드가 댓글까지 펼쳐 서 있습니다 — 그
 * 화면이 있는 까닭이 이것입니다.
 *
 * <h3>안 왔으면 아무것도 안 그립니다</h3>
 *
 * <p>「없어요」는 이 자리에서 안 적습니다. 그 말은 여행까지 함께 보고 나서야
 * 할 수 있어서 부르는 쪽이 적습니다({@code sayDayEmpty}).
 */
function DayPosts({
  posts,
  onOpen,
}: {
  /** 아직 안 왔으면 {@code null}. 빈 배열은 「그날 글이 없음」입니다 */
  posts: FeedPost[] | null;
  onOpen: (postId: string) => void;
}) {
  if (posts == null || posts.length === 0) {
    return null;
  }
  return (
    <>
      <Caption tone="muted">이날 올린 글 {posts.length}</Caption>
      {posts.map((p) => (
        <Press
          key={p.id}
          onPress={() => onOpen(p.id)}
          scale={1}
          accessibilityLabel={`${clockOf(p.createdAt)}에 올린 글`}
          style={styles.row}>
          {/* 사진이 있으면 첫 장이 표식입니다 — 무엇에 대한 글인지 글자보다
              빨리 걸립니다. 글만 쓴 것에 사진 그림을 세우면 「사진이 있다」로
              읽히므로 말풍선을 둡니다. */}
          {p.photoIds.length > 0 ? (
            <OurPhoto id={p.photoIds[0]} width={40} height={40} />
          ) : (
            <Mark icon="message-square" />
          )}
          <View style={styles.rowText}>
            {/* 사진만 올린 글에는 적을 글자가 없습니다. 빈 줄을 두면 줄이
                무엇인지 모를 채로 서므로 몇 장인지로 갈음합니다. */}
            <Body small numberOfLines={1}>
              {p.text ?? `사진 ${p.photoIds.length}장`}
            </Body>
            <Caption tone="secondary" numberOfLines={1}>
              {[
                clockOf(p.createdAt),
                p.text != null && p.photoIds.length > 0 ? `사진 ${p.photoIds.length}장` : null,
                p.commentCount > 0 ? `댓글 ${p.commentCount}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Caption>
          </View>
          <Icon name="chevron-right" size={20} tone="muted" />
        </Press>
      ))}
    </>
  );
}

/**
 * 그날 몇 시에 올린 것인지 — {@code 09:40}.
 *
 * <p>「세 시간 전」이 아닙니다({@code feed-card} 의 {@code ago}). 그 말은 목록을
 * 내리며 새 글을 가리는 데 쓰는 것이고, 하루를 펼쳐 놓은 이 자리에서 뜻이
 * 있는 것은 하루 안의 차례입니다 — 바로 아래 그날 장소들도 같은 꼴로 시각을
 * 적습니다({@code me.tsx} 의 {@code TripDay}).
 *
 * <p><b>기기 시계</b>로 적습니다. 칸을 가른 쪽은 서버 시계라
 * ({@code FeedService.calendarZone}) 둘이 다른 나라에 있으면 10월 2일 칸에 선
 * 글이 23:50 으로 보일 수 있습니다. 맞추려면 서버가 글마다 날짜와 시각을
 * 글자로 실어 보내야 하는데, 화면 한 자리 때문에 모든 피드 카드에 칸을 둘
 * 늘리는 일입니다.
 */
function clockOf(iso: string) {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** 이 여행이 그날에 걸치나. */
function covers(trip: TripSummary, iso: string) {
  const from = trip.startIso as string;
  return from <= iso && (trip.endIso ?? from) >= iso;
}

/*
  달력 한 칸.

  <p>{@code StyleSheet.create} 밖에 둡니다. 백분율 폭이 들어가면 그 안에서는
  타입이 {@code ViewStyle | TextStyle | ImageStyle} 로 넓어지고, 그러면 View 에
  넘길 때 거절당합니다. 밖에서 {@link ViewStyle} 이라고 못 박으면 그 추론이
  일어나지 않습니다.

  <p>일곱으로 나눕니다 — 백분율이라 폭이 달라져도 일곱이 유지됩니다.
*/
const CELL: ViewStyle = {
  width: `${100 / 7}%`,
  alignItems: 'center',
  paddingVertical: 2,
};

const styles = StyleSheet.create({
  /*
    겉자리.

    <p>{@code gap} 하나만 두면 타입이 안 정해집니다 — gap 은 View·Text·Image
    세 갈래에 다 있어서 TS 가 어느 것인지 못 고르고, 그 묶음을 View 에 넘길 때
    거절당합니다. View 에만 있는 값을 하나 같이 둡니다.
  */
  page: {
    flexDirection: 'column',
    elevation: 0,
    gap: Spacing.s2,
  },
  head: {
    justifyContent: 'center',
    paddingVertical: Spacing.s2,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
    minWidth: 120,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dow: {
    ...Type.micro,
    color: Colors.textMuted,
    paddingVertical: Spacing.s1,
  },
  sun: {
    color: Colors.danger,
  },
  /* 한 칸은 40 입니다 — 손가락이 닿는 44 보다 작지만, 날을 누르는 것은
     목록을 좁히는 곁다리라 여기서는 칸을 촘촘히 두는 편이 낫습니다. */
  dayBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  todayBox: {
    backgroundColor: Colors.fill,
  },
  pickedBox: {
    backgroundColor: Colors.accentSoft,
  },
  day: {
    ...Type.caption,
    ...Tabular,
    color: Colors.text,
  },
  /*
    그날 올린 글 수.

    <p>칸 오른쪽 위입니다. 날짜 아래 가운데는 여행 점이 쓰고 있어서, 숫자를
    그 줄에 같이 두면 점과 한 묶음으로 읽힙니다.

    <p>겹쳐 둡니다({@code position: absolute}) — 흐름에 두면 40 짜리 칸이
    숫자만큼 커지고, 글이 있는 날의 칸만 이웃보다 큽니다.

    <p>{@link Tabular} 를 붙입니다. 1 과 2 의 폭이 다르면 칸마다 숫자가
    조금씩 다른 자리에 섭니다.
  */
  wrote: {
    ...Type.micro,
    ...Tabular,
    position: 'absolute',
    top: 0,
    right: 0,
    color: Colors.textMuted,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: Radius.full,
  },
  /* 정하는 중인 후보. 속을 비워 정해진 여행 점과 가릅니다. */
  pollDot: {
    width: 4,
    height: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  pollMark: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    paddingVertical: Spacing.s3,
    minHeight: 56,
  },
  /* 여행 표식 색 막대. 목록에서 어느 여행인지 색으로 먼저 걸립니다. */
  mark: {
    width: 4,
    height: 32,
    borderRadius: Radius.full,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  /*
    그날 동선이 들어가는 틀.

    <p>비율만 적고 높이는 안 적습니다 — 폭이 얼마든 서버가 그려 주는
    600×320 그대로라, 핀이 잘려 나가지 않습니다.
  */
  route: {
    width: '100%',
    aspectRatio: 600 / 320,
    borderRadius: Radius.r3,
    overflow: 'hidden',
    backgroundColor: Colors.fill,
  },
  routeWait: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeImage: {
    width: '100%',
    height: '100%',
  },
  rowTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
});
