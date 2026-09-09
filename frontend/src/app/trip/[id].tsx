import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type {
  Day,
  Gap,
  GapOption,
  LivePin,
  LiveWhere,
  Money,
  Place,
  PlaceInfo,
  TravelMode,
  TripDetail,
} from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { CompanionsSheet } from '@/components/companions-sheet';
import type { RouteLine } from '@/components/map-types';
import { PlaceForm } from '@/components/place-form';
import { PublishForm } from '@/components/publish-form';
import { TipSheet } from '@/components/tip-sheet';
import { TripMap, type MapPlace } from '@/components/trip-map';
import { iconOf } from '@/constants/place-icons';
import { faceOf } from '@/constants/user-marks';
import { openDirections } from '@/lib/directions';
import { useHere } from '@/lib/here';
import { decodePolyline } from '@/lib/polyline';
import { Colors, dayColor, Gutter, Radius, Spacing, Tap } from '@/constants/theme';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Card,
  Chip,
  ConfirmDialog,
  Divider,
  DragSheet,
  Empty,
  ErrorNote,
  Icon,
  IconButton,
  type IconName,
  ListRow,
  Loading,
  Press,
  Row,
  Screen,
  Subtitle,
} from '@/ui';

/** 전체를 보는 상태. 특정 날짜가 아니라는 뜻입니다. */
const ALL = -1;

const MODE_LABEL: Record<TravelMode, string> = {
  WALK: '걸어서',
  TRANSIT: '대중교통',
  DRIVE: '택시·차',
};

