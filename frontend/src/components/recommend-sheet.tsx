import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
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
  Field,
  Loading,
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
  dayLabel,
  here,
  onClose,
  onChanged,
}: {
  visible: boolean;
  tripId: string;
  /** 어느 날에 넣을지. 있으면 그 날짜로 영업 여부를 봅니다. */
  dayId: string | null;
  dayLabel: string | null;
  /** 지금 서 있는 자리. 있으면 여행의 한가운데보다 이쪽을 먼저 봅니다. */
  here: { lat: number; lng: number } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [result, setResult] = useState<Recommended | null>(null);
  /** 이미 담은 것. 눌렀는데 아무 일도 안 일어난 것처럼 보이지 않게. */
  const [kept, setKept] = useState<Record<string, Where>>({});

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

      const got = await api.post<Recommended>(`/api/trips/${tripId}/recommend`, {
        query: q,
        dayId,
        /* 주소가 아니라 본문으로 보냅니다. 어디 있는지는 접근 기록에 남길
           값이 아닙니다. */
        here,
        intent,
      });
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
      if (where === 'trip' && dayId) {
        await api.post('/api/places', { dayId, ...body });
      } else if (where === 'candidate') {
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
        {dayLabel
          ? `${dayLabel} 기준으로 찾습니다. 그날 문 여는지도 함께 봅니다.`
          : '이 여행에 넣어 둔 곳들 언저리에서 찾습니다.'}
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

      {result?.places.map((card) => (
        <View key={`${card.name}${card.placeId ?? ''}`} style={styles.card}>
          <Divider />

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

          {kept[card.name] ? (
            <Caption tone="success" strong>
              {KEPT[kept[card.name]]}
            </Caption>
          ) : (
            <Row gap={Spacing.sm}>
              {dayId ? (
                <Button label="일정에" compact onPress={() => keep(card, 'trip')} />
              ) : null}
              <Button
                label="투표장에"
                variant="secondary"
                compact
                onPress={() => keep(card, 'candidate')}
              />
              <Button
                label="보석함에"
                variant="ghost"
                compact
                onPress={() => keep(card, 'saved')}
              />
            </Row>
          )}
        </View>
      ))}

      {/* 구글 약관이 요구하는 표시입니다. 결과가 있을 때만 답니다. */}
      {result && result.places.length > 0 ? (
        <Caption tone="muted">제공: Google</Caption>
      ) : null}
    </BottomSheet>
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
