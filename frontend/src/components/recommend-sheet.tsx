import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import {
  SORT_GIVEN,
  SORT_NEAR,
  SORT_RATING,
  SortBar,
  sortPlaces,
  type SortBy,
} from '@/components/sort-bar';
import { iconOf } from '@/constants/place-icons';
import type { IntentState } from '@/lib/intent-types';
import { canParseHere, fetchModel, intentState, modelNote, parseIntent } from '@/lib/intent';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  Divider,
  ErrorNote,
  Chip,
  Field,
  Loading,
  Press,
  Row,
} from '@/ui';

/**
 * 말로 묻고 갈 곳을 받습니다.
 *
 * <p>이름으로 찾는 칸과 나란히 두되 섞지 않습니다. 이름으로 찾는 것과 말로
 * 묻는 것은 기대하는 답이 다릅니다 — 전자는 "그것" 을 원하고 후자는 "그런
 * 것들" 을 원합니다. 한 칸에 합치면 "난바 파크스" 를 넣었을 때도 추천 여섯
 * 개가 나와 방해가 됩니다.
 *
 * <p>카드마다 갈 길이 셋입니다. 그중 <b>투표장에 올리기</b> 가 특히
 * 중요합니다 — 추천은 본래 확정이 아니라 의견이고, 투표장이 그 의견을
 * 동행자 전원의 합의로 바꾸는 자리를 이미 갖고 있습니다.
 */