/**
 * 일정 화면.
 *
 * <p><b>지도가 화면입니다.</b> 전에는 지도를 위에 260픽셀만 얹고 아래를 목록으로
 * 채웠는데, 그러면 동선을 보기엔 좁고 일정을 훑기엔 위가 잘려 어느 쪽도
 * 넉넉하지 않았습니다. 지도를 화면 전체로 깔고 일정을 그 위에 얹은 판에
 * 담습니다. 판을 내리면 지도가 다 보이고, 올리면 일정이 다 보입니다.
 *
 * <p>이동 수단을 고르는 칩도 없앴습니다. 정작 알고 싶은 것은 "이 구간은 뭘
 * 타야 하나" 이고 그건 셋을 나란히 놓아야만 압니다. 날짜를 펼치면 서버가 세
 * 수단을 한꺼번에 계산해 장소 사이사이에 끼워 넣습니다.
 *
 * <p>지도와 목록이 같은 것을 가리킵니다. 목록에서 장소를 누르면 지도의 핀이
 * 커지고, 핀을 누르면 목록의 그 줄이 켜집니다.
 */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync<TripDetail>(
    (signal) => api.get(`/api/trip?trip=${encodeURIComponent(id)}`, signal),
    [id],
  );

  const [companions, setCompanions] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dropping, setDropping] = useState(false);
  const me = useHere();
  const [activeDay, setActiveDay] = useState<number>(ALL);
  /* 여행 중에 열면 오늘로 맞춰 준 적이 있는지. 한 번만 합니다 — 매번 하면
     다른 날을 골라 놓아도 다시 오늘로 끌려갑니다. */
  const jumped = useRef(false);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  /* 판이 지금 몇 픽셀을 덮고 있는지. 지도가 이것을 알아야 고른 핀을 판에
     가리지 않는 자리에 놓습니다. */
  const [covered, setCovered] = useState(0);
  /* "내 위치로" 를 누른 횟수. 값이 바뀌면 지도가 그리로 갑니다. 자리가 아니라
     "눌렀다" 는 것만 넘겨야 같은 자리를 두 번 눌러도 두 번 다 움직입니다. */
  const [goHereAt, setGoHereAt] = useState(0);
  /** 꽂아 둔 깃발 목록을 열어 두었는지. */
  const [flags, setFlags] = useState(false);
  /** 지도를 옮겨 달라고 가리키는 자리. 일정에 없는 것(깃발)을 볼 때 씁니다. */
  const [lookAt, setLookAt] = useState<{ lat: number; lng: number; at: number } | null>(null);

  /* 방문 표시는 나만 보는 것이라, 서버 응답을 기다리지 않고 먼저 칠합니다.
     걸으면서 누르는 것이라 매번 기다리게 하면 손이 멎습니다. */
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const marks = useMemo(() => visited ?? new Set(data?.visited ?? []), [visited, data?.visited]);

  /* 매 렌더마다 새 배열이 되면 이것을 보는 useMemo·useEffect 가 전부 매번 다시
     돕니다. 서버를 부르는 것이 끼어 있으면 요청이 끝없이 나갑니다. */
  const days = useMemo(() => data?.days ?? [], [data]);

  /**
   * 여행 중이면 오늘을 펼쳐 놓고 시작합니다.
   *
   * <p>길 위에서 열었을 때 궁금한 것은 오늘 어디를 가는지입니다. 여행 기간이
   * 아니면 손대지 않습니다 — 짜는 중일 때는 전체가 보이는 편이 낫습니다.
   */
  useEffect(() => {
    if (jumped.current || days.length === 0) {
      return;
    }
    const index = days.findIndex((d) => d.iso === todayIso());
    jumped.current = true;
    if (index >= 0) {
      setActiveDay(index);
    }
  }, [days]);

  const mapPlaces = useMemo<MapPlace[]>(() => {
    const out: MapPlace[] = [];
    days.forEach((day, di) => {
      if (activeDay !== ALL && di !== activeDay) {
        return;
      }
      day.places.forEach((p, i) => {
        out.push({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          dayIndex: di,
          order: i + 1,
          emoji: iconOf(p.icon),
          color: day.color || dayColor(di),
          fit: p.fit,
          radius: p.radius,
          detail: {
            time: p.time,
            cat: p.cat,
            cost: p.cost,
            note: p.note,
            sub: p.ja ?? p.en,
            dayLabel: day.label,
            visited: marks.has(p.id),
          },
        });
      });
    });
    return out;
  }, [days, activeDay, marks]);

  const toggle = useCallback(
    async (placeId: string) => {
      const was = marks.has(placeId);
      const next = new Set(marks);
      if (was) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      setVisited(next);
      setActionError(null);
      setPending((p) => new Set(p).add(placeId));

      try {
        if (was) {
          await api.delete(`/api/visits/${placeId}`);
        } else {
          await api.put(`/api/visits/${placeId}`);
        }
      } catch (e) {
        setVisited(marks);
        setActionError(e instanceof ApiError ? e.message : '표시하지 못했습니다.');
      } finally {
        setPending((p) => {
          const copy = new Set(p);
          copy.delete(placeId);
          return copy;
        });
      }
    },
    [marks],
  );

  const refresh = useCallback(() => {
    setVisited(null);
    reload();
  }, [reload]);

  const remove = useCallback(
    async (placeId: string) => {
      setActionError(null);
      try {
        await api.delete(`/api/places/${placeId}`);
        refresh();
      } catch (e) {
        setActionError(e instanceof ApiError ? e.message : '지우지 못했습니다.');
      }
    },
    [refresh],
  );

  /*
    보고 있는 날짜.

    하루짜리 여행에서는 날짜를 고르는 칩 자체가 뜨지 않아 늘 "전체" 로 남습니다.
    날이 하나뿐이면 전체가 곧 그 날이므로 고른 것으로 봅니다.
  */
  const dayIndex = activeDay === ALL ? (days.length === 1 ? 0 : -1) : activeDay;
  const dayId = dayIndex >= 0 ? (days[dayIndex]?.id ?? null) : null;

  /*
    사이사이 이동 — 세 수단을 한꺼번에.

    "전체" 를 보고 있을 때는 부르지 않습니다. 날짜 수만큼, 구간마다, 수단마다
    구글에 묻게 되어 요금이 감당이 안 됩니다. 한 날을 펼쳤을 때만입니다.
  */
  const {
    data: gaps,
    loading: gapping,
    error: gapError,
  } = useAsync<Gap[]>(
    (signal) =>
      dayId
        ? api.get<{ gaps: Gap[] }>(`/api/days/${dayId}/route/compare`, signal).then((r) => r.gaps)
        : Promise.resolve([]),
    [dayId],
  );

  /**
   * 구간마다 어느 수단으로 볼지.
   *
   * <p>비워 두면 가장 빠른 것입니다. 사람이 한 구간을 눌러 바꾸면 그 구간만
   * 기억합니다 — 하나 바꿨다고 나머지까지 따라 바뀌면 방금 본 것을 잃습니다.
   */
  const [picked, setPicked] = useState<Record<string, TravelMode>>({});
  useEffect(() => {
    /* 날짜를 옮기면 고른 것을 비웁니다. 다른 날의 구간에는 뜻이 없습니다. */
    setPicked({});
  }, [dayId]);

  const chosenOf = useCallback(
    (gap: Gap): GapOption | null => {
      const want = picked[gap.fromId] ?? gap.fastest;
      return gap.options.find((o) => o.mode === want) ?? gap.options[0] ?? null;
    },
    [picked],
  );

  /** 고른 수단의 길만 지도에 그립니다. 셋을 다 그리면 어느 것이 진짜인지 모릅니다. */
  const routeLines = useMemo<RouteLine[]>(() => {
    if (dayIndex < 0) {
      return [];
    }
    const color = days[dayIndex]?.color || dayColor(dayIndex);
    const out: RouteLine[] = [];
    for (const gap of gaps ?? []) {
      const option = chosenOf(gap);
      if (option?.polyline) {
        out.push({
          id: `${gap.fromId}-${gap.toId}`,
          color,
          points: decodePolyline(option.polyline),
        });
      }
    }
    return out;
  }, [gaps, chosenOf, dayIndex, days]);

  const gapAfter = useMemo(() => new Map((gaps ?? []).map((g) => [g.fromId, g])), [gaps]);

  /*
    이 날 장소들이 언제 문을 여는지. 월요일 휴관을 모르고 갔다가 하루를 날리는
    일이 흔합니다.
  */
  const { data: placeInfo } = useAsync<PlaceInfo[]>(
    (signal) =>
      dayId
        ? api
            .get<{ info: PlaceInfo[] }>(`/api/days/${dayId}/places-info`, signal)
            .then((res) => res.info)
        : Promise.resolve([]),
    [dayId],
  );
  const infoOf = useMemo(() => new Map((placeInfo ?? []).map((i) => [i.id, i])), [placeInfo]);

  /*
    이 날 장소들에 달린 한 줄 팁이 몇 개인지. 장소마다 물으면 그 수만큼 요청이
    나갑니다. 번호가 있는 것만 모아 한 번에 셉니다.
  */
  const [tipCounts, setTipCounts] = useState<Record<string, number>>({});
  const dayPlaceIds = useMemo(
    () =>
      days
        .filter((_, i) => activeDay === ALL || i === activeDay)
        .flatMap((d) => d.places)
        .map((p) => p.placeId)
        .filter((pid): pid is string => !!pid),
    [days, activeDay],
  );

  const countTips = useCallback(() => {
    if (dayPlaceIds.length === 0) {
      setTipCounts({});
      return;
    }
    api
      .post<{ counts: Record<string, number> }>('/api/tips/counts', { placeIds: dayPlaceIds })
      .then((res) => setTipCounts(res.counts))
      .catch(() => {
        /* 팁은 곁다리라 못 세어도 일정은 보여야 합니다. */
      });
  }, [dayPlaceIds]);

  useEffect(countTips, [countTips]);

  /*
    자유시간에 서로 찾기 — 켜 둔 동행자와 잠깐 찍어 둔 핀.

    내 자리는 서버를 거치지 않고 기기 것을 그대로 씁니다. 서버를 돌아오면 한
    박자 늦은 자리가 보입니다.
  */
  const [mates, setMates] = useState<LiveWhere[]>([]);
  const [sharing, setSharing] = useState(false);
  const [pins, setPins] = useState<LivePin[]>([]);

  const pullLive = useCallback(() => {
    api
      .get<{ people: LiveWhere[]; sharing: boolean }>(`/api/trips/${id}/locations`)
      .then((res) => {
        setMates(res.people);
        setSharing(res.sharing);
      })
      .catch(() => {
        /* 곁다리라 못 받아도 일정은 보여야 합니다. */
      });
    api
      .get<{ pins: LivePin[] }>(`/api/trips/${id}/pins`)
      .then((res) => setPins(res.pins))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    pullLive();
    if (!sharing) {
      return;
    }
    const timer = setInterval(pullLive, 20_000);
    return () => clearInterval(timer);
  }, [pullLive, sharing]);

  /* 자리는 소수 넷째 자리(십여 미터)까지만 봅니다. 그보다 잘게 보면 가만히
     서 있어도 값이 떨려 계속 보냅니다. */
  const herePoint = me.here ? `${me.here.lat.toFixed(4)},${me.here.lng.toFixed(4)}` : null;

  /* 켜서 처음 자리가 잡히면 그리로 옮겨 줍니다. 켰는데 지도가 딴 데를 보고
     있으면 켠 보람이 없습니다. 그 뒤로는 따라다니지 않습니다 — 걸을 때마다
     지도가 끌려가면 다른 곳을 볼 수가 없습니다. */
  const arrived = useRef(false);
  useEffect(() => {
    if (!me.watching) {
      arrived.current = false;
      return;
    }
    if (herePoint && !arrived.current) {
      arrived.current = true;
      setGoHereAt((n) => n + 1);
    }
  }, [me.watching, herePoint]);
  useEffect(() => {
    if (!sharing || !herePoint || !me.here) {
      return;
    }
    api
      .put(`/api/trips/${id}/location`, {
        lat: me.here.lat,
        lng: me.here.lng,
        accuracy: me.here.accuracy,
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, herePoint, id]);

  async function toggleSharing() {
    setActionError(null);
    try {
      if (sharing) {
        await api.delete(`/api/trips/${id}/location`);
        setSharing(false);
      } else if (me.here) {
        await api.put(`/api/trips/${id}/location`, {
          lat: me.here.lat,
          lng: me.here.lng,
          accuracy: me.here.accuracy,
        });
        setSharing(true);
      }
      pullLive();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '바꾸지 못했습니다.');
    }
  }

  /**
   * 내 위치를 끕니다.
   *
   * <p>동행자에게 알리는 중이었다면 그것도 함께 끕니다. 점만 지우고 두면 동행자
   * 화면에는 마지막 자리가 그대로 남아, 지금 거기 있는 것처럼 보입니다.
   */
  async function stopLive() {
    if (sharing) {
      await api.delete(`/api/trips/${id}/location`).catch(() => {});
      setSharing(false);
    }
    me.stop();
    pullLive();
  }

  /**
   * 찍어 둔 것을 뺍니다.
   *
   * <p>서버는 자기가 찍은 것만 빼게 합니다. 남이 찍어 둔 것을 치워 버리면
   * 그 사람은 왜 사라졌는지 알 수가 없습니다.
   */
  async function pullPin(pinId: string) {
    setActionError(null);
    try {
      await api.delete(`/api/pins/${pinId}`);
      pullLive();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '빼지 못했습니다.');
    }
  }

  /** 지금 자리에 "여기 있다" 를 찍어 둡니다. */
  async function dropPin() {
    if (!me.here) {
      return;
    }
    setActionError(null);
    try {
      await api.post(`/api/trips/${id}/pins`, { lat: me.here.lat, lng: me.here.lng });
      pullLive();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '찍지 못했습니다.');
    }
  }

  /** 한 줄을 열어 둔 장소. */
  const [tipFor, setTipFor] = useState<Place | null>(null);

  if (loading && !data) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <ErrorNote message={error} onRetry={reload} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Empty message="여행을 찾지 못했습니다." />
      </Screen>
    );
  }

  const canEdit = data.myRole === 'EDITOR';
  const shown = activeDay === ALL ? days : days.filter((_, i) => i === activeDay);
  const total = shown.reduce((n, d) => n + d.places.length, 0);
  const done = shown.reduce((n, d) => n + d.places.filter((p) => marks.has(p.id)).length, 0);
  const mine = data.trip.ownerId === user?.id;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: data.trip.title,
          /*
            막대를 비쳐 두었더니 여행 이름이 지도 무늬 위에 그냥 얹혀 읽히지
            않았습니다. 지도 위에 떠 있는 동그란 단추와 맨 글자 제목이 나란히
            서서 어느 쪽도 아닌 모양이 되기도 했습니다.

            평범한 막대로 되돌립니다. 지도는 그 아래부터 화면 끝까지 채우므로
            잃는 것은 막대 높이만큼뿐입니다.
          */
          headerLeft: navigation.canGoBack()
            ? undefined
            : () => (
                <IconButton
                  name="chevron-left"
                  label="내 여행으로"
                  bare
                  onPress={() => router.replace('/(app)/trips')}
                />
              ),
          /* 길 위에서 가장 자주 여는 하나만 둡니다. 나머지는 판 안에 글자로
             있습니다 — 그림만 늘어놓으면 눌러 보기 전에는 뜻을 모릅니다. */
          headerRight: () => (
            <IconButton name="users" label="동행자" bare onPress={() => setCompanions(true)} />
          ),
        }}
      />

      {/* 지도가 바탕입니다. 판이 그 위에 얹힙니다. */}
      <TripMap
        places={mapPlaces}
        activeId={activePlaceId}
        onSelect={setActivePlaceId}
        routes={routeLines}
        here={me.here}
        mates={mates.map((m) => ({
          id: m.userId,
          name: m.name,
          face: faceOf(m.mark, m.name),
          lat: m.lat,
          lng: m.lng,
        }))}
        myFace={faceOf(user?.mark, user?.name ?? '나')}
        notes={pins.map((p) => ({ id: p.id, label: p.label ?? null, lat: p.lat, lng: p.lng }))}
        bleed
        chrome={false}
        bottomInset={covered}
        goHereAt={goHereAt}
        panTo={lookAt}
      />

      {/* 막대 바로 아래, 지도 위에 뜨는 날짜 칩. */}
      {days.length > 1 ? (
        /* 폰에서는 날짜가 넷만 돼도 칩이 두 줄, 세 줄로 접혀 지도를 덮습니다.
           접지 않고 옆으로 흐르게 둡니다. */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          /* 막대를 되돌리면서 지도가 그 아래부터 시작하는데, 띠는 아직
             안전영역과 막대 높이만큼 더 내려가 있었습니다. 이제 지도 맨
             위에서 조금만 띄웁니다. */
          style={[styles.floatTop, { top: Spacing.md }]}
          contentContainerStyle={styles.chipRail}>
          <Row gap={Spacing.xs} style={styles.chipRow}>
            <Chip
              label="전체"
              selected={activeDay === ALL}
              onPress={() => {
                setActiveDay(ALL);
                setActivePlaceId(null);
              }}
            />
            {days.map((day, i) => (
              <Chip
                key={day.id}
                label={
                  day.iso === todayIso()
                    ? `오늘 · ${day.date || day.shortName || day.label}`
                    : day.date || day.shortName || day.label
                }
                selected={activeDay === i}
                onPress={() => {
                  setActiveDay(i);
                  setActivePlaceId(null);
                }}
              />
            ))}
          </Row>
        </ScrollView>
      ) : null}

      {/*
        내 위치. 지도에 딸린 일이라 지도 위에 둡니다.

        한 기둥으로 세로로 세웁니다. 여기저기 흩어 두면 무엇이 지도에 대한
        단추이고 무엇이 화면에 대한 단추인지 구별되지 않습니다. 날짜 띠
        바로 아래에서 시작해, 띠와 왼쪽 여백을 맞춥니다.
      */}
      {/*
        지도 위에는 내 위치 하나만 둡니다.

        전에는 누르면 동그란 단추 넷이 세로로 펼쳐졌습니다. 글자가 없어 X 가
        무엇인지, 사람 모양이 무엇인지 눌러 보기 전에는 알 수 없었고, 그중
        하나는 내가 어디 있는지를 남에게 알리는 것이라 아무 표시 없이 둘
        일이 아니었습니다.

        지도 단추는 지도를 움직이는 것만 맡습니다. 나머지는 말로 설명할
        자리가 있는 판 안으로 내렸습니다.
      */}
      {me.supported ? (
        <View style={[styles.floatRight, { bottom: covered + Spacing.md }]}>
          <IconButton
            name="crosshair"
            label={me.watching ? '내 위치로' : '내 위치 보기'}
            active={me.watching}
            tone="accent"
            onMap
            /* 한 번 누르면 켜지면서 그리로 가고, 한 번 더 누르면 꺼집니다.
               끄는 단추를 따로 두면 지도 위에 단추가 또 하나 늘어납니다. */
            onPress={() => (me.watching ? stopLive() : me.start())}
          />
        </View>
      ) : null}

      {/*
        꽂아 둔 깃발.

        전에는 판 안에 "여기 · 누가 찍음" 을 줄줄이 늘어놓았습니다. 대개 한둘
        뿐이고 여섯 시간이면 사라지는 것이라, 일정을 보는 내내 자리를 차지할
        만한 것이 아닙니다. 단추 하나로 접어 두고 눌렀을 때만 펼칩니다.
      */}
      {pins.length > 0 ? (
        <View style={[styles.floatLeft, { bottom: covered + Spacing.md }]}>
          <IconButton
            name="flag"
            label={`꽂아 둔 깃발 ${pins.length}개 보기`}
            tone="accent"
            active
            onMap
            onPress={() => setFlags(true)}
          />
        </View>
      ) : null}

      <DragSheet
        onHeightChange={setCovered}
        peek={
          <SheetHead
            title={dayIndex >= 0 ? days[dayIndex]?.date || days[dayIndex]?.label || '' : '전체 일정'}
            done={done}
            total={total}
            gaps={gaps}
            gapping={gapping}
            chosenOf={chosenOf}
          />
        }>
        {actionError ? <ErrorNote message={actionError} /> : null}
        {gapError && dayId ? <Caption tone="danger">{gapError}</Caption> : null}
        {me.error ? <Caption tone="danger">{me.error}</Caption> : null}

        {/*
          내 위치로 하는 일들.

          지도 위에 동그란 단추로 두었더니 무엇인지 알 수 없었습니다. 특히
          "동행자에게 알리기" 는 내가 어디 있는지가 남에게 가는 일이라, 그림
          하나로 둘 것이 아닙니다. 켜 두었을 때만 글자로 펼칩니다.
        */}
        {me.supported && me.watching ? (
          <View style={styles.live}>
            <Row gap={Spacing.xs}>
              {/* 켜져 있을 때만 색이 찹니다. 반대로 두었더니 켜지도 않았는데
                  이미 공유 중인 것처럼 보였습니다. */}
              <Button
                label={sharing ? '내 위치 공유 중 · 끄기' : '내 위치 공유'}
                variant={sharing ? 'primary' : 'secondary'}
                compact
                onPress={toggleSharing}
              />
              {/* 지금 서 있는 자리에 꽂아 두는 깃발. 동행자에게 "나 여기"
                  라고 알리는 표시입니다. */}
              <IconButton
                name="flag"
                label="여기 있다고 깃발 꽂기"
                tone="accent"
                onPress={dropPin}
              />
            </Row>
            {sharing ? (
              <Caption tone="success" strong>
                지금 어디 있는지가 동행자에게 보입니다. 네 시간 뒤 저절로 꺼지고,
                지나온 자리는 남지 않습니다.
              </Caption>
            ) : null}
          </View>
        ) : null}

        {/* 지도에 찍힌 그림과 이름을 짝지어 둡니다. 그림만 보고는 누구인지
            알 수 없고, 이름만 적으면 지도에서 찾을 수가 없습니다. */}
        {mates.length > 0 ? (
          <Caption tone="secondary">
            지금 {mates.map((m) => `${faceOf(m.mark, m.name)} ${m.name}`).join(' · ')} 님이 지도에
            보입니다.
          </Caption>
        ) : null}



        {/*
          가끔 쓰는 것들.

          맨 아래에 두었더니 날짜가 여럿인 여행에서는 한참 굴려야 닿아서, 있는
          줄도 모르고 지나갔습니다. 판을 열면 바로 보이는 자리로 올립니다.
        */}
        <Row gap={Spacing.xs} style={styles.shortcuts}>
          {/* 길 위에서는 짜는 화면이 방해입니다. 지금 갈 곳만 크게 보는 쪽으로
              넘어갑니다. */}
          <Shortcut
            icon="check"
            label="스탬프 찍기"
            onPress={() => router.push({ pathname: '/travel/[id]', params: { id } })}
          />
          {/* 아직 정하지 않은 곳은 일정이 아니라 여기에 모입니다. */}
          <Shortcut
            icon="star"
            label="투표장"
            onPress={() => router.push({ pathname: '/vote/[id]', params: { id } })}
          />
          <Shortcut
            icon="bookmark"
            label="추억"
            onPress={() => router.push({ pathname: '/card/[id]', params: { id } })}
          />
          {/* 올리는 것은 주인만 할 수 있습니다. 서버도 그렇게 막습니다. */}
          {mine ? (
            <Shortcut icon="upload" label="포스팅" onPress={() => setPublishing(true)} />
          ) : null}
        </Row>

        {days.length === 0 ? <Empty message="아직 날짜가 없습니다." /> : null}

        {days.map((day, di) =>
          activeDay === ALL || activeDay === di ? (
            <DayCard
              key={day.id}
              day={day}
              index={di}
              visited={marks}
              pending={pending}
              canEdit={canEdit}
              activePlaceId={activePlaceId}
              onToggle={toggle}
              onFocus={setActivePlaceId}
              onChanged={refresh}
              onRemove={remove}
              gapAfter={gapAfter}
              chosenOf={chosenOf}
              onPick={(fromId, mode) => setPicked((p) => ({ ...p, [fromId]: mode }))}
              infoOf={infoOf}
              tipCounts={tipCounts}
              onTips={setTipFor}
            />
          ) : null,
        )}

        {/* 되돌릴 수 없는 일이라 맨 아래, 손이 잘 닿지 않는 자리에 둡니다. */}
        {mine ? (
          <>
            <Divider />
            <Button label="여행 지우기" variant="danger" onPress={() => setDropping(true)} />
          </>
        ) : null}
      </DragSheet>

      <BottomSheet visible={flags} title="꽂아 둔 깃발" onClose={() => setFlags(false)}>
        <Caption tone="secondary">
          여섯 시간 뒤 저절로 사라집니다. 누르면 지도가 그 자리로 갑니다.
        </Caption>
        {pins.map((pin) => (
          <Row key={pin.id} style={styles.pinRow}>
            <View style={styles.grow}>
              <ListRow
                title={pin.label || (pin.mine ? '내가 꽂은 곳' : `${pin.authorName} 님이 꽂은 곳`)}
                subtitle={pin.mine ? '내가 꽂음' : `${pin.authorName} 님`}
                onPress={() => {
                  setFlags(false);
                  setLookAt({ lat: pin.lat, lng: pin.lng, at: Date.now() });
                }}
              />
            </View>
            {/* 내가 꽂은 것만 뺍니다. 남이 꽂아 둔 것을 치우면 그 사람은 왜
                사라졌는지 알 수가 없습니다. */}
            {pin.mine ? (
              <IconButton
                name="trash-2"
                label="이 깃발 빼기"
                tone="danger"
                onPress={() => pullPin(pin.id)}
              />
            ) : null}
          </Row>
        ))}
      </BottomSheet>

      <CompanionsSheet
        visible={companions}
        tripId={data.trip.id}
        ownerId={data.trip.ownerId}
        onClose={() => setCompanions(false)}
        onLeft={() => router.replace('/(app)/trips')}
      />

      <PublishForm
        visible={publishing}
        tripId={data.trip.id}
        tripTitle={data.trip.title}
        onCancel={() => setPublishing(false)}
        onDone={(postId) => {
          setPublishing(false);
          router.push({ pathname: '/community/[id]', params: { id: postId } });
        }}
      />

      {tipFor?.placeId ? (
        <TipSheet
          visible
          placeId={tipFor.placeId}
          placeName={tipFor.name}
          onClose={() => setTipFor(null)}
          onChanged={countTips}
        />
      ) : null}

      <ConfirmDialog
        visible={dropping}
        title="이 여행을 지울까요?"
        message="날짜와 장소가 모두 사라집니다. 동행자도 더 볼 수 없게 됩니다. 되돌릴 수 없습니다."
        confirmLabel="지우기"
        danger
        onCancel={() => setDropping(false)}
        onConfirm={async () => {
          setDropping(false);
          try {
            await api.delete(`/api/trips/${data.trip.id}`);
            router.replace('/(app)/trips');
          } catch (e) {
            setActionError(e instanceof ApiError ? e.message : '지우지 못했습니다.');
          }
        }}
      />
    </View>
  );
}

