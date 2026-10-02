import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { PopularPlace, PostPage, SavedPlace, TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { IconPicker } from '@/components/icon-picker';
import type { MapPlace } from '@/components/map-types';
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import { PlaceSearch } from '@/components/place-search';
import { RecommendSheet } from '@/components/recommend-sheet';
import { DayPicker } from '@/components/day-picker';
import { SavedRow } from '@/components/saved-row';
import { SORT_GIVEN, SORT_NAME, SortBar, type SortBy } from '@/components/sort-bar';
import { TripMap } from '@/components/trip-map';
import { glyphOf, labelOf } from '@/constants/place-icons';
import { Colors, Spacing, Tap } from '@/constants/theme';
import { kindsIn, savedAgo, siftSaved } from '@/lib/saved';
import { cityOf, ELSEWHERE } from '@/lib/cities';
import { todayIso } from '@/lib/countdown';
import {
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
  FilterChip,
  Grow,
  IconButton,
  ListRow,
  Loading,
  Mark,
  Press,
  Row,
  Screen,
  SearchField,
  SectionHeader,
  SegmentedTabs,
  Snack,
  Split,
  Title,
  useUndo,
} from '@/ui';
import { CardGrid } from '@/ui/grid';
import { AppTabs } from '@/ui/tab-bar';
import { KEEP, UNKEEP } from '@/constants/words';

/**
 * 보석함.
 *
 * <p>남의 일정에서, 검색에서 눈에 띄는 곳을 담아 두었다가 내 일정 아무 날에나
 * 꺼내 넣습니다.
 *
 * <h3>지도를 함께 둡니다</h3>
 *
 * <p>담아 둔 곳은 목록으로만 보면 이름의 나열입니다. "오사카에서 담은 게
 * 뭐였지" 를 알려면 하나씩 눌러 봐야 했습니다.
 *
 * <p>지도에서 <b>점끼리 잇지 않습니다.</b> 담아 둔 곳에는 순서가 없습니다.
 * 이어 놓으면 담은 차례가 무슨 동선인 것처럼 보여, 있지도 않은 길을 그려
 * 놓게 됩니다.
 *
 * <h3>담는 도구는 판 안으로 들어갔습니다</h3>
 *
 * <p>화면 위쪽에 "여기 담기" 카드가 늘 펼쳐져 있었습니다. 장소 찾기 칸과
 * 힌트 줄과 "어디 갈까" 단추까지 합쳐 세로로 한 뼘을 먹고, 그 아래에야
 * 거르기와 정렬과 목록이 옵니다. <b>보석함을 여는 이유는 대개 담으려는
 * 것이 아니라 꺼내려는 것</b>인데, 꺼낼 것이 늘 화면 밖에서 시작했습니다.
 *
 * <p>담는 일은 머리의 단추 하나로 줄이고, 화면은 담아 둔 것에 내줍니다.
 *
 * <h3>줄을 누르면 들여다봅니다</h3>
 *
 * <p>줄에 이름 하나만 적혀 있었고, 눌러도 고르기만 됐습니다. 그래서 두 달
 * 전에 담은 곳이 무엇이었는지 알 길이 목록 어디에도 없었습니다 — 평점도
 * 영업시간도 주소도, 심지어 왜 담았는지도.
 *
 * <p>이제 누르면 장소를 들여다보는 판이 뜹니다. 검색에서 고를 때 쓰는 것과
 * 같은 판이라, 담기 전에 보던 것을 담은 뒤에도 그대로 봅니다.
 *
 * <h3>설명 줄을 빈자리로 옮겼습니다</h3>
 *
 * <p>「주워 둔 32곳. 골라서 일정 아무 날에나 얹어요」 를 흰 판에 담아 지도
 * 아래에 늘 두었습니다. 이 말이 필요한 사람은 <b>처음 온 사람 한 번</b>
 * 인데, 그 한 번을 위해 서른두 곳을 담아 둔 사람도 매번 그 판을 지나쳐
 * 내려가야 했습니다. 설명은 빈자리(Empty)가 말하고, 담는 일은 제목 옆
 * <b>+</b> 가 맡습니다.
 *
 * <h3>고르는 동안에는 머리가 바뀝니다</h3>
 *
 * <p>몇 곳을 골랐는지가 아래 단추 글자에만 적혀 있었습니다. 목록을 내려가며
 * 고르다 보면 그 단추가 화면 밖으로 밀려나서, 지금 몇 곳인지 보려고 맨
 * 아래까지 내려야 했습니다. 제목 자리가 「3곳 선택됨 | 취소」 로 바뀝니다.
 */
export default function Saved() {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pouring, setPouring] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /** 거르고 있는 갈래. 비우면 전부 봅니다. */
  const [kind, setKind] = useState<string | null>(null);
  /** 이름·메모로 찾기. */
  const [q, setQ] = useState('');
  /* 담은 순서가 기본입니다. 최근 담은 것이 대개 지금 짜는 것과 가깝습니다. */
  const [by, setBy] = useState<SortBy>('given');
  /** 말로 물어보는 판을 열어 두었는지. */
  const [asking, setAsking] = useState(false);
  /** 새로 담는 판을 열어 두었는지. */
  const [keeping, setKeeping] = useState(false);
  /** 지도에서 켜 둔 곳. 목록의 그 줄도 함께 켜집니다. */
  const [activeId, setActiveId] = useState<string | null>(null);
  /** 조건 고르는 판을 열어 두었는지. */
  const [sifting, setSifting] = useState(false);

  /*
    열어 둔 판들은 곳 자체가 아니라 그 번호만 들고 있습니다.

    곳을 통째로 들고 있으면 메모를 고치거나 그림을 바꾼 뒤에도 판은 열던
    순간의 값을 그대로 보여 줍니다. 번호만 들고 목록에서 매번 찾으면 고친
    것이 곧바로 비칩니다.
  */
  const [lookingId, setLookingId] = useState<string | null>(null);
  const { undo, show: showUndo, hide: hideUndo } = useUndo();
  const [taggingId, setTaggingId] = useState<string | null>(null);
  /* 도시 묶음 하나만 볼 때. 비우면 전부입니다. */
  const [city, setCity] = useState<string | null>(null);
  /* 목록 · 지도. 지도가 늘 위에 있어서 목록이 한 줄 반만 보였습니다. */
  const [view, setView] = useState<'list' | 'map'>('list');
  /* 담을 여행을 고르는 판. */
  const [aiming, setAiming] = useState(false);
  const [aimDays, setAimDays] = useState<TripDetail['days'] | null>(null);

  const { data, error, loading, reload, setData } = useAsync<{ places: SavedPlace[] }>(
    (signal) => api.get('/api/saved', signal),
    [],
  );

  const all = useMemo(() => data?.places ?? [], [data]);
  const kinds = useMemo(() => kindsIn(all), [all]);
  /* 장소마다 도시. 좌표에서 가장 가까운 큰 도시입니다(lib/cities). */
  const cityById = useMemo(
    () => new Map(all.map((p) => [p.id, cityOf(p.lat, p.lng) ?? ELSEWHERE])),
    [all],
  );
  /* 도시 칩 — 많이 담은 도시부터. 「그 밖」은 늘 끝입니다. */
  const cities = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of cityById.values()) {
      n.set(c, (n.get(c) ?? 0) + 1);
    }
    return [...n.entries()].sort((a, b) =>
      a[0] === ELSEWHERE ? 1 : b[0] === ELSEWHERE ? -1 : b[1] - a[1],
    );
  }, [cityById]);
  const shown = useMemo(
    () =>
      siftSaved(all, { q, kind, by }).filter((p) => city == null || cityById.get(p.id) === city),
    [all, q, kind, by, city, cityById],
  );
  /* 도시별 묶음. 칩으로 하나를 고르면 그 묶음 하나뿐입니다. */
  const bunches = useMemo(() => {
    const out = new Map<string, SavedPlace[]>();
    for (const p of shown) {
      const c = cityById.get(p.id) ?? ELSEWHERE;
      out.set(c, [...(out.get(c) ?? []), p]);
    }
    return [...out.entries()].sort((a, b) =>
      a[0] === ELSEWHERE ? 1 : b[0] === ELSEWHERE ? -1 : b[1].length - a[1].length,
    );
  }, [shown, cityById]);

  /* 내 여행 — 담을 곳과 「오사카 여행에 4곳 담을 수 있어요」 안내에 씁니다. */
  const { data: tripData } = useAsync<{ trips: TripSummary[] }>((signal) => api.get('/api/trips', signal), []);
  const upcoming = useMemo(
    () =>
      (tripData?.trips ?? []).filter((t) => (t.endIso ?? t.startIso ?? '9999') >= todayIso()),
    [tripData],
  );
  /*
    안내 한 줄 — 다가오는 여행 이름에 도시 이름이 들어 있고 그 도시에 담아 둔
    곳이 있으면. 누르면 그 곳들을 골라 둡니다.
  */
  const hint = useMemo(() => {
    for (const t of upcoming) {
      const hit = cities.find(([c]) => c !== ELSEWHERE && t.title.includes(c));
      if (hit) {
        return { trip: t, city: hit[0], count: hit[1] };
      }
    }
    return null;
  }, [upcoming, cities]);

  /*
    담기 — 모임 여행이면 「가고 싶은 곳」, 혼자 여행이면 날짜(plan-review Q5).

    <p>모임 여행의 일정에 혼자 바로 넣으면, 같이 가는 사람은 자기도 모르게 정해진
    곳을 봅니다. 가고 싶은 곳에 올리면 모두가 좋다고 해야 일정이 됩니다.
    혼자 여행에는 물을 사람이 없으니 날짜로 바로 넣는 편이 빠릅니다.
  */
  async function aimAt(trip: TripSummary) {
    setFailed(null);
    if (trip.groupId) {
      try {
        for (const savedId of picked) {
          await api.post(`/api/trips/${encodeURIComponent(trip.id)}/candidates`, { savedId });
        }
        setAiming(false);
        setPicked(new Set());
        router.push({ pathname: '/vote/[id]', params: { id: trip.id } });
      } catch (e) {
        setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      }
      return;
    }
    try {
      const got = await api.get<TripDetail>(`/api/trip?trip=${encodeURIComponent(trip.id)}`);
      setAimDays(got.days);
      setAiming(false);
      setPouring(true);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /**
   * 지금 걸려 있는 것들. 밖에 내놓을 것과 개수를 여기서 한 번에 셉니다.
   *
   * <p>찾는 말은 안 넣습니다 — 칸이 밖에 그대로 서 있어서 거기 적힌 것이
   * 곧 조건입니다. 칩으로 한 번 더 적으면 같은 말이 두 군데 있습니다.
   */
  const applied: { key: string; label: string; clear: () => void }[] = [
    kind !== null
      ? { key: 'kind', label: labelOf(kind) || '어떤 곳', clear: () => setKind(null) }
      : null,
    by !== 'given' ? { key: 'by', label: '이름순', clear: () => setBy('given') } : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const looking = all.find((p) => p.id === lookingId) ?? null;
  const tagging = all.find((p) => p.id === taggingId) ?? null;

  /** 지도에 얹을 것. 거른 것만 올립니다 — 지도와 목록이 어긋나면 안 됩니다. */
  const pins = useMemo<MapPlace[]>(
    () =>
      shown.map((place, i) => ({
        id: place.id,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        dayIndex: 0,
        order: i + 1,
        /* 지도에서는 그림도 번호도 얹지 않습니다. 아래 shape="star" 가
           전부 같은 동그라미에 별 하나로 그립니다. */
        emoji: '',
        color: Colors.accent,
        fit: true,
        radius: null,
        detail: {
          time: null,
          cat: place.cat ?? null,
          cost: null,
          note: place.note ?? null,
          sub: null,
          dayLabel: labelOf(place.icon) || '주워 둔 곳',
          visited: false,
        },
      })),
    [shown],
  );

  /**
   * 찾은 곳을 바로 담습니다.
   *
   * <p>고르는 것과 담는 것이 여기서는 같은 일입니다 — 이 화면에는 넣을
   * 일정이 없고 보석함뿐입니다.
   */
  async function keepFound(found: {
    name: string;
    lat: number;
    lng: number;
    placeId?: string | null;
    icon?: string | null;
  }) {
    setFailed(null);
    try {
      await api.post('/api/saved', {
        name: found.name,
        lat: found.lat,
        lng: found.lng,
        placeId: found.placeId,
        icon: found.icon,
      });
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /**
   * 고른 것들을 보석함에서 뺍니다.
   *
   * <p>되돌리기는 <b>같은 내용을 다시 담는 것</b>입니다 — 서버에 되살리는
   * 길이 없습니다. 번호가 새로 붙고 담은 시각이 지금이 되는데, 보석함은
   * 번호로 남을 부르는 곳이 아니라 상관없습니다. 어느 글에서 담아 왔는지
   * 까지 같이 들고 갔다 옵니다.
   */
  async function dropPicked() {
    const targets = all.filter((p) => picked.has(p.id));
    if (targets.length === 0) {
      return;
    }
    setFailed(null);
    try {
      await Promise.all(targets.map((p) => api.delete(`/api/saved/${p.id}`)));
      setPicked(new Set());
      reload();
      showUndo({
        message:
          targets.length === 1
            ? `「${targets[0].name}」 를 뺐어요.`
            : `${targets.length}곳을 뺐어요.`,
        onUndo: () => restore(targets),
      });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /** 뺀 것을 같은 내용으로 다시 담습니다. */
  async function restore(places: SavedPlace[]) {
    setFailed(null);
    try {
      await Promise.all(
        places.map((p) =>
          api.post('/api/saved', {
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            placeId: p.placeId,
            cat: p.cat,
            icon: p.icon,
            note: p.note,
            fromPost: p.fromPost,
          }),
        ),
      );
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /**
   * 한 곳만 뺍니다.
   *
   * <p>누르면 그 자리에서 [빼기/취소] 로 바뀌는 단추로 물었습니다. 단추가
   * 제 글자를 바꿔 치면 무엇이 없어지는지는 안 보이고, 두 번 누르는 자리가
   * 겹쳐 있어서 연달아 누르면 묻는 말이 그냥 지나갑니다.
   *
   * <p>그런데 이 일은 되돌릴 수 있습니다 — 여러 곳을 뺄 때({@link dropPicked})
   * 와 같은 길입니다. 그래서 묻지 않고 바로 빼고, 띠에 물러설 길을 둡니다.
   */
  async function drop(place: SavedPlace) {
    setFailed(null);
    setLookingId(null);
    try {
      await api.delete(`/api/saved/${place.id}`);
      setPicked((prev) => {
        const next = new Set(prev);
        next.delete(place.id);
        return next;
      });
      reload();
      showUndo({ message: `「${place.name}」 를 뺐어요.`, onUndo: () => restore([place]) });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  /**
   * 그림과 메모를 고칩니다.
   *
   * <p>서버를 기다리지 않고 먼저 칠합니다 — 고르는 맛이 있어야 합니다.
   * {@code null} 은 "손대지 마라" 라서, 한쪽만 보내면 다른 쪽은 그대로
   * 남습니다.
   */
  async function edit(place: SavedPlace, patch: { icon?: string; note?: string }) {
    setFailed(null);
    setData((prev) =>
      prev
        ? {
            ...prev,
            places: prev.places.map((p) =>
              p.id === place.id
                ? {
                    ...p,
                    icon: patch.icon === undefined ? p.icon : patch.icon || null,
                    note: patch.note === undefined ? p.note : patch.note || null,
                  }
                : p,
            ),
          }
        : prev,
    );
    try {
      await api.patch(`/api/saved/${place.id}`, patch);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      reload();
    }
  }

  return (
    <Screen
      safeTop
      tabs={<AppTabs />}
      snack={<Snack undo={undo} onHide={hideUndo} />}
      header={
        picked.size > 0 ? (
          /* 고르는 동안에는 머리가 「몇 곳 골랐는지」 와 「그만두기」 만
             말합니다. 담기 단추는 이때 할 일이 아닙니다. */
          <Split>
            <Grow>
              <Title>{picked.size}곳 선택됨</Title>
            </Grow>
            <Button label="취소" variant="ghost" compact onPress={() => setPicked(new Set())} />
          </Split>
        ) : (
          <Split>
            <Grow>
              <Title>저장</Title>
            </Grow>
            <IconButton name="plus" label={KEEP} bare onPress={() => setKeeping(true)} />
          </Split>
        )
      }
      footer={
        picked.size > 0 ? (
          <Row gap={Spacing.s2}>
            {/*
              빼는 길이 여기 있어야 합니다.

              <p>빼는 단추가 <b>들여다보는 판 맨 아래</b>에만 있었습니다.
              줄을 눌러 ⓘ 를 열고, 지도와 영업시간과 메모 칸을 지나 끝까지
              내려야 나옵니다 — 스무 곳을 정리하려면 스무 번을 그렇게 해야
              했고, 그래서 사실상 못 빼는 기능이었습니다.

              <p>이미 고르는 몸짓이 있습니다(왼쪽 네모). 고른 것을 일정에
              넣을 수 있으면 뺄 수도 있어야 합니다. 여러 개를 한 번에
              거두는 것도 그제야 됩니다.

              <p>미리 묻지 않습니다. 뺀 뒤에 되돌리는 띠가 잠깐 뜹니다.

              <p>채운 단추로 두지 않습니다. 바닥에 색을 가득 칠한 것은 화면에
              하나여야 하고, 그 하나는 이 화면에 들어온 까닭(일정에 넣기)
              입니다. 빼기는 글자만 빨갛게 둡니다.
            */}
            <Press
              onPress={() => dropPicked()}
              scale={1}
              accessibilityLabel={`고른 ${picked.size}곳 빼기`}
              style={styles.drop}>
              <Body tone="danger" strong>
                빼기
              </Body>
            </Press>
            <View style={styles.lead}>
              <Button label={`${picked.size}곳 여행에 담기`} onPress={() => setAiming(true)} />
            </View>
          </Row>
        ) : undefined
      }>
      {/*
        큰 제목이 본문 위에 서므로 상단바는 걷습니다.

        <p>갈래 띠로 오는 화면입니다. 뒤로 갈 데가 없으니 상단바가 할 일이
        없는데, 작은 제목 하나를 위해 56픽셀을 먹고 있었습니다 — 게다가
        고르는 동안에는 제목 자리가 「3곳 선택됨」 으로 바뀌어야 하는데
        상단바에 둔 제목은 그 말을 할 수 없었습니다.
      */}
      <Stack.Screen options={{ headerShown: false }} />

      {/*
        지도가 먼저입니다.

        전에는 설명 한 줄과 단추가 맨 위에 서고 지도는 그 아래 회색 네모로
        끼여 있었습니다. 그런데 보석함을 열고 가장 먼저 하는 일은 <b>어디에
        뭘 담아 뒀는지</b> 보는 것입니다 — "오사카에서 담은 게 뭐였지" 는
        목록을 훑어서는 안 나오고 지도를 봐야 나옵니다.

        사진을 안 올리는 앱이라 화면의 무게를 질 것이 지도밖에 없기도 합니다.
        문토나 무신사가 사진으로 하는 일을 여기서는 지도가 합니다.
      */}
      {/*
        도시 칩과 목록 · 지도.

        <p>「도쿄 12 · 오사카 4」 — 담아 둔 곳은 결국 어느 도시 여행에 쓰입니다.
        지도는 고를 때만 폅니다. 늘 위에 있으면 목록이 한 줄 반만 보입니다.
      */}
      {all.length > 0 ? (
        <>
          <SegmentedTabs
            items={[
              { value: 'list', label: '목록' },
              { value: 'map', label: '지도' },
            ]}
            value={view}
            onChange={setView}
          />
          {cities.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityRow}>
              <Chip label="전체" selected={city === null} onPress={() => setCity(null)} />
              {cities.map(([c, n]) => (
                <Chip key={c} label={`${c} ${n}`} selected={city === c} onPress={() => setCity(city === c ? null : c)} />
              ))}
            </ScrollView>
          ) : null}
          {hint ? (
            <Press
              onPress={() => {
                setCity(hint.city);
                setPicked(new Set(all.filter((p) => cityById.get(p.id) === hint.city).map((p) => p.id)));
              }}
              scale={0.99}
              style={styles.hint}>
              <Caption tone="brand" strong>
                {`「${hint.trip.title}」에 ${hint.city} ${hint.count}곳을 담을 수 있어요 ›`}
              </Caption>
            </Press>
          ) : null}
        </>
      ) : null}

      {pins.length > 0 && view === 'map' ? (
        <TripMap
          places={pins}
          activeId={activeId}
          onSelect={setActiveId}
          link={false}
          /* 전부 같은 동그라미에 별 하나. 담아 둔 곳에는 순서가 없고, 갈래는
             아래 거르기가 이미 말해 줍니다. */
          shape="star"
          /* 300 이었습니다. 지도가 화면의 3분의 1을 넘게 먹으면 목록이 늘
             한 줄 반만 보여서, 어디에 뭘 담아 뒀는지는 알아도 그것이
             무엇인지는 매번 내려야 알았습니다. */
          height={220}
        />
      ) : null}

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && all.length === 0 ? (
        <>
          <Empty message="마음에 드는 곳을 저장해 두면 여행 짤 때 바로 꺼내 쓸 수 있어요. 제목 옆 ＋ 로 바로 찾아 담을 수도 있어요." />
          {/* 빈 자리에 담을 거리를 바로 둡니다 — 지금 뜨는 곳 다섯과 인기 여행. */}
          <StarterPicks onKept={reload} />
        </>
      ) : null}

      {/*
        지도와 목록은 서로 다른 구역입니다.

        <p>지도 아래로 찾기 칸과 거르기와 줄들이 곧바로 이어져 있었습니다.
        그래서 어디까지가 「어디에 담아 뒀나」이고 어디부터가 「무엇을 담아
        뒀나」인지 화면에 안 적혀 있었습니다 — 띠 한 가닥이 그 말을 합니다.
      */}
      {pins.length > 0 ? <Band /> : null}

      {/*
        찾기와 거르기는 한 묶음입니다.

        <p>둘을 화면의 직접 자식으로 두면 사이에 기본 간격이 끼어 따로따로
        떠 보입니다. 둘 다 <b>목록을 좁히는 일</b>이라 붙어 있어야 합니다.

        <p>갈래와 정렬은 판 안으로 보냈습니다. 갈래 칩이 여덟이면 좁은 폰에서
        두 줄이고 그 아래 정렬이 또 한 줄입니다. 담아 둔 것을 보러 왔는데
        그것이 늘 화면 밖에서 시작했습니다 — 고를 수 있는 것은 판 안에,
        밖에는 고른 것만.
      */}
      {all.length > 2 || kinds.length > 1 ? (
        <View style={styles.sift}>
          {/* 몇 개 안 될 때는 찾을 것이 없습니다. 칸만 자리를 차지합니다. */}
          {all.length > 4 ? (
            <SearchField
              label="저장한 곳에서 찾기"
              value={q}
              onChangeText={setQ}
              placeholder="국밥, 온천, 도톤보리"
            />
          ) : null}

          <Row gap={Spacing.s2} style={styles.applied}>
            <Button
              label={applied.length > 0 ? `필터 ${applied.length}` : '필터'}
              variant="secondary"
              compact
              onPress={() => setSifting(true)}
            />
            {applied.map((a) => (
              <FilterChip key={a.key} label={a.label} onRemove={a.clear} />
            ))}
          </Row>
        </View>
      ) : null}

      {/* 몇 곳이 남는지를 판을 닫기 전에 말합니다. 여기 목록은 이미 받아
          둔 것을 거르는 것이라 개수가 곧바로 따라옵니다. */}
      <BottomSheet
        visible={sifting}
        title="필터"
        onClose={() => setSifting(false)}
        footer={
          <Button label={`결과 ${shown.length}곳 보기`} onPress={() => setSifting(false)} />
        }>
        {kinds.length > 1 ? (
          <>
            <Body small strong>
              어떤 곳
            </Body>
            <Row gap={Spacing.s2} style={styles.applied}>
              <Chip label="전체" selected={kind === null} onPress={() => setKind(null)} />
              {kinds.map((k) => (
                <Chip
                  key={k.key}
                  label={`${k.emoji} ${k.label}`}
                  selected={kind === k.key}
                  onPress={() => setKind(kind === k.key ? null : k.key)}
                />
              ))}
            </Row>
          </>
        ) : null}

        {kinds.length > 1 && all.length > 2 ? <Divider /> : null}

        {/* 담아 둔 곳에는 평점이 없습니다. 번호만 저장하고 내용은 저장하지
            않으니까요 — 이름순만 냅니다. */}
        {all.length > 2 ? (
          <>
            <Body small strong>
              세우는 법
            </Body>
            <SortBar
              options={[{ ...SORT_GIVEN, label: '담은 순' }, SORT_NAME]}
              value={by}
              onChange={setBy}
            />
          </>
        ) : null}
      </BottomSheet>

      {data && all.length > 0 && shown.length === 0 ? (
        <Empty
          message={
            q.trim() ? `"${q.trim()}" 로는 찾은 것이 없어요.` : '이런 곳은 아직 담아 둔 것이 없어요.'
          }
        />
      ) : null}

      {/*
        목록에도 머리를 세웁니다.

        <p>개수 「32곳」만 조건 줄 아래에 떠 있었습니다. 그래서 줄들이 어느
        묶음에 속한 것인지 말해 주는 것이 화면에 하나도 없었고, 지도 아래로
        칸과 칩과 줄이 <b>이름 없이</b> 이어졌습니다 — 다른 갈래 화면들은
        구역마다 머리가 서 있는데 이 화면만 안 서 있었습니다.

        <p>개수는 머리 오른쪽으로 들어갑니다. 「내 여행」의 묶음 머리와 같은
        모양입니다 — 제목 왼쪽, 개수 오른쪽.
      */}
      <View>
        {view === 'list' && shown.length > 0 && bunches.length === 1 ? (
          <SectionHeader
            title={bunches[0][0] === ELSEWHERE ? '담아 둔 곳' : bunches[0][0]}
            action={<Caption tone="secondary">{shown.length}곳</Caption>}
          />
        ) : null}
        {/*
          넓은 화면에서는 줄을 두세 칸으로 늘어놓습니다.

          <p>담아 둔 곳은 서른, 마흔이 되기 쉽습니다. 한 칸으로 쌓으면 PC
          브라우저에서 한 화면에 여덟 줄이 들어가고 오른쪽 절반은 빕니다 —
          찾으려면 굴려야 하는데, 굴릴 까닭이 자리가 없어서가 아니라 줄이
          혼자 1000 픽셀을 쓰고 있어서였습니다.
        */}
        <View style={styles.list}>
          {(view === 'list' && bunches.length > 1 ? bunches : [[null, shown] as const]).map(([c, rows]) => (
          <View key={c ?? 'all'}>
          {c ? (
            <SectionHeader title={c} tight action={<Caption tone="secondary">{rows.length}곳</Caption>} />
          ) : null}
          <CardGrid>
            {rows.map((place, at) => (
              <SavedRow
                key={place.id}
                place={place}
                last={at === rows.length - 1}
                selected={picked.has(place.id)}
                lit={activeId === place.id}
                onToggle={() => {
                  setActiveId(place.id);
                  toggle(place.id);
                }}
                /* 줄은 지도로 보냅니다. 들여다보는 판은 지도를 덮으므로 둘을
                   한꺼번에 하면 움직인 지도를 볼 수가 없습니다. */
                onPress={() => setActiveId(place.id)}
                onLook={() => {
                  setActiveId(place.id);
                  setLookingId(place.id);
                }}
              />
            ))}
          </CardGrid>
          </View>
          ))}
        </View>
      </View>

      {/*
        담는 판.

        장소 찾기와 "어디 갈까" 가 여기 함께 있습니다. 둘 다 <b>담을 것을
        구해 오는</b> 일이라 한자리에 있는 것이 맞고, 화면에 늘 펼쳐 둘
        이유는 없습니다.
      */}
      <BottomSheet visible={keeping} title={KEEP} onClose={() => setKeeping(false)}>
        <Caption tone="secondary">
          담아 두면 일정을 아직 안 만들었어도 돼요. 나중에 아무 날에나 꺼내 넣어요.
        </Caption>
        <PlaceSearch onPick={keepFound} />
        <Divider />
        {/* 판 위에 판을 겹치지 않습니다. 겹치면 뒤엣것을 닫을 때 앞엣것까지
            함께 닫히거나, 기기에 따라 아예 안 뜹니다. */}
        <Button
          label="어디 갈까 — 말로 물어보기"
          variant="secondary"
          onPress={() => {
            setKeeping(false);
            setAsking(true);
          }}
        />
      </BottomSheet>

      {/*
        들여다보는 판.

        지도·평점·영업시간·전화는 구글에서 옵니다. 그 위에 우리만 아는 것
        (왜 담았는지, 언제 담았는지, 어느 글에서 담았는지)을 얹습니다.
      */}
      <PlaceDetailSheet
        place={
          looking
            ? {
                name: looking.name,
                lat: looking.lat,
                lng: looking.lng,
                placeId: looking.placeId,
                icon: looking.icon,
              }
            : null
        }
        onClose={() => setLookingId(null)}
        about={
          looking ? (
            <Why
              key={looking.id}
              place={looking}
              onSave={(note) => edit(looking, { note })}
              onOpenPost={(postId) => {
                setLookingId(null);
                router.push({ pathname: '/community/[id]', params: { id: postId } });
              }}
            />
          ) : null
        }
        actions={
          looking ? (
            <Row gap={Spacing.s2} style={styles.actions}>
              <Button
                label="일정에 넣기"
                compact
                onPress={() => {
                  setPicked(new Set([looking.id]));
                  setLookingId(null);
                  setPouring(true);
                }}
              />
              <Button
                label="그림 바꾸기"
                variant="secondary"
                compact
                onPress={() => {
                  setLookingId(null);
                  setTaggingId(looking.id);
                }}
              />
              <Button
                label={UNKEEP}
                variant="dangerText"
                compact
                onPress={() => drop(looking)}
              />
            </Row>
          ) : null
        }
      />

      {tagging ? (
        <BottomSheet visible title={`${tagging.name} 그림`} onClose={() => setTaggingId(null)}>
          <Caption tone="secondary">
            지도에 이 그림으로 찍혀요. 일정에 넣을 때도 그대로 따라가요.
          </Caption>
          <IconPicker
            value={tagging.icon ?? null}
            onChange={(next) => {
              edit(tagging, { icon: next ?? '' });
              setTaggingId(null);
            }}
            noneLabel="별"
          />
        </BottomSheet>
      ) : null}

      {/* 여행에 매이지 않고 묻습니다. 담아 둔 곳들의 한가운데에서 찾습니다. */}
      <RecommendSheet
        visible={asking}
        tripId={null}
        dayId={null}
        onClose={() => setAsking(false)}
        onChanged={reload}
        here={null}
      />

      <BottomSheet visible={aiming} title="어느 여행에 담을까요?" onClose={() => setAiming(false)}>
        <Caption tone="secondary">
          모임 여행이면 「가고 싶은 곳」에 올라가요 — 모두 좋다고 하면 일정이 돼요. 혼자 여행이면 고른 날에 바로 들어가요.
        </Caption>
        {upcoming.length === 0 ? (
          <Caption tone="muted">다가오는 여행이 없어요. 내 여행에서 먼저 만들어 주세요.</Caption>
        ) : null}
        {upcoming.map((t, i) => (
          <ListRow
            key={t.id}
            left={<Mark icon={t.groupId ? 'users' : 'calendar'} />}
            title={t.title}
            subtitle={t.groupId ? `${t.groupName ?? '모임'} · 가고 싶은 곳에 올리기` : '날짜 골라 넣기'}
            last={i === upcoming.length - 1}
            onPress={() => aimAt(t)}
          />
        ))}
      </BottomSheet>

      <DayPicker
        days={aimDays ?? undefined}
        visible={pouring}
        note={`고른 ${picked.size}곳이 그 날 맨 뒤에 붙어요. 순서는 넣은 뒤 바꿀 수 있어요.`}
        onPour={(dayId) =>
          api.post(`/api/days/${dayId}/places/from-saved`, { savedIds: [...picked] })
        }
        onCancel={() => {
          setPouring(false);
          setAimDays(null);
        }}
        onDone={(tripId) => {
          setPouring(false);
          setAimDays(null);
          setPicked(new Set());
          if (tripId) {
            router.push({ pathname: '/trip/[id]', params: { id: tripId } });
          }
        }}
      />
    </Screen>
  );
}

/**
 * 비었을 때 담을 거리 — 지금 뜨는 곳 다섯(저장 단추와 함께)과 인기 여행 셋.
 *
 * <p>빈 화면에 「담아 보세요」만 있으면 어디서 무엇을 담는지를 또 찾아 나서야
 * 합니다. 여기서 바로 담고, 남이 다녀온 여행으로 넘어갈 수 있게 둡니다.
 */
function StarterPicks({ onKept }: { onKept: () => void }) {
  const router = useRouter();
  const { data: top } = useAsync<{ places: PopularPlace[] }>((signal) => api.get('/api/popular/places', signal), []);
  const { data: hot } = useAsync<PostPage>((signal) => api.get('/api/posts?sort=hot', signal), []);
  const [kept, setKept] = useState<Set<string>>(new Set());
  async function keep(p: PopularPlace) {
    if (p.lat == null || p.lng == null || kept.has(p.key)) {
      return;
    }
    try {
      await api.post('/api/saved', { name: p.name, lat: p.lat, lng: p.lng, placeId: p.placeId, icon: p.icon });
      setKept((was) => new Set(was).add(p.key));
      onKept();
    } catch {
      /* 못 담았으면 단추가 그대로라 다시 누를 수 있습니다. */
    }
  }
  return (
    <>
      {(top?.places.length ?? 0) > 0 ? <SectionHeader title="지금 뜨는 곳" tight /> : null}
      {top?.places.slice(0, 5).map((p) => (
        <Row key={p.key} style={styles.starter}>
          <View style={styles.grow}>
            <ListRow left={<Mark icon={glyphOf(p.icon)} />} title={p.name} subtitle={labelOf(p.icon) || undefined} />
          </View>
          <IconButton name="bookmark" label={`${p.name} 저장`} active={kept.has(p.key)} bare onPress={() => keep(p)} />
        </Row>
      ))}
      {(hot?.posts.length ?? 0) > 0 ? <SectionHeader title="인기 여행" tight /> : null}
      {hot?.posts.slice(0, 3).map((post, i, rows) => (
        <ListRow
          key={post.id}
          left={<Mark icon="compass" />}
          title={post.title}
          subtitle={[post.region, `${post.placeCount}곳`].filter(Boolean).join(' · ')}
          last={i === rows.length - 1}
          onPress={() => router.push({ pathname: '/community/[id]', params: { id: post.id } })}
        />
      ))}
    </>
  );
}

/**
 * 왜 담았는지.
 *
 * <h3>이름만 남으면 못 씁니다</h3>
 *
 * <p>담을 때는 대개 아무 말도 안 적힙니다 — 남의 글에서 담으면 그 글의 한
 * 줄이 따라오고, 검색에서 담으면 비어 있습니다. 한 달 뒤에 열면 "야키토리
 * 토리키조쿠 난바점" 만 남아, 그게 왜 거기 있는지 아무도 모릅니다. 그러면
 * 지우지도 못하고 쓰지도 못한 채 쌓이기만 합니다.
 *
 * <p>"규슈 갔을 때 줄 서던 집" 한 줄이면 됩니다.
 *
 * <h3>저장 단추는 고쳤을 때만 뜹니다</h3>
 *
 * <p>늘 서 있으면 아무것도 안 고친 채로 누르게 되고, 누른 사람은 무엇이
 * 저장됐는지 모릅니다. 달라진 것이 있을 때만 냅니다.
 */
function Why({
  place,
  onSave,
  onOpenPost,
}: {
  place: SavedPlace;
  onSave: (note: string) => void;
  onOpenPost: (postId: string) => void;
}) {
  const [note, setNote] = useState(place.note ?? '');
  const dirty = note.trim() !== (place.note ?? '');

  return (
    <View style={styles.why}>
      <Field
        label="왜 담았는지"
        value={note}
        onChangeText={setNote}
        placeholder="규슈 갔을 때 줄 서던 집"
        multiline
        maxLength={300}
      />
      {dirty ? (
        <Row gap={Spacing.s2}>
          <Button label="메모 저장" compact onPress={() => onSave(note.trim())} />
          <Button
            label="되돌리기"
            variant="ghost"
            compact
            onPress={() => setNote(place.note ?? '')}
          />
        </Row>
      ) : null}

      <Row gap={Spacing.s2} style={styles.whence}>
        <Caption tone="muted">{savedAgo(place.createdAt)}</Caption>
        {/* 어느 글에서 담았는지. 검색이나 지도에서 담았으면 비어 있습니다. */}
        {place.fromPost ? (
          <Button
            label="담아 온 글 보기"
            variant="ghost"
            compact
            onPress={() => onOpenPost(place.fromPost as string)}
          />
        ) : null}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  cityRow: {
    gap: Spacing.s2,
  },
  hint: {
    paddingVertical: Spacing.s1,
  },
  starter: {
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  /* 찾는 칸과 거르는 줄. 둘 다 목록을 좁히는 일이라 한 묶음입니다. */
  sift: {
    gap: Spacing.s3,
  },
  applied: {
    flexWrap: 'wrap',
  },
  /* 줄이 저마다 높이와 여백을 가지므로 사이를 벌리지 않습니다. 벌리면
     바탕이 깔린 줄들 사이에 흰 틈이 생겨 줄이 토막토막 끊겨 보입니다. */
  list: {
    gap: 0,
  },
  /* 글자만 빨간 동작. 단추가 아니라서 바탕이 없지만 누르는 넓이는 같습니다. */
  drop: {
    minHeight: Tap.control,
    paddingHorizontal: Spacing.s4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 주 동작은 곁다리의 두 배 폭을 먹습니다. */
  lead: {
    flex: 2,
  },
  why: {
    gap: Spacing.s2,
  },
  whence: {
    alignItems: 'center',
  },
  actions: {
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