export function RecommendSheet({
  visible,
  tripId,
  dayId,
  days = [],
  here,
  onClose,
  onChanged,
}: {
  visible: boolean;
  /** 매인 여행. 없으면 보석함에서 물은 것입니다. */
  tripId: string | null;
  /**
   * 여행 상세에서 이미 골라 둔 날.
   *
   * <p>날짜 하나를 보고 있다가 열었으면 그 날로 시작합니다. 전체를 보다가
   * 열었으면 비어 있고, 판 안에서 고릅니다.
   */
  dayId: string | null;
  /**
   * 이 여행의 날들.
   *
   * <p>기준점은 여기서 나옵니다 — 먼저 날을 고르고, 그 날의 장소 중에서
   * 고릅니다. 여행 전부를 한 줄에 늘어놓으면 닷새짜리는 스무 개가 넘어가고,
   * 그때부터는 고르는 것이 아니라 훑는 일이 됩니다.
   */
  days?: {
    id: string;
    label: string;
    iso: string | null;
    places: { id: string; name: string; lat: number; lng: number }[];
    /** 그날 잘 곳. 아침 먹을 데를 찾을 때 가장 자주 쓰는 기준입니다. */
    stay?: { name: string; lat: number; lng: number } | null;
  }[];
  /** 지금 서 있는 자리. 있으면 여행의 한가운데보다 이쪽을 먼저 봅니다. */
  here: { lat: number; lng: number } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');
  /*
    어디를 기준으로 찾을지.

    비워 두면 여행 전체(핀들의 한가운데)입니다. 그런데 실제로 묻는 것은
    대개 "숙소 근처", "이 절 근처" 처럼 한 곳을 기준으로 한 물음입니다.
    여행 전체의 한가운데는 아무 데도 아닌 논밭일 때가 있습니다.

    'here' 는 지금 서 있는 자리입니다 — 길 위에서 묻는 것은 대개 그 뜻입니다.
  */
  const [from, setFrom] = useState<string | null>(null);
  /*
    어느 날을 볼지.

    기준점을 고르기 전에 날부터 좁힙니다. 그리고 이 날은 "그날 문 여는지" 를
    보는 기준이기도 합니다 — 셋째 날에 갈 곳을 찾는데 오늘 영업시간을 보면
    아무 뜻이 없습니다.
  */
  const [onDay, setOnDay] = useState<string | null>(dayId);

  /* 판을 열 때마다 보고 있던 날로 맞춥니다. 안 그러면 이틀째를 보다 닫고
     사흘째에서 다시 열었을 때 이틀째가 골라진 채로 뜹니다. */
  useEffect(() => {
    if (visible) {
      setOnDay(dayId);
      setFrom(null);
    }
  }, [visible, dayId]);

  const day = days.find((d) => d.id === onDay) ?? null;
  /* 잘 곳을 맨 앞에 둡니다. "숙소 근처 아침 먹을 데" 가 이 판에서 가장
     자주 묻는 것입니다. */
  const anchors = day
    ? [
        ...(day.stay
          ? [{ id: 'stay', name: `🏠 ${day.stay.name}`, lat: day.stay.lat, lng: day.stay.lng }]
          : []),
        ...day.places,
      ]
    : [];


  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [result, setResult] = useState<Recommended | null>(null);
  /** 이미 담은 것. 눌렀는데 아무 일도 안 일어난 것처럼 보이지 않게. */
  const [kept, setKept] = useState<Record<string, Where>>({});
  /** 들여다보는 중인 곳. 카드를 누르면 지도와 사정이 뜹니다. */
  const [looking, setLooking] = useState<Card | null>(null);
  /* 서버가 준 순서는 구글이 매긴 순서입니다. 고르는 눈은 그것 하나가
     아닙니다. */
  const [by, setBy] = useState<SortBy>('given');
  /*
    세운 순서.

    서버가 이미 거리를 재 두었으므로(distanceM) 가까운순은 그것으로 셉니다.
    기준을 어디로 잡았든 서버가 잰 그 기준이라, 화면이 다시 재면 도리어
    어긋납니다.
  */
  const sorted = useMemo(() => {
    const list = result?.places ?? [];
    if (by === 'near') {
      return [...list].sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9));
    }
    return sortPlaces(list, by);
  }, [result, by]);

  /*
    기기 안에서 먼저 쪼개기.

    "혼자 조용히 있고 싶은 곳" 은 우리 서버도 알 필요가 없습니다. 기기에
    모델이 있으면 그 문장을 여기서 인자로 쪼개고, 서버로 나가는 것은 쪼갠
    값입니다.

    없으면 문장을 그대로 보냅니다. 그래도 추천은 그대로 돕니다 — 조금 덜
    맞을 뿐입니다. 그래서 이것을 켜라고 조르지 않습니다.
  */
  const [brain, setBrain] = useState<IntentState>(() => intentState());
  const [pulling, setPulling] = useState(0);

  async function pullModel() {
    setBrain('fetching');
    const ok = await fetchModel((p) => setPulling(p));
    setBrain(ok ? 'ready' : 'absent');
  }

  async function ask() {
    const q = query.trim();
    if (!q || busy) {
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      /* 기기에 모델이 있으면 여기서 먼저 쪼갭니다. 못 쪼개면 null 이고,
         그때는 문장이 그대로 갑니다. */
      const intent = brain === 'ready' ? await parseIntent(q) : null;

      /* 여행에 매여 있으면 그 여행의 맥락으로, 아니면(보석함에서 물었으면)
         담아 둔 곳들의 한가운데로 찾습니다. */
      const at =
        from === 'here'
          ? here
          : (anchors.find((a) => a.id === from) ?? null);

      setBy('given');
      const got = await api.post<Recommended>(
        tripId ? `/api/trips/${tripId}/recommend` : '/api/recommend',
        {
          query: q,
          dayId: onDay,
          /* 주소가 아니라 본문으로 보냅니다. 어디 있는지는 접근 기록에 남길
             값이 아닙니다. */
          here: at ? { lat: at.lat, lng: at.lng } : null,
          intent,
        },
      );
      setResult(got);
      setKept({});
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function keep(card: Card, where: Where) {
    const body = {
      name: card.name,
      lat: card.lat,
      lng: card.lng,
      placeId: card.placeId,
      icon: card.icon,
    };
    try {
      if (where === 'trip' && onDay) {
        await api.post('/api/places', { dayId: onDay, ...body });
      } else if (where === 'candidate' && tripId) {
        await api.post(`/api/trips/${tripId}/candidates`, body);
      } else {
        await api.post('/api/saved', body);
      }
      setKept((was) => ({ ...was, [card.name]: where }));
      onChanged();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <BottomSheet visible={visible} title="어디 갈지 물어보기" onClose={onClose}>
      <Caption tone="secondary">
        {day
          ? `${day.label} 기준으로 찾습니다. 그날 문 여는지도 함께 봅니다.`
          : tripId
            ? '이 여행에 넣어 둔 곳들 언저리에서 찾습니다. 날을 고르면 그날 문 여는지도 봅니다.'
            : '보석함에 담아 둔 곳들 언저리에서 찾습니다.'}
      </Caption>

      <Field
        label="무엇을 찾으세요?"
        value={query}
        onChangeText={setQuery}
        placeholder="비 올 때 갈 만한 실내"
        hint="이름이 아니라 하고 싶은 것을 적어 주세요."
        returnKeyType="search"
        onSubmitEditing={ask}
        action={{
          icon: 'search',
          label: '물어보기',
          disabled: !query.trim() || busy,
          onPress: ask,
        }}
      />

      {/*
        어디를 기준으로 찾을지.

        여행 전체의 한가운데는 아무 데도 아닌 논밭일 때가 있습니다. 실제로
        묻는 것은 대개 "숙소 근처 아침 먹을 데" 처럼 한 곳을 기준으로 한
        물음입니다.
      */}
      {/* 먼저 날을 좁힙니다. 여행 전부의 장소를 한 줄에 늘어놓으면 닷새짜리는
          스무 개가 넘어가고, 그때부터는 고르는 것이 아니라 훑는 일이 됩니다. */}
      {days.length > 0 ? (
        <View style={styles.from}>
          <Caption tone="secondary">어느 날 갈 곳인가요?</Caption>
          <Row gap={Spacing.xs} style={styles.chips}>
            <Chip
              label="아직 모름"
              selected={onDay === null}
              onPress={() => {
                setOnDay(null);
                setFrom(null);
              }}
            />
            {days.map((d) => (
              <Chip
                key={d.id}
                label={d.label}
                selected={onDay === d.id}
                onPress={() => {
                  setOnDay(onDay === d.id ? null : d.id);
                  /* 날이 바뀌면 기준으로 골라 둔 장소는 그 날의 것이
                     아닙니다. 함께 풉니다. */
                  setFrom(null);
                }}
              />
            ))}
          </Row>
        </View>
      ) : null}

      {here || anchors.length > 0 ? (
        <View style={styles.from}>
          <Caption tone="secondary">어디 근처에서 찾을까요?</Caption>
          <Row gap={Spacing.xs} style={styles.chips}>
            <Chip
              label={
                day ? `${day.label} 언저리` : tripId ? '여행 전체' : '담아 둔 곳 언저리'
              }
              selected={from === null}
              onPress={() => setFrom(null)}
            />
            {here ? (
              <Chip
                label="지금 내 자리"
                selected={from === 'here'}
                onPress={() => setFrom(from === 'here' ? null : 'here')}
              />
            ) : null}
            {anchors.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={from === a.id}
                onPress={() => setFrom(from === a.id ? null : a.id)}
              />
            ))}
          </Row>
        </View>
      ) : null}

      {/*
        기기 안에서 쪼개기.

        조르지 않습니다 — 없어도 추천은 그대로 돕니다. 한 번 접어 두고,
        받을지는 사람이 정합니다. 1GB 는 아무 데서나 받을 크기가 아닙니다.
      */}
      {canParseHere && brain !== 'ready' ? (
        brain === 'fetching' ? (
          <Caption tone="secondary">
            기기에 넣을 모델을 받는 중입니다 ({Math.round(pulling * 100)}%). 그동안에도 물어볼 수
            있습니다.
          </Caption>
        ) : (
          <Row gap={Spacing.sm} style={styles.brain}>
            <View style={styles.grow}>
              <Caption tone="secondary">
                지금은 물어본 문장이 서버를 거쳐 구글로 갑니다. 여기서 먼저 추리게 하면 문장은
                이 기기 밖으로 나가지 않습니다. {modelNote()}
              </Caption>
            </View>
            <Button label="받기" variant="ghost" compact onPress={pullModel} />
          </Row>
        )
      ) : null}

      {canParseHere && brain === 'ready' ? (
        <Caption tone="success">이 문장은 이 기기 밖으로 나가지 않습니다.</Caption>
      ) : null}

      {busy ? <Loading label="찾는 중" /> : null}
      {failed ? <ErrorNote message={failed} /> : null}

      {result?.note ? <Caption tone="secondary">{result.note}</Caption> : null}

      {result && result.places.length > 1 ? (
        <SortBar
          options={
            result.places.some((c) => c.distanceM != null)
              ? [SORT_GIVEN, SORT_RATING, SORT_NEAR]
              : [SORT_GIVEN, SORT_RATING]
          }
          value={by}
          onChange={setBy}
        />
      ) : null}

      {sorted.map((card) => (
        <View key={`${card.name}${card.placeId ?? ''}`} style={styles.card}>
          <Divider />

          {/* 이름과 평점만으로는 두 곳을 견줄 수가 없습니다. 누르면 지도에
              찍어 보고 영업시간까지 봅니다. */}
          <Press
            onPress={() => setLooking(card)}
            scale={0.995}
            accessibilityLabel={`${card.name} 자세히 보기`}>
          <Row gap={Spacing.sm} style={styles.head}>
            <Body strong numberOfLines={2}>
              {`${iconOf(card.icon)} ${card.name}`.trim()}
            </Body>
            {/* 이미 어딘가에 있는 곳이면 먼저 말해 줍니다. 모르면 같은 곳을
                또 담게 됩니다. */}
            {card.already ? <Badge label={WHERE[card.already]} tone="muted" /> : null}
          </Row>

          <Caption tone="secondary" numberOfLines={2}>
            {card.address}
          </Caption>

          <Row gap={Spacing.sm}>
            {card.rating ? (
              <Caption tone="secondary">
                ★ {card.rating.toFixed(1)}
                {card.ratingCount ? ` (${card.ratingCount.toLocaleString()})` : ''}
              </Caption>
            ) : null}
            {card.distanceM != null ? (
              <Caption tone="secondary">{km(card.distanceM)}</Caption>
            ) : null}
            {/* 그날 쉬는 곳은 눈에 띄게. 추천받아서 갔더니 휴무는 추천을
                안 하느니만 못합니다. */}
            {card.openOnDay === false ? (
              <Caption tone="danger" strong>
                그날 쉽니다
              </Caption>
            ) : null}
          </Row>
          </Press>

          <Keep card={card} kept={kept} onKeep={keep} dayId={onDay} inTrip={!!tripId} />
        </View>
      ))}

      <PlaceDetailSheet
        place={looking}
        onIso={day?.iso ?? null}
        here={here}
        onClose={() => setLooking(null)}
        actions={looking ? <Keep card={looking} kept={kept} onKeep={keep} dayId={onDay} inTrip={!!tripId} /> : null}
      />

      {/* 구글 약관이 요구하는 표시입니다. 결과가 있을 때만 답니다. */}
      {result && result.places.length > 0 ? (
        <Caption tone="muted">제공: Google</Caption>
      ) : null}
    </BottomSheet>
  );
}