/**
 * 이 여행으로 갈 수 있는 다른 화면들.
 *
 * <p>작은 글자 단추를 한 줄에 늘어놓았더니 무엇을 하는 것인지도, 어디까지가
 * 한 덩어리인지도 읽히지 않았습니다. 그림 아래 짧은 말을 두면 훑는 것만으로
 * 무엇이 있는지 압니다.
 *
 * <p>말은 짧게 자릅니다. "여행 중 화면" 처럼 화면 이름을 그대로 쓰면, 그것이
 * 무엇을 보여 주는 곳인지가 아니라 우리가 붙인 이름을 읽게 됩니다.
 */
function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} scale={0.95} accessibilityLabel={label} style={styles.shortcut}>
      <Icon name={icon} size={20} tone="accent" />
      <Caption tone="secondary" numberOfLines={2}>
        {label}
      </Caption>
    </Press>
  );
}

/**
 * 판 맨 위에 늘 보이는 줄.
 *
 * <p>판을 내려 두어도 이것만은 보입니다. 그래서 여기에는 "지금 어느 날을 보고
 * 있고, 얼마나 돌았고, 오늘 이동에 얼마나 쓰는지" 만 둡니다. 판을 올리지 않고도
 * 답이 되는 것들입니다.
 */
function SheetHead({
  title,
  done,
  total,
  gaps,
  gapping,
  chosenOf,
}: {
  title: string;
  done: number;
  total: number;
  gaps: Gap[] | null;
  gapping: boolean;
  chosenOf: (gap: Gap) => GapOption | null;
}) {
  const ratio = total === 0 ? 0 : done / total;
  const moving = (gaps ?? []).reduce((n, g) => n + (chosenOf(g)?.seconds ?? 0), 0);

  return (
    <View style={styles.head}>
      <Row style={styles.headTop}>
        <Subtitle>{title}</Subtitle>
        <Caption tone={total > 0 && done === total ? 'success' : 'secondary'} strong>
          {done} / {total} 다녀옴
        </Caption>
      </Row>

      {total > 0 ? (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(ratio * 100)}%`,
                backgroundColor: done === total ? Colors.success : Colors.accent,
              },
            ]}
          />
        </View>
      ) : null}

      {gapping ? (
        <Caption tone="secondary">이동 시간을 알아보는 중…</Caption>
      ) : moving > 0 ? (
        <Caption tone="secondary">오늘 이동에 {asDuration(moving)}</Caption>
      ) : null}
    </View>
  );
}

function DayCard({
  day,
  index,
  visited,
  pending,
  canEdit,
  activePlaceId,
  onToggle,
  onFocus,
  onChanged,
  onRemove,
  gapAfter,
  chosenOf,
  onPick,
  infoOf,
  tipCounts,
  onTips,
}: {
  day: Day;
  index: number;
  visited: Set<string>;
  pending: Set<string>;
  canEdit: boolean;
  activePlaceId: string | null;
  onToggle: (placeId: string) => void;
  onFocus: (placeId: string) => void;
  onChanged: () => void;
  onRemove: (placeId: string) => void;
  /** 이 장소를 떠나 다음 장소로 가는 구간. "전체" 를 볼 때는 비어 있습니다. */
  gapAfter: Map<string, Gap>;
  chosenOf: (gap: Gap) => GapOption | null;
  onPick: (fromId: string, mode: TravelMode) => void;
  /** 장소별 영업시간 등. 좌표만 직접 넣은 곳에는 없습니다. */
  infoOf: Map<string, PlaceInfo>;
  /** 구글 번호별 최근 팁 수. */
  tipCounts: Record<string, number>;
  onTips: (place: Place) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Place | null>(null);
  const [folded, setFolded] = useState(false);

  /*
    끌어서 옮기기.

    화살표 둘을 장소마다 두고 있었습니다. 헷갈리지는 않지만 한 칸씩만
    움직이고, 무엇보다 장소마다 단추가 둘씩 늘 서 있어 목록이 단추밭이
    됩니다. 손잡이 하나를 잡고 끌면 한 번에 원하는 자리로 갑니다.

    손잡이에만 손짓을 겁니다. 줄 전체를 잡게 하면 목록을 굴리려는 것과
    다투어, 굴리려다 장소가 옮겨집니다.

    화면에 보이는 순서는 여기서 먼저 바꾸고 서버는 뒤따라옵니다. 왕복을
    기다렸다가 제자리로 돌아왔다 다시 가면 손이 미끄러진 것처럼 보입니다.
  */
  const [order, setOrder] = useState<Place[]>(day.places);
  useEffect(() => setOrder(day.places), [day.places]);

  /** 줄마다의 높이. 어디로 끌었는지는 이것으로만 알 수 있습니다. */
  const heights = useRef<number[]>([]);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const shift = useRef(new Animated.Value(0)).current;
  const toRef = useRef<number | null>(null);

  /** 끌고 있는 줄의 한가운데가 지금 어느 줄의 한가운데에 가장 가까운지. */
  function landingOf(start: number, dy: number) {
    const h = heights.current;
    const tops: number[] = [];
    let acc = 0;
    for (let i = 0; i < order.length; i++) {
      tops.push(acc);
      acc += h[i] ?? 0;
    }
    const center = tops[start] + (h[start] ?? 0) / 2 + dy;
    let best = start;
    let near = Infinity;
    for (let i = 0; i < order.length; i++) {
      const gap = Math.abs(tops[i] + (h[i] ?? 0) / 2 - center);
      if (gap < near) {
        near = gap;
        best = i;
      }
    }
    return best;
  }

  async function land(start: number, end: number) {
    const next = [...order];
    const [moved] = next.splice(start, 1);
    next.splice(end, 0, moved);
    setOrder(next);
    try {
      await api.post('/api/places/reorder', {
        dayId: day.id,
        placeIds: next.map((p) => p.id),
      });
      onChanged();
    } catch {
      /* 서버가 못 받았으면 되돌립니다. 화면만 바뀐 채로 두면 다음에 열 때
         순서가 슬쩍 되돌아가 있습니다. */
      setOrder(day.places);
    }
  }

  const done = day.places.filter((p) => visited.has(p.id)).length;
  const color = day.color || dayColor(index);

  return (
    <Card>
      <Row style={styles.dayHeader}>
        <Pressable
          onPress={() => setFolded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`${day.date || day.label} ${folded ? '펴기' : '접기'}`}
          style={styles.dayTap}>
          <Row gap={Spacing.md} style={styles.dayTitle}>
            <View style={[styles.dayDot, { backgroundColor: color }]} />
            <Subtitle>{day.date || day.label}</Subtitle>
            <Icon name={folded ? 'chevron-down' : 'chevron-up'} size={16} tone="muted" />
          </Row>
        </Pressable>

        <Row gap={Spacing.sm}>
          {day.places.length > 0 ? (
            <Caption tone={done === day.places.length ? 'success' : 'muted'} strong>
              {done}/{day.places.length}
            </Caption>
          ) : null}
          {canEdit ? (
            <IconButton
              name="plus"
              label={`${day.date || day.label}에 장소 넣기`}
              onPress={() => {
                setFolded(false);
                setAdding(true);
              }}
            />
          ) : null}
        </Row>
      </Row>

      {folded ? null : (
        <>
          {day.theme ? (
            <Body small tone="secondary">
              {day.theme}
            </Body>
          ) : null}

          {day.places.length === 0 ? (
            <Caption>이 날에는 아직 장소가 없습니다.</Caption>
          ) : (
            <View style={styles.places}>
              {order.map((place, i) => (
                <Animated.View
                  key={place.id}
                  onLayout={(e) => {
                    heights.current[i] = e.nativeEvent.layout.height;
                  }}
                  style={
                    from === i
                      ? [styles.lifted, { transform: [{ translateY: shift }] }]
                      : undefined
                  }>
                  {/* 여기로 들어간다는 표시. 끌고 있는 동안만 뜹니다. */}
                  {from !== null && to === i && to !== from ? (
                    <View style={[styles.landing, { backgroundColor: Colors.accent }]} />
                  ) : null}
                  <PlaceRow
                    place={place}
                    order={i + 1}
                    color={color}
                    visited={visited.has(place.id)}
                    busy={pending.has(place.id)}
                    active={activePlaceId === place.id}
                    canEdit={canEdit}
                    onToggle={() => onToggle(place.id)}
                    onFocus={() => onFocus(place.id)}
                    onEdit={() => setEditing(place)}
                    onRemove={() => onRemove(place.id)}
                    info={infoOf.get(place.id)}
                    tipCount={place.placeId ? (tipCounts[place.placeId] ?? 0) : 0}
                    onTips={() => onTips(place)}
                    dragging={from === i}
                    index={i}
                    onDragStart={(at) => {
                      setFrom(at);
                      setTo(at);
                      toRef.current = at;
                      shift.setValue(0);
                    }}
                    onDragMove={(at, dy) => {
                      shift.setValue(dy);
                      const next = landingOf(at, dy);
                      if (next !== toRef.current) {
                        toRef.current = next;
                        setTo(next);
                      }
                    }}
                    onDragEnd={(at) => {
                      const end = toRef.current ?? at;
                      setFrom(null);
                      setTo(null);
                      shift.setValue(0);
                      if (end !== at) {
                        land(at, end);
                      }
                    }}
                    gap={gapAfter.get(place.id)}
                    chosenOf={chosenOf}
                    onPick={onPick}
                  />
                </Animated.View>
              ))}
            </View>
          )}

          {/* 영업시간과 평점은 구글에서 온 것이라 어디서 왔는지 밝혀야 합니다.
              약관 의무라 지우면 안 됩니다. */}
          {day.places.some((p) => infoOf.has(p.id)) ? (
            <Caption tone="muted">영업시간 · 평점 제공: Google</Caption>
          ) : null}

          {day.budget ? <Caption tone="secondary">예산 {day.budget}</Caption> : null}
        </>
      )}

      <PlaceForm
        visible={adding}
        dayId={day.id}
        onDone={() => {
          setAdding(false);
          onChanged();
        }}
        onCancel={() => setAdding(false)}
      />
      {editing ? (
        <PlaceForm
          visible
          dayId={day.id}
          place={editing}
          onDone={() => {
            setEditing(null);
            onChanged();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}

function PlaceRow({
  place,
  order,
  color,
  visited,
  busy,
  active,
  canEdit,
  info,
  tipCount,
  onTips,
  dragging,
  index,
  onDragStart,
  onDragMove,
  onDragEnd,
  onToggle,
  onFocus,
  onEdit,
  onRemove,
  gap,
  chosenOf,
  onPick,
}: {
  place: Place;
  order: number;
  color: string;
  visited: boolean;
  busy: boolean;
  active: boolean;
  canEdit: boolean;
  info?: PlaceInfo;
  tipCount: number;
  onTips: () => void;
  /** 지금 이 줄을 끌고 있는지. 끌고 있는 동안에는 조금 들어 올립니다. */
  dragging: boolean;
  index: number;
  onDragStart: (index: number) => void;
  onDragMove: (index: number, dy: number) => void;
  onDragEnd: (index: number) => void;
  onToggle: () => void;
  onFocus: () => void;
  onEdit: () => void;
  onRemove: () => void;
  /** 다음 장소까지의 이동. 마지막 장소 뒤에는 없습니다. */
  gap?: Gap;
  chosenOf: (gap: Gap) => GapOption | null;
  onPick: (fromId: string, mode: TravelMode) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const emoji = iconOf(place.icon);
  const chosen = gap ? chosenOf(gap) : null;

  return (
    <View>
      <View
        style={[
          styles.place,
          {
            backgroundColor: active ? Colors.accentSoft : Colors.surfaceRaised,
            opacity: busy ? 0.6 : 1,
          },
          active && { borderColor: Colors.accent },
        ]}>
        {/*
          손잡이를 누르는 자리 <b>밖</b>에 둡니다.

          안에 넣어 두었더니 끌리지 않았습니다. 손이 닿는 순간 바깥의 누름
          자리가 먼저 손짓을 가져가 버려서, 손잡이는 움직임을 받아 볼 기회조차
          없었습니다. 형제로 나란히 두면 손잡이에 닿은 손짓은 손잡이 것입니다.
        */}
        <Row gap={0} style={styles.placeTop}>
        <Pressable onPress={onFocus} style={styles.placeTap}>
          <View style={styles.placeMain}>
            {/* 지도 핀과 같은 것이 찍힙니다. 목록과 지도를 눈으로 잇는 고리라
                양쪽이 반드시 같아야 합니다. */}
            <View
              style={[
                styles.order,
                { backgroundColor: visited ? color : 'transparent', borderColor: color },
              ]}>
              {emoji ? (
                <Body small style={styles.orderEmoji}>
                  {emoji}
                </Body>
              ) : (
                /* 다녀온 곳은 속이 날짜 색으로 차 있어 흰 글자, 아직인 곳은
                   속이 비어 있어 짙은 글자. */
                <Body small strong style={{ color: visited ? Colors.onDay : Colors.text }}>
                  {order}
                </Body>
              )}
            </View>

            <View style={styles.placeText}>
              <Row gap={Spacing.sm}>
                {place.time ? (
                  <Body small strong tone="accent">
                    {place.time}
                  </Body>
                ) : null}
                <Body strong numberOfLines={2}>
                  {place.name}
                </Body>
              </Row>
              {place.ja || place.en ? <Caption>{place.ja ?? place.en}</Caption> : null}
              {place.note ? <Caption tone="secondary">{place.note}</Caption> : null}
              {info ? <PlaceHours info={info} at={place.time} /> : null}
              {place.cat || place.cost ? (
                <Row gap={Spacing.sm}>
                  {place.cat ? <Caption>{place.cat}</Caption> : null}
                  {place.cost ? <Caption>{place.cost}</Caption> : null}
                </Row>
              ) : null}
            </View>

            {visited ? <Icon name="check" size={18} tone="success" /> : null}
          </View>
        </Pressable>

        {/* 끌어서 옮기는 손잡이. 손짓이 여기에만 걸려 있어 목록을 굴리는 것,
            판을 올리는 것과 다투지 않습니다. */}
        {canEdit ? (
          <DragHandle
            index={index}
            dragging={dragging}
            onStart={onDragStart}
            onMove={onDragMove}
            onEnd={onDragEnd}
          />
        ) : null}
        </Row>

        {/*
          손대는 단추는 고른 줄에서만 펼칩니다.

          전에는 장소마다 다섯이 늘 서 있어 목록이 단추밭이었습니다. 지도와
          목록은 이미 이어져 있어(누르면 핀이 커집니다) 고르는 몸짓이
          자연스럽고, 한 번에 한 곳만 손대는 것이 실제로 하는 일과도 맞습니다.
        */}
        {active ? (
        <Row gap={Spacing.xs} style={styles.placeActions}>
          {/* 구글이 모르고 방금 다녀온 사람만 아는 것들이 여기 모입니다. */}
          {place.placeId ? (
            <IconButton
              name="message-square"
              label={tipCount > 0 ? `한 줄 ${tipCount}개 보기` : '한 줄 남기기'}
              active={tipCount > 0}
              onPress={onTips}
            />
          ) : null}
          {/* 실제 안내는 구글 지도에 넘깁니다. 음성 안내도 환승 정보도 그쪽이
              낫고, 어차피 켤 것을 주소 옮겨 적게 만들 이유가 없습니다. */}
          <IconButton
            name="navigation"
            label={`${place.name} 길찾기`}
            onPress={() =>
              openDirections(
                { name: place.name, lat: place.lat, lng: place.lng, placeId: place.placeId },
                chosen?.mode ?? null,
              )
            }
          />
          <IconButton
            name="check"
            label={visited ? '다녀옴 취소' : '다녀옴으로 표시'}
            tone="success"
            active={visited}
            disabled={busy}
            onPress={onToggle}
          />
          {canEdit ? (
            <>
              <IconButton name="edit-2" label="장소 고치기" onPress={onEdit} />
              <IconButton
                name="trash-2"
                label="장소 지우기"
                tone="danger"
                onPress={() => setConfirming(true)}
              />
            </>
          ) : null}
        </Row>
        ) : null}

        <ConfirmDialog
          visible={confirming}
          title="이 장소를 지울까요?"
          message={`${place.name} 이(가) 일정에서 사라집니다. 되돌릴 수 없습니다.`}
          confirmLabel="지우기"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onRemove();
          }}
        />
      </View>

      {gap ? <GapBlock gap={gap} chosen={chosen} onPick={onPick} /> : null}
    </View>
  );
}

/**
 * 끌어서 옮기는 손잡이.
 *
 * <p>줄 전체가 아니라 이 작은 자리에만 손짓을 겁니다. 줄을 잡게 하면 목록을
 * 굴리려는 것, 판을 올리려는 것과 셋이 다투어 굴리려다 장소가 옮겨집니다.
 *
 * <p>세로로 조금 움직였을 때만 잡습니다. 그러지 않으면 손잡이를 스치기만 해도
 * 옮기기가 시작됩니다.
 */
function DragHandle({
  index,
  dragging,
  onStart,
  onMove,
  onEnd,
}: {
  index: number;
  dragging: boolean;
  onStart: (index: number) => void;
  onMove: (index: number, dy: number) => void;
  onEnd: (index: number) => void;
}) {
  /* 손짓은 한 번만 만들어 둡니다. 매번 새로 만들면 끄는 도중에 갈아 끼워져
     손가락이 떨어진 것처럼 됩니다. 대신 바뀌는 값은 상자에 담아 봅니다. */
  const at = useRef(index);
  at.current = index;
  const call = useRef({ onStart, onMove, onEnd });
  call.current = { onStart, onMove, onEnd };

  const pan = useRef(
    PanResponder.create({
      /*
        닿는 순간 붙잡습니다.

        "조금 움직이면 그때 붙잡기" 로 두었더니 목록을 감싼 스크롤이 먼저
        가져가 버려서 끌리지 않았습니다. 손잡이는 끄는 것 말고 하는 일이
        없으므로, 닿자마자 붙잡아도 뺏기는 것이 없습니다.

        놓아 달라는 요청도 거절합니다 — 끄는 중에 스크롤이 뺏어 가면 장소가
        허공에서 멈춥니다.
      */
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => call.current.onStart(at.current),
      onPanResponderMove: (_, g) => call.current.onMove(at.current, g.dy),
      onPanResponderRelease: () => call.current.onEnd(at.current),
      onPanResponderTerminate: () => call.current.onEnd(at.current),
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="끌어서 순서 옮기기"
      style={[styles.grip, dragging ? styles.gripOn : null]}>
      <Icon name="menu" size={18} tone={dragging ? 'accent' : 'muted'} />
    </View>
  );
}

/**
 * 장소와 장소 사이에 끼는 이동.
 *
 * <p>수단을 하나 고르게 하지 않고 셋을 나란히 놓습니다. "지하철 25분 / 택시
 * 10분에 1,500엔" 이 함께 보여야 시간을 살지 돈을 살지 그 자리에서 정할 수
 * 있습니다.
 *
 * <p>가장 빠른 것과 가장 싼 것에 표시를 답니다. 누르면 그 수단으로 지도의 길도
 * 함께 바뀝니다.
 */
function GapBlock({
  gap,
  chosen,
  onPick,
}: {
  gap: Gap;
  chosen: GapOption | null;
  onPick: (fromId: string, mode: TravelMode) => void;
}) {
  if (gap.options.length === 0) {
    return (
      <Row gap={Spacing.xs} style={styles.gap}>
        <Caption tone="muted">이어지는 길을 찾지 못했습니다</Caption>
      </Row>
    );
  }

  /* 빠른 것과 싼 것이 같으면 고민할 것이 없습니다. 그럴 때는 표시를 달지
     않습니다 — 둘 다 붙으면 무엇을 고르라는 것인지 알 수 없습니다. */
  const oneAnswer = gap.fastest === gap.cheapest;

  return (
    <View style={styles.gap}>
      <View style={styles.gapLine} />
      <Row gap={Spacing.xs}>
        {gap.options.map((option) => {
          const on = chosen?.mode === option.mode;
          return (
            <Press
              key={option.mode}
              onPress={() => onPick(gap.fromId, option.mode)}
              scale={0.94}
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${MODE_LABEL[option.mode]} ${asDuration(option.seconds)}`}
              style={[
                styles.option,
                on ? { borderColor: Colors.accent, backgroundColor: Colors.accentSoft } : null,
              ]}>
              <Row gap={Spacing.xs}>
                <Caption tone={on ? 'accent' : 'muted'}>{MODE_LABEL[option.mode]}</Caption>
                {!oneAnswer && option.mode === gap.fastest ? (
                  <Caption tone="hot" strong>
                    빠름
                  </Caption>
                ) : null}
                {!oneAnswer && option.mode === gap.cheapest ? (
                  <Caption tone="success" strong>
                    저렴
                  </Caption>
                ) : null}
              </Row>
              <Body small strong tone={on ? 'default' : 'secondary'}>
                {asDuration(option.seconds)}
              </Body>
              <Caption tone="muted">{fareText(option.fare) || asDistance(option.meters)}</Caption>
            </Press>
          );
        })}
      </Row>
      {/* 택시 요금은 구글이 알려 주지 않아 나라별 기본요금으로 어림한 값입니다.
          정확한 값인 척하면 그 돈만 들고 탔다가 모자랍니다. */}
      {gap.options.some((o) => o.fare?.estimated) ? (
        <Caption tone="muted">택시 요금은 기본요금으로 어림한 값입니다</Caption>
      ) : null}
    </View>
  );
}

