import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { PathTitle } from '@/ui/nav';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { api } from '@/api/client';
import type {
  Day,
  DayRoute,
  Place,
  PlaceInfo,
  PlaceMark,
  RouteLeg,
  TripDetail,
} from '@/api/types';
import { useAsync } from '@/api/use-async';
import { MarkSheet } from '@/components/mark-sheet';
import { PhotoStrip } from '@/components/photo-strip';
import { iconOf } from '@/constants/place-icons';
import { Colors, dayColor, Gutter, Radius, Spacing } from '@/constants/theme';
import { feelTick } from '@/lib/feel';
import { todayIso } from '@/lib/countdown';
import { openDirections } from '@/lib/directions';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Empty,
  ErrorNote,
  Grow,
  Loading,
  Press,
  Row,
  Screen,
  Split,
  Subtitle,
  Title,
} from '@/ui';
import { TripTabs } from '@/ui/tab-bar';

/**
 * 여행 피드 — 사진과 글로 그날을 남기는 자리.
 *
 * <h3>도장첩이었습니다</h3>
 *
 * <p>가운데에 132픽셀짜리 도장이 놓이고 사진은 56픽셀 네모로 그 아래
 * 곁다리로 붙어 있었습니다. 그래서 이 화면에서 하는 일은 <b>체크</b>였고,
 * 남기는 것은 체크를 마무리하는 곁일이었습니다. 대개 아무도 안 남겼습니다.
 *
 * <p>뒤집습니다. 사진과 글이 본문이고 도장은 「갔다 왔다」는 표시입니다 —
 * 표시는 작아도 제 일을 하지만, 남긴 것은 작으면 없는 것과 같습니다.
 *
 * <h3>왜 도장인가</h3>
 *
 * <p>일정 화면은 짜는 곳이라 지도·날짜·카드가 다 열려 있습니다. 길 위에서는
 * 그 전부가 방해입니다. 지금 갈 곳 하나만 크게 놓고, 길찾기와 다녀옴만
 * 남깁니다.
 *
 * <p>그런데 "다녀옴" 을 체크 표시로 두었더니 할 일 목록처럼 읽혔습니다.
 * 여행에서 한 곳을 들르는 것은 처리한 일이 아니라 <b>갔다 온 자리</b> 입니다.
 * 그래서 도장으로 바꿨습니다 — 누르면 위에서 쿵 하고 찍히고, 그 자국이 그
 * 날의 종이에 남습니다.
 *
 * <p>도장은 기울어져 찍힙니다. 반듯하면 아이콘이 되고, 조금 비뚤어야 손으로
 * 찍은 것이 됩니다. 기울기는 장소마다 정해져 있습니다 — 다시 그릴 때마다
 * 달라지면 그때부터는 도장이 아니라 애니메이션이 됩니다.
 */