/**
 * 이 곳을 어디에 담을지.
 *
 * <p>카드 아래에도, 들여다보는 판 안에도 같은 것이 섭니다. 두 곳에 따로
 * 적어 두면 한쪽만 고쳤을 때 같은 자리에서 다른 것이 됩니다.
 */
function Keep({
  card,
  kept,
  onKeep,
  dayId,
  inTrip,
}: {
  card: Card;
  kept: Record<string, Where>;
  onKeep: (card: Card, where: Where) => void;
  dayId: string | null;
  inTrip: boolean;
}) {
  if (kept[card.name]) {
    return (
      <Caption tone="success" strong>
        {KEPT[kept[card.name]]}
      </Caption>
    );
  }
  return (
    <Row gap={Spacing.sm}>
      {dayId ? <Button label="일정에" compact onPress={() => onKeep(card, 'trip')} /> : null}
      {/* 투표장은 여행에 딸린 자리입니다. 보석함에서 물었으면 갈 데가 없습니다. */}
      {inTrip ? (
        <Button
          label="투표장에"
          variant="secondary"
          compact
          onPress={() => onKeep(card, 'candidate')}
        />
      ) : null}
      <Button label="보석함에" variant="ghost" compact onPress={() => onKeep(card, 'saved')} />
    </Row>
  );
}

/** 담아 둘 수 있는 세 자리. */
type Where = 'trip' | 'candidate' | 'saved';

const WHERE: Record<Where, string> = {
  trip: '일정에 있음',
  candidate: '투표장에 있음',
  saved: '보석함에 있음',
};

const KEPT: Record<Where, string> = {
  trip: '일정에 넣었습니다.',
  candidate: '투표장에 올렸습니다.',
  saved: '보석함에 담았습니다.',
};

type Card = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  icon: string | null;
  rating: number | null;
  ratingCount: number | null;
  /** 고른 날에 문을 여는지. 날짜를 안 골랐으면 비어 있습니다. */
  openOnDay: boolean | null;
  distanceM: number | null;
  already: Where | null;
};

type Recommended = { places: Card[]; note: string | null };

/** 1km 아래는 미터로. "3247m" 는 읽으라고 쓴 글자가 아닙니다. */
function km(meters: number) {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs,
  },
  from: {
    gap: Spacing.xs,
  },
  chips: {
    flexWrap: 'wrap',
  },
  brain: {
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  head: {
    alignItems: 'center',
  },
});