/** "¥1,500" 처럼. 요금이 없는 것(걷기)은 빈 문자열입니다. */
function fareText(fare: Money | null) {
  if (!fare) {
    return '';
  }
  const sign: Record<string, string> = {
    KRW: '₩',
    JPY: '¥',
    USD: '$',
    TWD: 'NT$',
    HKD: 'HK$',
    SGD: 'S$',
    THB: '฿',
    VND: '₫',
  };
  return `${sign[fare.currency] ?? ''}${fare.amount.toLocaleString()}`;
}

/** 오늘 날짜를 여행의 iso 와 같은 모양으로. */
function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "1시간 12분" 처럼. 초는 버립니다 — 이동 시간에서 초는 뜻이 없습니다. */
function asDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

/** 가까우면 미터로, 멀면 킬로미터로. */
function asDistance(meters: number) {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 장소 밑에 붙는 영업시간 한 줄.
 *
 * <p><b>오늘</b>이 아니라 <b>그 장소를 넣어 둔 날</b> 기준입니다. 10월 9일에 갈
 * 곳이 그날 쉬는지가 궁금한 것이지 오늘 여는지가 아닙니다.
 *
 * <p>적어 둔 시각이 영업시간 밖이면 그것도 말해 줍니다. 브레이크 타임에 맞춰
 * 가면 문 앞에서 돌아섭니다.
 */
function PlaceHours({ info, at }: { info: PlaceInfo; at?: string | null }) {
  if (info.permanentlyClosed) {
    return (
      <Caption tone="danger" strong>
        문을 닫은 곳입니다
      </Caption>
    );
  }
  if (info.closedOnDay) {
    return (
      <Caption tone="danger" strong>
        이 날은 휴무입니다
      </Caption>
    );
  }
  if (!info.onDay && info.spans.length === 0) {
    return null;
  }

  /* 구글이 "월요일: 오전 9:00~오후 6:00" 처럼 요일까지 붙여 보냅니다. 어느 날
     것인지는 카드가 이미 말하고 있으므로 요일은 덜어 냅니다. */
  const text =
    info.spans.length > 0
      ? info.spans.map((s) => (s.end ? `${s.start}~${s.end}` : `${s.start}~`)).join(' · ')
      : (info.onDay ?? '').replace(/^[^:]+:\s*/, '');
  const off = at ? outsideHours(at, info.spans) : false;

  return (
    <Row gap={Spacing.sm}>
      <Caption tone={off ? 'danger' : 'secondary'} strong={off}>
        {text}
        {info.spans.length > 1 ? ' (브레이크 타임 있음)' : ''}
      </Caption>
      {off ? (
        <Caption tone="danger" strong>
          적어 둔 시각에 안 엽니다
        </Caption>
      ) : null}
      {info.rating ? (
        <Caption tone="secondary">
          ★ {info.rating.toFixed(1)}
          {info.ratingCount ? ` (${info.ratingCount.toLocaleString()})` : ''}
        </Caption>
      ) : null}
    </Row>
  );
}

/**
 * 적어 둔 시각이 여는 구간 밖인지.
 *
 * <p>구간을 모르면 아무 말도 하지 않습니다. 모르는 것을 "안 연다" 고 하면
 * 멀쩡한 계획을 흔듭니다.
 *
 * <p>새벽까지 하는 가게는 닫는 시각이 여는 시각보다 앞섭니다(23:00~02:00).
 * 그때는 자정을 넘긴 것으로 봅니다.
 */
function outsideHours(at: string, spans: { start: string; end?: string | null }[]) {
  if (spans.length === 0 || !/^\d{2}:\d{2}$/.test(at)) {
    return false;
  }
  return !spans.some((span) => {
    if (!span.end) {
      return at >= span.start;
    }
    return span.end > span.start
      ? at >= span.start && at <= span.end
      : at >= span.start || at <= span.end;
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.abyss,
  },

  /* 지도 위에 얹는 것들. 막대와 겹치지 않게 안전영역만큼 내려서 놓습니다. */
  floatTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    /* 옆으로 흐르는 띠라 높이를 내용만큼만 잡습니다. 안 잡으면 남은 화면을
       전부 차지해 지도를 못 누릅니다. */
    flexGrow: 0,
  },
  chipRail: {
    paddingHorizontal: Gutter,
    /* 오른쪽 기둥과 겹치지 않게 그만큼 비워 둡니다. 띠를 끝까지 밀면
       마지막 날짜가 단추 밑으로 들어갑니다. */
    paddingRight: Gutter + Tap.min,
  },
  /* 접지 않습니다. 접히면 지도를 덮습니다. */
  chipRow: {
    flexWrap: 'nowrap',
  },
  floatRight: {
    position: 'absolute',
    right: Gutter,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  floatLeft: {
    position: 'absolute',
    left: Gutter,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },

  head: {
    gap: Spacing.sm,
  },
  shortcuts: {
    alignItems: 'stretch',
  },
  shortcut: {
    flexGrow: 1,
    flexBasis: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.fill,
  },
  live: {
    gap: Spacing.sm,
  },
  pinRow: {
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headTop: {
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  track: {
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  dayTap: {
    flexShrink: 1,
    paddingVertical: Spacing.xs,
  },
  dayHeader: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  dayTitle: {
    flexShrink: 1,
    alignItems: 'center',
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },

  places: {
    gap: Spacing.xs,
  },
  place: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  placeTap: {
    flex: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    minHeight: Tap.min,
  },
  placeMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  /* 끌어 올린 줄. 다른 줄 위로 떠 있어야 어느 것을 쥐고 있는지 보입니다. */
  lifted: {
    zIndex: 10,
    elevation: 10,
  },
  /* 여기로 들어간다는 표시. */
  landing: {
    height: 2,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  placeTop: {
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
  },
  grip: {
    width: Tap.min,
    height: Tap.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    /* 브라우저가 이 자리에서 화면을 굴리지 않게 합니다. 안 막으면 손잡이를
       끌어도 목록만 위아래로 움직입니다. */
    touchAction: 'none',
  },
  gripOn: {
    backgroundColor: Colors.accentSoft,
  },
  order: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  orderEmoji: {
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  placeText: {
    flex: 1,
    gap: Spacing.xs,
  },
  placeActions: {
    /* 내용은 왼쪽에서 읽고, 손대는 것은 오른쪽 아래에 모읍니다. */
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  /* --------------------------------------------------- 사이사이 이동 */
  gap: {
    paddingLeft: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  /* 앞 장소에서 이어진다는 것을 눈으로 잇습니다. */
  gapLine: {
    width: StyleSheet.hairlineWidth,
    height: 10,
    marginLeft: Spacing.xs,
    backgroundColor: Colors.borderStrong,
  },
  option: {
    flexGrow: 1,
    /* 셋이 폭 360 인 폰에서도 한 줄에 서야 합니다. 이보다 넓게 잡으면
       마지막 하나가 아래로 접혀 비교가 안 됩니다. */
    flexBasis: 76,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.fill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: 2,
  },
});