export default function Travel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data, error, loading, reload } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );

  const days = data?.days ?? [];
  const [dayIndex, setDayIndex] = useState(0);
  const jumped = useRef(false);

  /* 여행 중에 열면 오늘로 맞춥니다. 이 화면은 애초에 그러라고 있는 것입니다. */
  useEffect(() => {
    if (jumped.current || days.length === 0) {
      return;
    }
    jumped.current = true;
    const at = days.findIndex((d) => d.iso === todayIso());
    if (at >= 0) {
      setDayIndex(at);
    }
  }, [days]);

  const day: Day | undefined = days[dayIndex];

  /* 다녀옴은 눌렀을 때 바로 찍고 서버는 뒤따라옵니다. 걸으면서 누르는
     것이라 매번 왕복을 기다리면 손이 멎습니다. */
  const [marks, setMarks] = useState<Set<string> | null>(null);
  const visited = marks ?? new Set(data?.visited ?? []);

  const { data: route } = useAsync<DayRoute | null>(
    (signal) =>
      day
        ? api
            .get<{ route: DayRoute }>(`/api/days/${day.id}/route?mode=TRANSIT`, signal)
            .then((res) => res.route)
        : Promise.resolve(null),
    [day?.id],
  );
  const { data: info } = useAsync<PlaceInfo[]>(
    (signal) =>
      day
        ? api
            .get<{ info: PlaceInfo[] }>(`/api/days/${day.id}/places-info`, signal)
            .then((res) => res.info)
        : Promise.resolve([]),
    [day?.id],
  );

  const legAfter = useMemo(
    () => new Map((route?.legs ?? []).map((leg) => [leg.fromId, leg])),
    [route],
  );
  const infoOf = useMemo(() => new Map((info ?? []).map((i) => [i.id, i])), [info]);
  /* 장소 칸 → 그 자리에 남긴 것. 남긴 것이 있는 곳만 옵니다.

     내 것만 거르지 않습니다 — 기록은 여행의 것이라 멤버면 누구나 같은
     것을 고칩니다. 거르면 남이 올린 사진이 화면에서 사라지고, 그 상태로
     저장하면 서버에서도 떨어집니다. */
  const markOf = useMemo(
    () => new Map((data?.marks ?? []).map((m) => [m.placeId, m])),
    [data],
  );

  /* 다니면서 볼 사진. 이 화면이 바로 「다니면서」라 여기에 꼭 있어야
     합니다 — 메뉴판을 일정 화면에만 두면 가게 앞에서 못 꺼냅니다. */
  const refsOf = useMemo(
    () => new Map((data?.refs ?? []).map((r) => [r.placeId, r.photoIds])),
    [data],
  );

  /* 도장첩에서 누르면 그 장으로 넘어갑니다. 옆으로 스무 번 쓸어 넘기게 할
     일이 아닙니다. */
  const deck = useRef<ScrollView>(null);

  /**
     * 자취를 남기는 판을 열어 둔 곳.
     *
     * <p>찍자마자 엽니다. 여행기의 재료가 여기서 나오는데, 따로 찾아 들어가게
     * 하면 아무도 안 남깁니다 — 도장은 길 위에서 걸으며 누르는 것이고, 그때
     * 한 번 더 들어가라고 하면 그걸로 끝입니다.
     *
     * <p>판은 안 남기고 닫을 수 있습니다. 남기는 것이 도장의 조건은 아닙니다.
     */
  const [marking, setMarking] = useState<Place | null>(null);

  async function toggle(place: Place) {
    const on = visited.has(place.id);
    if (!on) {
      /* 도장이 종이에 닿는 그 순간에 손끝이 울려야 찍힌 느낌이 납니다.
         진동 API 를 쓰고 있었는데 iOS 는 길이를 안 봐서, 톡 한 번을
         바랐던 자리에서 길게 웅웅거렸습니다. */
      feelTick();
    }
    setMarks((prev) => {
      const next = new Set(prev ?? data?.visited ?? []);
      on ? next.delete(place.id) : next.add(place.id);
      return next;
    });
    try {
      on ? await api.delete(`/api/visits/${place.id}`) : await api.put(`/api/visits/${place.id}`);
      if (!on) {
        setMarking(place);
      }
    } catch {
      /* 서버가 못 받았으면 되돌립니다. 안 그러면 다녀온 줄 알고 지나칩니다. */
      setMarks((prev) => {
        const next = new Set(prev ?? []);
        on ? next.add(place.id) : next.delete(place.id);
        return next;
      });
    }
  }

  if (loading && !data) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorNote message={error ?? '그런 여행이 없어요.'} onRetry={reload} />
      </Screen>
    );
  }

  const places = day?.places ?? [];
  const done = places.filter((p) => visited.has(p.id)).length;
  const ink = day?.color || dayColor(dayIndex);
  /* 카드 하나가 화면을 거의 채우되 옆 카드가 살짝 보여야 넘길 수 있다는 것을
     압니다. */
  const cardWidth = Math.min(width - Gutter * 2, 420);

  return (
    /*
      판이 통째로 굴러갑니다.

      <p>카드마다 세로 스크롤을 따로 달았었습니다. 그런데 그것을 담는 자리에
      높이가 안 잡혀 있어서(정지 화면의 속칸은 내용만큼만 큽니다) 안쪽
      스크롤은 굴릴 데가 없었고, 넘치는 만큼 그냥 화면 밖으로 잘렸습니다 —
      <b>사진과 글이 길면 길찾기 단추에 손이 닿지 않았습니다.</b>

      <p>높이를 재서 맞추는 길도 있지만 머리글·날짜 띠·갈래 띠가 다 변수라
      한 번 어긋나면 계속 어긋납니다. 판을 굴리면 그 계산이 통째로 없어집니다.
    */
    <Screen tabs={<TripTabs tripId={id} active="travel" />}>
      <Stack.Screen
        options={{
          title: data.trip.title,
          /* 넷이 모두 여행 이름만 달고 있어서, 지금 보는 것이 일정인지
             여행 중인지는 화면 안을 봐야 알았습니다. */
          headerTitle: () => <PathTitle parent={data.trip.title} title="여행 피드" />,
          headerRight: () => (
            <Button
              label="일정 전체"
              variant="ghost"
              compact
              onPress={() => router.replace({ pathname: '/trip/[id]', params: { id } })}
            />
          ),
        }}
      />

      <View style={styles.head}>
        <Split align="baseline">
          <Title>{day ? day.date || day.label : '날짜 없음'}</Title>
          {places.length > 0 ? (
            <Caption tone={done === places.length ? 'success' : 'muted'} strong>
              {done === places.length ? '이 날 다 다녀왔어요' : `${done}/${places.length} 다녀옴`}
            </Caption>
          ) : null}
        </Split>

        {/*
          길을 다 못 구한 날.

          <p>구간마다 구글에 따로 물어야 해서 한 날에 구하는 수를 막아 두었고
          (RouteService.MAX_LEGS), 넘는 구간은 이동 시간이 안 나옵니다.

          <p>이 말을 안 하면 없는 것이 고장으로 읽힙니다 — 앞쪽 구간에는
          시간이 붙어 있는데 뒤쪽에만 없으니, 더 그렇게 보입니다.
        */}
        {route?.trimmed ? (
          <Caption tone="muted">
            장소가 많아 뒷부분은 이동 시간을 못 구했어요. 길찾기는 그대로 돼요.
          </Caption>
        ) : null}

        {days.length > 1 ? (
          <Row gap={Spacing.xs}>
            {days.map((d, i) => (
              <Chip
                key={d.id}
                label={
                  d.iso === todayIso()
                    ? `오늘 · ${d.date || d.label}`
                    : d.date || d.shortName || d.label
                }
                selected={i === dayIndex}
                onPress={() => setDayIndex(i)}
              />
            ))}
          </Row>
        ) : null}

        {/* 오늘 이 종이가 얼마나 찼는지. 누르면 그 장으로 넘어갑니다. */}
        {places.length > 1 ? (
          <StampBook
            places={places}
            visited={visited}
            ink={ink}
            onJump={(i) =>
              deck.current?.scrollTo({ x: i * (cardWidth + Spacing.md), animated: true })
            }
          />
        ) : null}
      </View>

      {places.length === 0 ? (
        <Empty message="이 날은 아직 비어 있어요." />
      ) : (
        <ScrollView
          ref={deck}
          horizontal
          /* pagingEnabled 는 화면 폭 단위로 넘깁니다. 카드는 그보다 좁아
             (옆 카드가 살짝 보이도록) 한 장씩 넘길수록 어긋납니다. 카드
             한 장 + 사이 간격을 눈금으로 삼아야 딱딱 맞습니다. */
          snapToInterval={cardWidth + Spacing.md}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deck}>
          {places.map((place, i) => (
            <View key={place.id} style={[styles.slot, { width: cardWidth }]}>
              <PlaceCard
                place={place}
                order={i + 1}
                ink={ink}
                visited={visited.has(place.id)}
                mark={markOf.get(place.id)}
                refs={refsOf.get(place.id)}
                onMark={() => setMarking(place)}
                info={infoOf.get(place.id)}
                next={legAfter.get(place.id)}
                onToggle={() => toggle(place)}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <MarkSheet
        place={marking}
        now={marking ? markOf.get(marking.id) : undefined}
        onClose={() => setMarking(null)}
        onSaved={() => {
          setMarking(null);
          reload();
        }}
      />
    </Screen>
  );
}

/**
 * 오늘 이 종이가 얼마나 찼는지.
 *
 * <p>랠리 수첩의 한 면입니다. 빈 자리는 점선 동그라미로 남아 있어서 "몇 개
 * 더 남았다" 가 세지 않고도 보입니다. 카드를 옆으로 넘기는 것만으로는 전체가
 * 안 보입니다.
 */
function StampBook({
  places,
  visited,
  ink,
  onJump,
}: {
  places: Place[];
  visited: Set<string>;
  ink: string;
  onJump: (index: number) => void;
}) {
  return (
    <Row gap={Spacing.xs} style={styles.book}>
      {places.map((place, i) => {
        const on = visited.has(place.id);
        return (
          <Pressable
            key={place.id}
            onPress={() => onJump(i)}
            accessibilityRole="button"
            accessibilityLabel={`${place.name}${on ? ' 다녀옴' : ''}`}
            style={[
              styles.chit,
              {
                borderColor: on ? ink : Colors.border,
                borderStyle: on ? 'solid' : 'dashed',
                backgroundColor: on ? withInk(ink) : 'transparent',
                transform: [{ rotate: on ? `${tilt(place.id) / 2}deg` : '0deg' }],
              },
            ]}>
            {/* 여기는 몇 번째까지 왔는지를 보는 띠입니다. 그림을 찍으면
                열여섯 개가 늘어섰을 때 지금 어디쯤인지 셀 수가 없습니다. */}
            <Body small strong style={{ color: on ? ink : Colors.textDisabled }}>
              {i + 1}
            </Body>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** 지금 갈 곳 하나. 길 위에서 손가락 하나로 쓸 만큼만 둡니다. */
function PlaceCard({
  place,
  order,
  ink,
  visited,
  mark,
  refs,
  onMark,
  info,
  next,
  onToggle,
}: {
  place: Place;
  order: number;
  /** 이 날의 도장 색. */
  ink: string;
  visited: boolean;
  /** 그 자리에 남긴 것. 없으면 아직 안 남긴 것입니다. */
  mark?: PlaceMark;
  /** 다니면서 보려고 챙겨 둔 사진. */
  refs?: string[];
  /** 남기는 판을 엽니다. */
  onMark: () => void;
  info?: PlaceInfo;
  /** 다음 장소까지. 마지막 장소 뒤에는 없습니다. */
  next?: RouteLeg;
  onToggle: () => void;
}) {
  return (
    <Card>
      <Split>
        {place.time ? (
          <Body strong tone="accent">
            {place.time}
          </Body>
        ) : (
          <Caption tone="muted">{order}번째</Caption>
        )}
        {place.cat ? <Caption tone="secondary">{place.cat}</Caption> : null}
      </Split>

      <Subtitle>{place.name}</Subtitle>
      {place.ja || place.en ? <Caption>{place.ja ?? place.en}</Caption> : null}

      {info?.permanentlyClosed ? (
        <Caption tone="danger" strong>
          문을 닫은 곳이에요
        </Caption>
      ) : info?.closedOnDay ? (
        <Caption tone="danger" strong>
          이 날은 휴무예요
        </Caption>
      ) : info && info.spans.length > 0 ? (
        <Caption tone="secondary">
          {info.spans.map((s) => (s.end ? `${s.start}~${s.end}` : `${s.start}~`)).join(' · ')}
        </Caption>
      ) : null}

      {/* 가기 전에 적어 둔 메모. 아래의 글과 다릅니다 — 그쪽은 다녀와서
          남기는 말입니다. */}
      {place.note ? <Body tone="secondary">{place.note}</Body> : null}

      {/*
        다니면서 볼 사진.

        <p>메뉴판, 예매 화면, 가는 길 지도. 여기가 바로 「다니면서」라 이
        화면에 꼭 있어야 합니다 — 일정 화면에만 두면 가게 앞에서 못 꺼냅니다.

        <p>남긴 것보다 <b>위</b>입니다. 이건 들어가기 전에 보는 것이고 아래는
        나온 뒤에 남기는 것이라, 그 순서대로 놓습니다.
      */}
      {refs && refs.length > 0 ? (
        <View style={styles.refs}>
          <Caption tone="muted">챙겨 둔 것</Caption>
          <PhotoStrip ids={refs} height={140} />
        </View>
      ) : null}

      {/*
        본문 — 사진과 글.

        <p>도장 아래에 56픽셀 네모로 붙어 있었습니다. 그 크기로는 무엇이
        찍혔는지 알 수가 없어서 사진이 있으나 없으나 같았고, 그래서 이 화면은
        체크하는 자리로 읽혔습니다.

        <p>도장을 안 찍었어도 냅니다. 전에는 찍은 뒤에만 열렸는데, 남기는
        것이 곧 갔다 왔다는 말입니다 — 올리면 도장은 서버가 함께 찍습니다.
      */}
      <Press
        onPress={onMark}
        scale={0.99}
        accessibilityLabel={
          mark ? `${place.name} 에 남긴 것 고치기` : `${place.name} 에 사진과 글 남기기`
        }>
        {mark ? (
          <View style={styles.feed}>
            <PhotoStrip ids={mark.photoIds} height={260} />
            {mark.note ? <Body>{mark.note}</Body> : null}
            {mark.stars ? <Caption tone="brand">{'★'.repeat(mark.stars)}</Caption> : null}
          </View>
        ) : (
          /* 빈 자리도 자리를 차지합니다. 한 줄짜리 글씨로 두면 무엇을 하는
             자리인지가 안 보이고, 그러면 아무도 안 누릅니다. */
          <View style={styles.empty}>
            <Caption tone="secondary" strong>
              ＋ 사진과 글 남기기
            </Caption>
            <Caption tone="muted">같이 간 사람 모두에게 보여요</Caption>
          </View>
        )}
      </Press>

      {/*
        갔다 왔다는 표시.

        <h3>도장을 걷었습니다</h3>

        <p>132픽셀짜리 그림이 카드 한가운데를 차지했습니다. 이 화면의
        주인공이던 시절의 크기인데, 지금 주인공은 위의 사진과 글입니다. 그
        그림 때문에 카드가 한 화면을 넘겨서 길찾기가 아래로 밀려났습니다.

        <p>표시는 남깁니다 — 아무것도 안 남기고 지나간 곳에도 「갔다 왔다」는
        말할 수 있어야 합니다. 한 줄이면 그 말을 다 합니다.

        <p>찍혀 있으면 한 번 더 눌러 뺍니다. 길게 누르게 두었던 것은 도장이
        크고 잘못 스치기 쉬워서였는데, 단추는 눌러야 눌립니다.
      */}
      <Button
        label={visited ? '✓ 다녀왔어요' : '다녀왔다고 표시'}
        variant={visited ? 'ghost' : 'secondary'}
        compact
        onPress={onToggle}
      />

      <Button
        label="길찾기"
        variant="secondary"
        onPress={() =>
          openDirections(
            { name: place.name, lat: place.lat, lng: place.lng, placeId: place.placeId },
            'TRANSIT',
          )
        }
      />

      {next ? (
        <Caption tone="secondary">
          다음까지{' '}
          {next.reachable
            ? `${Math.max(1, Math.round(next.seconds / 60))}분 · ${
                next.meters < 1000 ? `${next.meters}m` : `${(next.meters / 1000).toFixed(1)}km`
              }`
            : '길을 찾지 못했어요'}
        </Caption>
      ) : null}

      {info ? <Caption tone="muted">영업시간 제공: Google</Caption> : null}
    </Card>
  );
}


/**
 * 도장이 기울어진 각도.
 *
 * <p>반듯하면 아이콘이 되고, 조금 비뚤어야 손으로 찍은 것이 됩니다. 장소
 * 번호에서 뽑으므로 같은 곳은 늘 같은 각도입니다 — 다시 그릴 때마다
 * 달라지면 그때부터는 도장이 아니라 애니메이션입니다.
 */
function tilt(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) {
    n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  }
  /* -9도에서 9도 사이. 더 기울이면 찍다 만 것처럼 보입니다. */
  return ((n % 19) - 9) * 1;
}

/**
 * 잉크가 옅게 밴 자리.
 *
 * <p>날짜 색에 투명도를 얹습니다 — 색을 따로 열여섯 개 만들 일이 아닙니다.
 * 위쪽 띠에서 다녀온 칸을 옅게 칠하는 데 씁니다.
 */
function withInk(color: string) {
  return `${color}14`;
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  /* 본문. 사진과 글이 한 덩어리로 읽히게 붙여 둡니다. */
  feed: {
    gap: Spacing.xs,
  },
  /* 아직 안 남긴 자리. 무엇을 하는 자리인지 보이게 자리를 차지합니다. */
  empty: {
    gap: 2,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  /* 챙겨 둔 것. 본문보다 한 칸 뒤로 물립니다. */
  refs: {
    gap: Spacing.xs,
  },
  book: {
    flexWrap: 'wrap',
  },
  chit: {
    width: 30,
    height: 30,
    borderRadius: 0,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deck: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  slot: {
    flexGrow: 0,
  },
});
