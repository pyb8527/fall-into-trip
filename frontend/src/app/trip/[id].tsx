import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type {
  Day,
  LivePin,
  LiveWhere,
  DayRoute,
  Place,
  PlaceInfo,
  RouteLeg,
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
import { openDirections } from '@/lib/directions';
import { useHere } from '@/lib/here';
import { decodePolyline } from '@/lib/polyline';
import { Colors, dayColor, Radius, Spacing, Tap } from '@/constants/theme';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  ConfirmDialog,
  Divider,
  Empty,
  ErrorNote,
  Icon,
  IconButton,
  Loading,
  Row,
  Screen,
  Subtitle,
} from '@/ui';

/** 전체를 보는 상태. 특정 날짜가 아니라는 뜻입니다. */
const ALL = -1;

/** 고를 수 있는 이동 수단. 서버가 받는 이름을 그대로 씁니다. */
const MODES: { value: TravelMode; label: string }[] = [
  { value: 'WALK', label: '도보' },
  { value: 'TRANSIT', label: '대중교통' },
  { value: 'DRIVE', label: '자동차' },
];

/**
 * 일정 화면.
 *
 * <p>서버가 여행·날짜·장소·내가 다녀온 곳을 한 번에 내려 줍니다. 나눠서
 * 부르면 그 사이에 동행자가 고쳤을 때 앞뒤가 안 맞는 화면이 됩니다.
 *
 * <p>지도와 목록이 같은 것을 가리킵니다. 목록에서 장소를 누르면 지도의
 * 핀이 커지고, 핀을 누르면 목록의 그 줄이 켜집니다. 둘을 따로 두면 어느
 * 쪽을 보고 있었는지 매번 다시 찾아야 합니다.
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
  /*
    이동 수단. 처음에는 아무것도 고르지 않습니다.

    구간마다 구글에 묻고 그만큼 요금이 붙습니다. 화면을 열기만 해도 나가면
    보지도 않은 것에 돈을 냅니다. 눌렀을 때만 묻습니다.
  */
  const [mode, setMode] = useState<TravelMode | null>(null);
  const me = useHere();
  /* 지금 자리에서 고른 장소까지. 위치를 켜고 장소를 골랐을 때만 있습니다. */
  const [fromHere, setFromHere] = useState<RouteLeg | null>(null);
  const [activeDay, setActiveDay] = useState<number>(ALL);
  /* 여행 중에 열면 오늘로 맞춰 준 적이 있는지. 한 번만 합니다 — 매번 하면
     사용자가 다른 날을 골라 놓아도 다시 오늘로 끌려갑니다. */
  const jumped = useRef(false);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);

  /* 방문 표시는 나만 보는 것이라, 서버 응답을 기다리지 않고 먼저 칠합니다.
     걸으면서 누르는 것이라 매번 기다리게 하면 손이 멎습니다. */
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* 매 렌더마다 새 Set 을 만들면, 그것을 쓰는 지도 목록도 매번 새 배열이
     됩니다. 그러면 핀을 한 번 누른 것만으로 지도가 마커를 다시 그리고 화면을
     다시 맞춰(축소해) 버립니다. */
  const marks = useMemo(
    () => visited ?? new Set(data?.visited ?? []),
    [visited, data?.visited],
  );
  const days = data?.days ?? [];

  /* 지도에 넘길 것만 추립니다. 날짜를 고르면 그 날만 남습니다. */
  /**
   * 여행 중이면 오늘을 펼쳐 놓고 시작합니다.
   *
   * <p>길 위에서 열었을 때 궁금한 것은 오늘 어디를 가는지입니다. 전체가 펼쳐진
   * 채로 열리면 오늘을 찾으려고 굴려야 하고, 날이 길수록 더 굴려야 합니다.
   *
   * <p>한 번만 합니다. 매번 하면 다른 날을 골라 봐도 다시 오늘로 끌려갑니다.
   *
   * <p>여행 기간이 아니면 손대지 않습니다. 짜는 중일 때는 전체가 보이는 편이
   * 낫습니다.
   */
  useEffect(() => {
    if (jumped.current || days.length === 0) {
      return;
    }
    const today = todayIso();
    const index = days.findIndex((d) => d.iso === today);
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
        /* 되돌립니다. 다녀왔다고 칠해 놓고 서버에 없으면 다음에 열 때 사라집니다. */
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

  /* 장소가 바뀌면 방문 표시도 서버 것으로 다시 맞춥니다. */
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
    고른 날짜의 이동 경로.

    "전체" 를 보고 있을 때는 계산하지 않습니다. 날짜 수만큼 구글에 묻게 되고
    구간마다 요금이 붙습니다. 한 날을 골라야 보여 줍니다.
  */
  /*
    하루짜리 여행에서는 날짜를 고르는 칩 자체가 뜨지 않아 늘 "전체" 로 남습니다.
    그래서 이동 시간이 한 번도 나오지 않았습니다. 날이 하나뿐이면 전체가 곧 그
    날이므로 고른 것으로 봅니다.
  */
  const routeDayId =
    activeDay === ALL
      ? days.length === 1
        ? (days[0]?.id ?? null)
        : null
      : (days[activeDay]?.id ?? null);
  const {
    data: route,
    loading: routing,
    error: routeError,
  } = useAsync<DayRoute | null>(
    (signal) =>
      mode && routeDayId
        ? api
            .get<{ route: DayRoute }>(`/api/days/${routeDayId}/route?mode=${mode}`, signal)
            .then((res) => res.route)
        : /* 고르기 전에는 부르지 않습니다. */ Promise.resolve(null),
    [routeDayId, mode],
  );

  /** 받은 길을 지도가 그릴 수 있는 좌표로 풉니다. */
  const routeLines = useMemo<RouteLine[]>(() => {
    if (!route || activeDay === ALL) {
      return [];
    }
    const color = days[activeDay]?.color || dayColor(activeDay);
    return route.legs
      .filter((leg) => leg.polyline)
      .map((leg) => ({
        id: `${leg.fromId}-${leg.toId}`,
        color,
        points: decodePolyline(leg.polyline),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, activeDay, days]);

  /*
    이 날 장소들이 언제 문을 여는지.

    월요일 휴관을 모르고 갔다가 하루를 날리는 일이 흔합니다. 날짜를 고르면
    자동으로 받아 옵니다. 경로와 달리 수단을 고를 것이 없어 따로 켜고 끄지
    않습니다. 다만 "전체" 를 보고 있을 때는 날짜 수만큼 나가므로 쉽니다.
  */
  const { data: placeInfo } = useAsync<PlaceInfo[]>(
    (signal) =>
      routeDayId
        ? api
            .get<{ info: PlaceInfo[] }>(`/api/days/${routeDayId}/places-info`, signal)
            .then((res) => res.info)
        : Promise.resolve([]),
    [routeDayId],
  );

  const infoOf = useMemo(
    () => new Map((placeInfo ?? []).map((i) => [i.id, i])),
    [placeInfo],
  );

  /*
    지금 자리에서 고른 장소까지.

    좌표는 본문으로 보냅니다. 쿼리스트링은 접근 기록과 방문 기록에 남는데,
    사람이 지금 어디 있는지는 거기 남길 값이 아닙니다.

    걸을 때마다 다시 묻지는 않습니다. 다른 장소를 고르거나 수단을 바꿀 때만
    묻습니다. 몇 걸음 옮겼다고 소요 시간이 달라지지도 않고, 그때마다 물으면
    요금이 계속 나갑니다.
  */
  const herePoint = me.here ? `${me.here.lat.toFixed(4)},${me.here.lng.toFixed(4)}` : null;
  useEffect(() => {
    const spot = me.here;
    if (!spot || !activePlaceId) {
      setFromHere(null);
      return;
    }
    let alive = true;
    api
      .post<{ leg: RouteLeg }>(`/api/places/${activePlaceId}/route`, {
        lat: spot.lat,
        lng: spot.lng,
        mode: mode ?? 'TRANSIT',
      })
      .then((res) => {
        if (alive) {
          setFromHere(res.leg);
        }
      })
      .catch(() => {
        if (alive) {
          setFromHere(null);
        }
      });
    return () => {
      alive = false;
    };
    /* 자리는 소수 넷째 자리(십여 미터)까지만 봅니다. 그보다 잘게 보면
       가만히 서 있어도 값이 떨려 계속 다시 묻습니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlaceId, mode, herePoint]);

  /*
    이 날 장소들에 달린 한 줄 팁이 몇 개인지.

    장소마다 물으면 그 수만큼 요청이 나갑니다. 번호가 있는 것만 모아 한 번에
    셉니다.
  */
  const [tipCounts, setTipCounts] = useState<Record<string, number>>({});
  const tipKeys = (placeInfo ?? []).length;
  const dayPlaceIds = useMemo(
    () =>
      (days[activeDay === ALL ? 0 : activeDay]?.places ?? [])
        .map((p) => p.placeId)
        .filter((id): id is string => !!id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routeDayId, tipKeys],
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
    자유시간에 서로 찾기 — 켜 둔 동행자와 잠깐 꽂아 둔 핀.

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

  /*
    켜 둔 동안에만 주기적으로 오갑니다. 안 켰으면 남의 자리도 자주 볼 이유가
    없어 한 번만 봅니다.
  */
  useEffect(() => {
    pullLive();
    if (!sharing) {
      return;
    }
    const timer = setInterval(pullLive, 20_000);
    return () => clearInterval(timer);
  }, [pullLive, sharing]);

  /* 켜 둔 동안 내 자리를 보냅니다. 십여 미터 단위로만 봐서, 가만히 서 있을 때
     떨리는 값으로 계속 보내지 않습니다. */
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
        setMates([]);
      } else if (me.here) {
        await api.put(`/api/trips/${id}/location`, {
          lat: me.here.lat,
          lng: me.here.lng,
          accuracy: me.here.accuracy,
        });
        setSharing(true);
      } else {
        setActionError('지금 위치를 알 수 없습니다. 위치 사용을 허용해 주세요.');
      }
      pullLive();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '바꾸지 못했습니다.');
    }
  }

  /** 지금 자리에 "여기 있다" 를 꽂습니다. */
  async function dropPin() {
    if (!me.here) {
      setActionError('지금 위치를 알 수 없습니다. 위치 사용을 허용해 주세요.');
      return;
    }
    setActionError(null);
    try {
      await api.post(`/api/trips/${id}/pins`, { lat: me.here.lat, lng: me.here.lng });
      pullLive();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '꽂지 못했습니다.');
    }
  }

  /** 한 줄을 열어 둔 장소. */
  const [tipFor, setTipFor] = useState<Place | null>(null);

  /** 장소 뒤에 붙는 구간을 목록에서 바로 찾기 위해. */
  const legAfter = useMemo(
    () => new Map((route?.legs ?? []).map((leg) => [leg.fromId, leg])),
    [route],
  );

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

  return (
    <Screen
      header={
        <>
          {/* 지도·날짜·진행 상황은 아래 목록을 훑는 내내 붙어 있어야 합니다. */}
          <TripMap
            places={mapPlaces}
            activeId={activePlaceId}
            onSelect={setActivePlaceId}
            routes={routeLines}
            here={me.here}
            mates={mates.map((m) => ({ id: m.userId, name: m.name, lat: m.lat, lng: m.lng }))}
            notes={pins.map((p) => ({ id: p.id, label: p.label ?? null, lat: p.lat, lng: p.lng }))}
            height={260}
          />

          {days.length > 1 ? (
            <Row gap={Spacing.sm}>
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
                  /* 오늘이 어느 칩인지 한눈에 보여야 길 위에서 헤매지 않습니다. */
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
          ) : null}

          <Row gap={Spacing.xs}>
            <Chip label="안 보기" selected={mode === null} onPress={() => setMode(null)} />
            {me.supported ? (
              <>
                {/* 켜 두면 네 시간 뒤 스스로 꺼집니다. 지나온 자리는 남지
                    않고 마지막 자리만 동행자에게 보입니다. */}
                <Chip
                  label={sharing ? '위치 공유 끄기' : '위치 공유'}
                  selected={sharing}
                  onPress={toggleSharing}
                />
                <Chip label="여기 있다고 꽂기" selected={false} onPress={dropPin} />
              </>
            ) : null}
            {MODES.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                selected={mode === m.value}
                onPress={() => setMode(m.value)}
              />
            ))}

          </Row>

          {me.error ? <Caption tone="danger">{me.error}</Caption> : null}
          {sharing ? (
            <Caption tone="success" strong>
              위치를 동행자에게 알리는 중입니다. 네 시간 뒤 저절로 꺼집니다.
            </Caption>
          ) : null}
          {mates.length > 0 ? (
            <Caption tone="secondary">
              지금 {mates.map((m) => m.name).join(' · ')} 님이 지도에 보입니다.
            </Caption>
          ) : null}
          {fromHere ? (
            <Caption tone="accent" strong>
              여기서{' '}
              {fromHere.reachable
                ? `${asDuration(fromHere.seconds)} · ${asDistance(fromHere.meters)}`
                : '갈 수 있는 길을 찾지 못했습니다'}
            </Caption>
          ) : null}

          {mode ? (
            <RouteNote
              picked={routeDayId !== null}
              route={route}
              busy={routing}
              error={routeError}
            />
          ) : null}

          {total > 0 ? <Progress done={done} total={total} /> : null}
        </>
      }>
      <Stack.Screen
        options={{
          title: data.trip.title,
          /*
            이 화면으로 곧장 들어오는 길이 여럿입니다. 주소를 새로고침하거나,
            초대 링크로 들어오거나, 앱이 업데이트를 받아 다시 뜰 때입니다.
            그때는 쌓인 기록이 없어 돌아갈 화살표가 아예 안 생깁니다.

            그런 경우에만 우리가 하나 답니다. 기록이 있으면 손대지 않고
            네비게이션이 만든 것을 그대로 씁니다.
          */
          headerLeft: navigation.canGoBack()
            ? undefined
            : () => (
                <IconButton
                  name="chevron-left"
                  label="내 여행으로"
                  onPress={() => router.replace('/(app)/trips')}
                />
              ),
          /* 동행자는 가끔 여는 것이라 화면을 차지하지 않게 막대에 둡니다. */
          headerRight: () => (
            <Row gap={Spacing.xs}>
              {/* 길 위에서는 짜는 화면이 방해입니다. 지금 갈 곳만 크게 보는
                  쪽으로 넘어갑니다. */}
              {/* 아직 정하지 않은 곳은 일정이 아니라 여기에 모읍니다. */}
              <IconButton
                name="star"
                label="가고 싶은 곳"
                onPress={() => router.push({ pathname: '/vote/[id]', params: { id } })}
              />
              <IconButton
                name="compass"
                label="여행 중 화면"
                onPress={() => router.push({ pathname: '/travel/[id]', params: { id } })}
              />
              {/* 올리는 것은 주인만 할 수 있습니다. 서버도 그렇게 막습니다. */}
              {data.trip.ownerId === user?.id ? (
                <IconButton
                  name="share-2"
                  label="게시판에 올리기"
                  onPress={() => setPublishing(true)}
                />
              ) : null}
              <IconButton name="users" label="동행자" onPress={() => setCompanions(true)} />
            </Row>
          ),
        }}
      />

      <CompanionsSheet
        visible={companions}
        tripId={data.trip.id}
        ownerId={data.trip.ownerId}
        onClose={() => setCompanions(false)}
        /* 스스로 나갔으면 이 여행은 더 못 봅니다. 목록으로 돌려보냅니다. */
        onLeft={() => router.replace('/(app)/trips')}
      />

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

      {tipFor?.placeId ? (
        <TipSheet
          visible
          placeId={tipFor.placeId}
          placeName={tipFor.name}
          onClose={() => setTipFor(null)}
          onChanged={countTips}
        />
      ) : null}

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

      {actionError ? <ErrorNote message={actionError} /> : null}

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
            legAfter={legAfter}
            mode={mode}
            infoOf={infoOf}
            tipCounts={tipCounts}
            onTips={setTipFor}
          />
        ) : null,
      )}

      {/* 지우는 것은 주인만. 되돌릴 수 없는 일이라 목록 맨 아래, 손이 잘
          닿지 않는 자리에 둡니다. */}
      {data.trip.ownerId === user?.id ? (
        <>
          <Divider />
          <Button label="여행 지우기" variant="danger" onPress={() => setDropping(true)} />
        </>
      ) : null}
    </Screen>
  );
}

