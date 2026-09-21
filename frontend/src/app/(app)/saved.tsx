import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { SavedPlace, TripDetail, TripSummary } from '@/api/types';
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
import { labelOf } from '@/constants/place-icons';
import { Colors, Spacing } from '@/constants/theme';
import { kindsIn, savedAgo, siftSaved } from '@/lib/saved';
import {
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ConfirmButton,
  Divider,
  Empty,
  ErrorNote,
  Field,
  FilterChip,
  Grow,
  Loading,
  Row,
  Screen,
  SearchField,
  Snack,
  Split,
  useUndo,
} from '@/ui';
import { AppTabs } from '@/ui/tab-bar';

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

  const { data, error, loading, reload, setData } = useAsync<{ places: SavedPlace[] }>(
    (signal) => api.get('/api/saved', signal),
    [],
  );

  const all = useMemo(() => data?.places ?? [], [data]);
  const kinds = useMemo(() => kindsIn(all), [all]);
  const shown = useMemo(() => siftSaved(all, { q, kind, by }), [all, q, kind, by]);

  /**
   * 지금 걸려 있는 것들. 밖에 내놓을 것과 개수를 여기서 한 번에 셉니다.
   *
   * <p>찾는 말은 안 넣습니다 — 칸이 밖에 그대로 서 있어서 거기 적힌 것이
   * 곧 조건입니다. 칩으로 한 번 더 적으면 같은 말이 두 군데 있습니다.
   */
  const applied: { key: string; label: string; clear: () => void }[] = [
    kind !== null
      ? { key: 'kind', label: labelOf(kind) || '갈래', clear: () => setKind(null) }
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
            ? `「${targets[0].name}」 를 뺐습니다.`
            : `${targets.length}곳을 뺐습니다.`,
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

  async function drop(id: string) {
    setFailed(null);
    setLookingId(null);
    try {
      await api.delete(`/api/saved/${id}`);
      setPicked((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      reload();
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
      tabs={<AppTabs />}
      snack={<Snack undo={undo} onHide={hideUndo} />}
      footer={
        picked.size > 0 ? (
          <Row gap={Spacing.sm}>
            <Grow>
              <Button label={`${picked.size}곳 일정에 넣기`} onPress={() => setPouring(true)} />
            </Grow>
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
            */}
            <Button
              label="빼기"
              variant="secondary"
              onPress={() => dropPicked()}
            />
          </Row>
        ) : undefined
      }>
      {/*
        지도가 먼저입니다.

        전에는 설명 한 줄과 단추가 맨 위에 서고 지도는 그 아래 회색 네모로
        끼여 있었습니다. 그런데 보석함을 열고 가장 먼저 하는 일은 <b>어디에
        뭘 담아 뒀는지</b> 보는 것입니다 — "오사카에서 담은 게 뭐였지" 는
        목록을 훑어서는 안 나오고 지도를 봐야 나옵니다.

        사진을 안 올리는 앱이라 화면의 무게를 질 것이 지도밖에 없기도 합니다.
        문토나 무신사가 사진으로 하는 일을 여기서는 지도가 합니다.
      */}
      {pins.length > 0 ? (
        <TripMap
          places={pins}
          activeId={activeId}
          onSelect={setActiveId}
          link={false}
          /* 전부 같은 동그라미에 별 하나. 담아 둔 곳에는 순서가 없고, 갈래는
             아래 거르기가 이미 말해 줍니다. */
          shape="star"
          height={300}
        />
      ) : null}

      <Split>
        <Grow>
          <Body tone="secondary">
            {all.length > 0
              ? `주워 둔 ${all.length}곳. 골라서 일정 아무 날에나 얹습니다.`
              : '눈에 띄는 곳을 담아 두었다가 일정에 꺼내 씁니다.'}
          </Body>
        </Grow>
        <Button label="담기" compact onPress={() => setKeeping(true)} />
      </Split>

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {data && all.length === 0 ? (
        <Empty message="아직 주워 둔 보석이 없습니다. 여행 둘러보기나 장소 찾기에서 별을 누르면 여기 쌓입니다. 위 「담기」 로 바로 찾아 담을 수도 있습니다." />
      ) : null}

      {/* 몇 개 안 될 때는 찾을 것이 없습니다. 칸만 자리를 차지합니다. */}
      {all.length > 4 ? (
        <SearchField
          label="보석함에서 찾기"
          value={q}
          onChangeText={setQ}
          placeholder="국밥, 온천, 도톤보리"
        />
      ) : null}

      {/*
        갈래와 정렬도 판 안으로.

        갈래 칩이 여덟이면 좁은 폰에서 두 줄이고, 그 아래 정렬이 또 한 줄
        입니다. 담아 둔 것을 보러 왔는데 그것이 늘 화면 밖에서 시작했습니다.
        둘러보기와 같은 방식으로 섭니다 — 고를 수 있는 것은 판 안에, 밖에는
        고른 것만.
      */}
      {kinds.length > 1 || all.length > 2 ? (
        <Split>
          <Row gap={Spacing.xs} style={styles.applied}>
            <Button
              label={applied.length > 0 ? `조건 ${applied.length}` : '조건'}
              variant="secondary"
              compact
              onPress={() => setSifting(true)}
            />
            {applied.map((a) => (
              <FilterChip key={a.key} label={a.label} onRemove={a.clear} />
            ))}
          </Row>
          <Caption tone="secondary">{shown.length}곳</Caption>
        </Split>
      ) : null}

      {/* 몇 곳이 남는지를 판을 닫기 전에 말합니다. 여기 목록은 이미 받아
          둔 것을 거르는 것이라 개수가 곧바로 따라옵니다. */}
      <BottomSheet
        visible={sifting}
        title="조건"
        onClose={() => setSifting(false)}
        footer={
          <Button label={`결과 ${shown.length}곳 보기`} onPress={() => setSifting(false)} />
        }>
        {kinds.length > 1 ? (
          <>
            <Body small strong>
              갈래
            </Body>
            <Row gap={Spacing.xs} style={styles.applied}>
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
            q.trim() ? `"${q.trim()}" 로는 찾은 것이 없습니다.` : '이 갈래에는 아직 없습니다.'
          }
        />
      ) : null}

      <View style={styles.list}>
        {shown.map((place) => (
          <SavedRow
            key={place.id}
            place={place}
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
      </View>

      {/*
        담는 판.

        장소 찾기와 "어디 갈까" 가 여기 함께 있습니다. 둘 다 <b>담을 것을
        구해 오는</b> 일이라 한자리에 있는 것이 맞고, 화면에 늘 펼쳐 둘
        이유는 없습니다.
      */}
      <BottomSheet visible={keeping} title="보석함에 담기" onClose={() => setKeeping(false)}>
        <Caption tone="secondary">
          담아 두면 일정을 아직 안 만들었어도 됩니다. 나중에 아무 날에나 꺼내 넣습니다.
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
            <Row gap={Spacing.sm} style={styles.actions}>
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
              <ConfirmButton
                label="보석함에서 빼기"
                confirmLabel="뺍니다"
                onConfirm={() => drop(looking.id)}
              />
            </Row>
          ) : null
        }
      />

      {tagging ? (
        <BottomSheet visible title={`${tagging.name} 그림`} onClose={() => setTaggingId(null)}>
          <Caption tone="secondary">
            지도에 이 그림으로 찍힙니다. 일정에 넣을 때도 그대로 따라갑니다.
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

      <DayPicker
        visible={pouring}
        note={`고른 ${picked.size}곳이 그 날 맨 뒤에 붙습니다. 순서는 넣은 뒤 바꿀 수 있습니다.`}
        onPour={(dayId) =>
          api.post(`/api/days/${dayId}/places/from-saved`, { savedIds: [...picked] })
        }
        onCancel={() => setPouring(false)}
        onDone={(tripId) => {
          setPouring(false);
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
        <Row gap={Spacing.sm}>
          <Button label="메모 저장" compact onPress={() => onSave(note.trim())} />
          <Button
            label="되돌리기"
            variant="ghost"
            compact
            onPress={() => setNote(place.note ?? '')}
          />
        </Row>
      ) : null}

      <Row gap={Spacing.sm} style={styles.whence}>
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
  grow: {
    flex: 1,
  },
  applied: {
    flexWrap: 'wrap',
  },
  list: {
    gap: Spacing.xs,
  },
  why: {
    gap: Spacing.sm,
  },
  whence: {
    alignItems: 'center',
  },
  actions: {
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
