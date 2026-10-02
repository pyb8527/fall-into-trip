import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { OpenDate, TripSummary } from '@/api/types';
import { Colors, Radius, Spacing, Tabular, Type, Weight } from '@/constants/theme';
import { formatSpan, todayIso } from '@/lib/countdown';
import { Caption, Icon, Press, Row } from '@/ui';

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
 */
export function TripCalendar({
  trips,
  onOpen,
  showGroup = false,
  polls = [],
  onPoll,
  onPick,
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
              accessibilityLabel={`${at.month + 1}월 ${d}일${on.length > 0 ? ` 여행 ${on.length}` : ''}`}
              accessibilityState={{ selected: picked === iso }}
              scale={1}
              style={CELL}>
              <View
                style={[
                  styles.dayBox,
                  today ? styles.todayBox : null,
                  picked === iso ? styles.pickedBox : null,
                ]}>
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

      {/* 이 달 목록. 날을 눌러 두면 그날로 좁혀집니다. */}
      {shown.length > 0 ? (
        shown.map((t) => (
          <Press key={t.id} onPress={() => onOpen(t)} scale={1} style={styles.row}>
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
        ))
      ) : picked ? (
        <Caption tone="secondary">이날은 아무것도 없어요.</Caption>
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
  rowTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
});