/** 얼마나 다녀왔는지 한 줄로. 숫자만 있으면 잘 안 읽힙니다. */
function Progress({ done, total }: { done: number; total: number }) {
  const ratio = total === 0 ? 0 : done / total;
  return (
    <View style={styles.progress}>
      <Row style={styles.progressLabel}>
        <Caption tone="secondary">다녀온 곳</Caption>
        <Caption tone={done === total ? 'success' : 'secondary'} strong>
          {done} / {total}
        </Caption>
      </Row>
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
  legAfter,
  mode,
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
  /** 이 장소를 떠나 다음 장소로 가는 구간. 수단을 안 골랐으면 비어 있습니다. */
  legAfter: Map<string, RouteLeg>;
  /** 길찾기를 넘길 때 어떤 수단으로 열지. 안 골랐으면 대중교통입니다. */
  mode: TravelMode | null;
  /** 장소별 영업시간 등. 좌표만 직접 넣은 곳에는 없습니다. */
  infoOf: Map<string, PlaceInfo>;
  /** 구글 번호별 최근 팁 수. */
  tipCounts: Record<string, number>;
  onTips: (place: Place) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Place | null>(null);
  /*
    긴 여행은 카드가 그만큼 길어져 아래 날짜로 가려면 한참 굴려야 합니다.
    접어 두면 날짜만 훑다가 볼 것만 펼 수 있습니다.

    처음에는 펼쳐 둡니다. 접힌 채로 열리면 장소가 있는지조차 안 보입니다.
  */
  const [folded, setFolded] = useState(false);
  const [moving, setMoving] = useState(false);

  /**
   * 장소 순서를 한 칸 옮깁니다.
   *
   * <p>끌어서 옮기는 편이 보기에는 좋지만, 목록 안에서 끌면 화면 굴리기와
   * 다투게 됩니다. 손가락으로는 그 둘을 구별하기 어려워 옮기려다 스크롤되고
   * 굴리려다 옮겨집니다. 화살표는 못생겼어도 헷갈리지 않습니다.
   */
  async function move(index: number, by: number) {
    const next = index + by;
    if (moving || next < 0 || next >= day.places.length) {
      return;
    }
    const ids = day.places.map((p) => p.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];

    setMoving(true);
    try {
      await api.post('/api/places/reorder', { dayId: day.id, placeIds: ids });
      onChanged();
    } finally {
      setMoving(false);
    }
  }
  const done = day.places.filter((p) => visited.has(p.id)).length;
  const color = day.color || dayColor(index);

  return (
    <Card>
      <Row style={styles.dayHeader}>
        {/* 머리 전체가 접었다 펴는 자리입니다. 작은 화살표만 누르게 하면
            손가락으로는 잘 안 맞습니다. */}
        <Pressable
          onPress={() => setFolded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`${day.date || day.label} ${folded ? '펴기' : '접기'}`}
          style={styles.dayTap}>
          <Row gap={Spacing.md} style={styles.dayTitle}>
            <View style={[styles.dayDot, { backgroundColor: color }]} />
            {/* 위 칩이 이미 날짜로 고르게 하므로 'Day 1' 은 같은 말을 한 번 더
                하는 셈입니다. 날짜만 남깁니다. */}
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
          {/* 넣기 단추가 카드 맨 아래에 있으면 장소가 많을수록 굴려야 닿습니다.
              늘 같은 자리(머리 오른쪽)에 둡니다. */}
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
          {day.places.map((place, i) => (
            <View key={place.id}>
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
                mode={mode}
                info={infoOf.get(place.id)}
                tipCount={place.placeId ? (tipCounts[place.placeId] ?? 0) : 0}
                onTips={() => onTips(place)}
                onUp={i > 0 ? () => move(i, -1) : undefined}
                onDown={i < day.places.length - 1 ? () => move(i, 1) : undefined}
                moving={moving}
              />
              {/* 다음 장소까지 얼마나 걸리는지. 마지막 장소 뒤에는 없습니다. */}
              {i < day.places.length - 1 ? <Hop leg={legAfter.get(place.id)} /> : null}
            </View>
          ))}
        </View>
      )}

      {/*
        영업시간과 평점은 구글에서 온 것이라, 어디서 왔는지 밝혀야 합니다.
        약관 의무라 지우면 안 됩니다. 지도 위에 얹은 것이 아니라 목록이라
        글자로 답니다.
      */}
      {day.places.some((p) => infoOf.has(p.id)) ? (
        <Caption tone="muted">영업시간 · 평점 제공: Google</Caption>
      ) : null}

        </>
      )}

      {/* 넣기와 고치기 모두 아래에서 올라오는 판으로 합니다. */}
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

      {day.budget ? <Caption tone="secondary">예산 {day.budget}</Caption> : null}
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
  mode,
  info,
  tipCount,
  onTips,
  onUp,
  onDown,
  moving,
  onToggle,
  onFocus,
  onEdit,
  onRemove,
}: {
  place: Place;
  order: number;
  color: string;
  visited: boolean;
  busy: boolean;
  active: boolean;
  canEdit: boolean;
  mode: TravelMode | null;
  info?: PlaceInfo;
  tipCount: number;
  onTips: () => void;
  /** 맨 위·맨 아래 장소에는 갈 데가 없어 넘어오지 않습니다. */
  onUp?: () => void;
  onDown?: () => void;
  moving: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View
      style={[
        styles.place,
        { backgroundColor: active ? Colors.accentSoft : Colors.fill, opacity: busy ? 0.6 : 1 },
        active && { borderColor: color },
      ]}>
      <Pressable onPress={onFocus} style={styles.placeTap}>
        <View style={styles.placeMain}>
          {/* 지도 핀에 적힌 번호와 같은 번호입니다. */}
          <View style={[styles.order, { backgroundColor: color }]}>
            <OrderLabel n={order} />
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
            {place.cat || place.cost || place.move?.min ? (
              <Row gap={Spacing.sm}>
                {place.cat ? <Caption>{place.cat}</Caption> : null}
                {place.cost ? <Caption>{place.cost}</Caption> : null}
                {place.move?.min ? <Caption>이동 {place.move.min}분</Caption> : null}
              </Row>
            ) : null}
          </View>

          {visited ? <Badge label="다녀옴" tone="success" /> : null}
        </View>
      </Pressable>

      <Row gap={Spacing.xs} style={styles.placeActions}>
        {/* 실제 안내는 구글 지도에 넘깁니다. 음성 안내도 환승 정보도 그쪽이 낫고,
            어차피 켤 것을 주소 옮겨 적게 만들 이유가 없습니다. */}
        {canEdit ? (
          <>
            <IconButton
              name="arrow-up"
              label="위로 옮기기"
              disabled={!onUp || moving}
              onPress={() => onUp?.()}
            />
            <IconButton
              name="arrow-down"
              label="아래로 옮기기"
              disabled={!onDown || moving}
              onPress={() => onDown?.()}
            />
          </>
        ) : null}
        {/* 구글이 모르고 방금 다녀온 사람만 아는 것들이 여기 모입니다. */}
        {place.placeId ? (
          <IconButton
            name="message-square"
            label={tipCount > 0 ? `한 줄 ${tipCount}개 보기` : '한 줄 남기기'}
            active={tipCount > 0}
            onPress={onTips}
          />
        ) : null}
        <IconButton
          name="navigation"
          label={`${place.name} 길찾기`}
          onPress={() => {
            openDirections(
              { name: place.name, lat: place.lat, lng: place.lng, placeId: place.placeId },
              mode,
            );
          }}
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
  );
}

