import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, query } from '@/api/client';
import type { PopularKind, PopularPlace, PopularRegion } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { PlaceDetailSheet, type Looked } from '@/components/place-detail-sheet';
import { iconOf, labelOf } from '@/constants/place-icons';
import { Spacing } from '@/constants/theme';
import {
  Body,
  Caption,
  Card,
  Chip,
  Empty,
  ErrorNote,
  Grow,
  Loading,
  Mark,
  Press,
  Row,
  Screen,
  SegmentedTabs,
  Split,
  Subtitle,
} from '@/ui';

type Tab = 'places' | 'regions';

const TABS: { value: Tab; label: string }[] = [
  { value: 'places', label: '장소' },
  { value: 'regions', label: '지역' },
];

/**
 * 여럿이 간 곳.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>처음 온 사람의 홈은 텅 비어 있습니다. "첫 여행을 만들어 보세요" 라고만
 * 하면 무엇을 만들어야 할지가 그대로 숙제로 남습니다. 남들이 어디를 갔는지
 * 보이면 거기서 시작할 수 있습니다.
 *
 * <h3>따로 채워 두지 않습니다</h3>
 *
 * <p>올라온 글을 그때그때 세어 만듭니다. 운영자가 고른 목록이 아니라서
 * 손댈 것이 없고, 글이 없으면 목록도 비어 있습니다 — 그때는 화면이 없는
 * 것을 있는 척하지 않습니다.
 *
 * <p>한 글에서 같은 곳을 두 번 넣었어도 한 번으로 셉니다. 사흘 내내 같은
 * 카페에 갔다고 그 카페가 세 배 인기 있는 것은 아닙니다.
 */
export default function Popular() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('places');
  /** 갈래로 거르고 있는 것. 비우면 전부. */
  const [kind, setKind] = useState<string | null>(null);
  /** 들여다보는 중인 곳. */
  const [looking, setLooking] = useState<Looked | null>(null);

  /* 글에 실제로 쓰인 갈래만 받습니다. 열여섯 개를 다 늘어놓으면 대부분
     눌러도 아무것도 안 걸립니다. */
  const { data: kinds } = useAsync<{ kinds: PopularKind[] }>(
    (signal) => api.get('/api/popular/kinds', signal),
    [],
  );

  const {
    data: places,
    loading: loadingPlaces,
    error: placeError,
    reload: reloadPlaces,
  } = useAsync<{ places: PopularPlace[] }>(
    (signal) => api.get(`/api/popular/places${query({ kind })}`, signal),
    [kind],
  );

  const {
    data: regions,
    loading: loadingRegions,
    error: regionError,
    reload: reloadRegions,
  } = useAsync<{ regions: PopularRegion[] }>(
    (signal) => api.get('/api/popular/regions', signal),
    [],
  );

  return (
    <Screen>
      <SegmentedTabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'places' ? (
        <>
          <Caption tone="secondary">
            올라온 일정에 여럿이 넣은 곳입니다. 한 일정에서 여러 번 넣었어도 한 번으로
            셉니다.
          </Caption>

          {/* 갈래가 둘 이상일 때만 냅니다. 하나뿐이면 누를 것이 없습니다. */}
          {(kinds?.kinds.length ?? 0) > 1 ? (
            <Row gap={Spacing.xs} style={styles.chips}>
              <Chip label="전체" selected={kind === null} onPress={() => setKind(null)} />
              {kinds?.kinds.map((k) => (
                <Chip
                  key={k.kind}
                  label={`${iconOf(k.kind)} ${labelOf(k.kind)}`}
                  selected={kind === k.kind}
                  onPress={() => setKind(kind === k.kind ? null : k.kind)}
                />
              ))}
            </Row>
          ) : null}

          {loadingPlaces && !places ? <Loading /> : null}
          {placeError ? <ErrorNote message={placeError} onRetry={reloadPlaces} /> : null}

          {places && places.places.length === 0 ? (
            <Empty
              message={
                kind
                  ? '이 갈래로는 아직 올라온 곳이 없습니다.'
                  : '아직 올라온 일정이 없습니다. 첫 번째가 되어 보세요.'
              }
            />
          ) : null}

          <View style={styles.list}>
            {places?.places.map((place, i) => (
              <Rank
                key={place.key}
                at={i + 1}
                mark={<Mark emoji={iconOf(place.icon)} fallback="📍" />}
                title={place.name}
                sub={[labelOf(place.icon), `일정 ${place.posts}개에`].filter(Boolean).join(' · ')}
                onPress={
                  place.lat != null && place.lng != null
                    ? () =>
                        setLooking({
                          name: place.name,
                          lat: place.lat as number,
                          lng: place.lng as number,
                          placeId: place.placeId,
                          icon: place.icon,
                        })
                    : undefined
                }
              />
            ))}
          </View>
        </>
      ) : (
        <>
          <Caption tone="secondary">여럿이 다녀온 지역입니다. 누르면 그 지역 글만 봅니다.</Caption>

          {loadingRegions && !regions ? <Loading /> : null}
          {regionError ? <ErrorNote message={regionError} onRetry={reloadRegions} /> : null}

          {regions && regions.regions.length === 0 ? (
            <Empty message="아직 올라온 일정이 없습니다. 첫 번째가 되어 보세요." />
          ) : null}

          <View style={styles.list}>
            {regions?.regions.map((r, i) => (
              <Rank
                key={r.region}
                at={i + 1}
                title={r.region}
                sub={`일정 ${r.posts}개${r.likes > 0 ? ` · 추천 ${r.likes}` : ''}`}
                onPress={() => router.push(`/community?region=${encodeURIComponent(r.region)}`)}
              />
            ))}
          </View>
        </>
      )}

      <PlaceDetailSheet place={looking} onClose={() => setLooking(null)} />
    </Screen>
  );
}

/**
 * 순위 한 줄.
 *
 * <p>번호를 답니다. 순위는 위에서부터 읽으면 알 수 있지만, 번호가 없으면
 * 훑어 내려가다 지금 몇 번째를 보고 있는지 놓칩니다.
 *
 * <p>앞의 셋만 진하게 둡니다. 열 줄이 모두 같은 무게면 순위가 아니라 그냥
 * 목록입니다.
 */
function Rank({
  at,
  mark,
  title,
  sub,
  onPress,
}: {
  at: number;
  mark?: React.ReactNode;
  title: string;
  sub: string;
  onPress?: () => void;
}) {
  const body = (
    <Row gap={Spacing.md} style={styles.rank}>
      <Body strong={at <= 3} tone={at <= 3 ? 'default' : 'muted'} style={styles.at}>
        {at}
      </Body>
      {mark}
      <Grow gap={2}>
        <Body strong numberOfLines={1}>
          {title}
        </Body>
        <Caption tone="secondary">{sub}</Caption>
      </Grow>
    </Row>
  );

  if (!onPress) {
    return <Card style={styles.card}>{body}</Card>;
  }
  return (
    <Press onPress={onPress} scale={0.99} accessibilityLabel={`${title} 자세히`}>
      <Card style={styles.card}>{body}</Card>
    </Press>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexWrap: 'wrap',
  },
  list: {
    gap: Spacing.xs,
  },
  card: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rank: {
    alignItems: 'center',
  },
  /* 번호가 한 자리든 두 자리든 이름이 같은 자리에서 시작해야 합니다. */
  at: {
    width: 20,
    textAlign: 'center',
  },
});