/** 핀 번호. 색 위에 흰 글자로 올립니다. */
function OrderLabel({ n }: { n: number }) {
  return <Body small strong style={styles.orderText}>{n}</Body>;
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
 * 장소와 장소 사이에 끼는 줄.
 *
 * <p>아직 못 받았으면 아무것도 그리지 않습니다. 자리만 잡아 두면 목록이
 * 계산 전후로 들썩입니다.
 */
function Hop({ leg }: { leg?: RouteLeg }) {
  if (!leg) {
    return null;
  }
  return (
    <Row gap={Spacing.xs} style={styles.hop}>
      <View style={styles.hopLine} />
      <Caption tone="secondary">
        {leg.reachable
          ? `${asDuration(leg.seconds)} · ${asDistance(leg.meters)}`
          : '이 수단으로는 길이 없습니다'}
      </Caption>
    </Row>
  );
}

/** 수단을 고른 뒤 위쪽에 뜨는 한 줄. */
function RouteNote({
  picked,
  route,
  busy,
  error,
}: {
  /** 계산할 날짜가 정해졌는지. 여러 날 중 "전체" 를 보고 있으면 아닙니다. */
  picked: boolean;
  route: DayRoute | null;
  busy: boolean;
  error: string | null;
}) {
  if (!picked) {
    return <Caption tone="secondary">날짜를 하나 고르면 이동 시간을 보여 줍니다.</Caption>;
  }
  if (error) {
    return <Caption tone="danger">{error}</Caption>;
  }
  if (busy) {
    return <Caption tone="secondary">이동 시간을 알아보는 중…</Caption>;
  }
  if (!route || route.legs.length === 0) {
    return null;
  }
  return (
    <Caption tone="secondary">
      총 이동 {asDuration(route.totalSeconds)} · {asDistance(route.totalMeters)}
      {route.trimmed ? ' · 장소가 많아 앞부분만 계산했습니다' : ''}
    </Caption>
  );
}


/**
 * 장소 밑에 붙는 영업시간 한 줄.
 *
 * <p><b>오늘</b>이 아니라 <b>그 장소를 넣어 둔 날</b> 기준입니다. 10월 9일에
 * 갈 곳이 그날 쉬는지가 궁금한 것이지 오늘 여는지가 아닙니다. 월요일 휴관을
 * 모르고 갔다가 하루를 날리는 일이 흔합니다.
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

  /* 구글이 "월요일: 오전 9:00~오후 6:00" 처럼 요일까지 붙여 보냅니다.
     어느 날 것인지는 카드가 이미 말하고 있으므로 요일은 덜어 냅니다. */
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
  hop: {
    alignItems: 'center',
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  /* 앞 장소에서 이어진다는 것을 눈으로 잇습니다. */
  hopLine: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: Colors.border,
  },
  head: {
    gap: Spacing.lg,
  },
  progress: {
    gap: Spacing.sm,
  },
  progressLabel: {
    justifyContent: 'space-between',
  },
  track: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.fillPressed,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  /* 누르는 자리를 넓게 잡아 손가락으로 맞추기 쉽게 합니다. */
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
    gap: Spacing.sm,
  },
  place: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  placeTap: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    minHeight: Tap.min,
  },
  placeMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  order: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  orderText: {
    color: '#FFFFFF',
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
});
