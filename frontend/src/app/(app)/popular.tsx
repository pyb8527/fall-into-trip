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
  Empty,
  ErrorNote,
  Grow,
  Loading,
  Mark,
  Picker,
  Press,
  Row,
  Screen,
  SegmentedTabs,
  Split,
  Subtitle,
} from '@/ui';
import { AppTabs } from '@/ui/tab-bar';

type Tab = 'places' | 'regions';

const TABS: { value: Tab; label: string }[] = [
  { value: 'places', label: '장소' },
  { value: 'regions', label: '지역' },
];

/**
 * 지금 뜨는 여행지.
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
  /*
    지역으로도 거릅니다.

    <p>갈래만으로 거르면 "카페" 를 눌렀을 때 도쿄와 제주가 한 목록에 섞여
    나옵니다. 정작 보는 사람은 대개 <b>갈 곳을 하나 정해 두고</b> 봅니다.
  */
  const [region, setRegion] = useState<string | null>(null);

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
    (signal) => api.get(`/api/popular/places${query({ kind, region })}`, signal),
    [kind, region],
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
    <Screen tabs={<AppTabs />}>
      <SegmentedTabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'places' ? (
        <>
          {/* 이 화면이 무엇인지 말하는 한 줄입니다. 회색 바탕에 두면 가장
              먼저 읽어야 하는 글자가 가장 허름한 자리에 놓입니다. */}
          <Card>
            <Caption tone="secondary">
              올라온 여행에 여럿이 넣은 곳이에요. 한 여행에서 여러 번 넣었어도 한 번으로
              세어요.
            </Caption>
          </Card>

          {/*
            고르는 칸 둘.

            <p>갈래를 칩으로 늘어놓고 있었습니다. 열댓 개가 두세 줄로 접혀
            화면 위쪽을 통째로 먹었는데, 고르는 일은 가끔 한 번이고 나머지
            시간에는 고른 결과를 봅니다.

            <p>한 줄로 접습니다. 그러면서 남은 자리에 지역을 하나 더
            들입니다 — 전에는 칩만으로도 꽉 차 둘째 조건을 놓을 데가
            없었습니다.
          */}
          <Card>
          <Row gap={Spacing.xs} style={styles.chips}>
            {(kinds?.kinds.length ?? 0) > 1 ? (
              <Picker
                /* "갈래" 는 일상에서 잘 안 쓰는 말이라 무엇을 고르는 칸인지
                   한 번 생각해야 했습니다. 옆 칸이 "지역" 이니 같은 무게의
                   쉬운 말로 맞춥니다. */
                label="어떤 곳"
                value={kind}
                onChange={setKind}
                options={(kinds?.kinds ?? []).map((k) => ({
                  value: k.kind,
                  label: `${iconOf(k.kind)} ${labelOf(k.kind)}`,
                }))}
              />
            ) : null}
            {(regions?.regions.length ?? 0) > 1 ? (
              <Picker
                label="지역"
                value={region}
                onChange={setRegion}
                options={(regions?.regions ?? []).map((r) => ({
                  value: r.region,
                  label: r.region,
                  hint: `여행 ${r.posts}개`,
                }))}
              />
            ) : null}
          </Row>
          </Card>

          {loadingPlaces && !places ? <Loading /> : null}
          {placeError ? <ErrorNote message={placeError} onRetry={reloadPlaces} /> : null}

          {places && places.places.length === 0 ? (
            <Empty
              message={
                kind
                  ? '이런 곳은 아직 올라온 것이 없어요.'
                  : '아직 올라온 일정이 없어요. 첫 번째가 되어 보세요.'
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
                sub={[labelOf(place.icon), `여행 ${place.posts}개에 담김`]
                  .filter(Boolean)
                  .join(' · ')}
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
          <Card>
            <Caption tone="secondary">
              여럿이 다녀온 지역이에요. 누르면 그 지역 글만 봐요.
            </Caption>
          </Card>

          {loadingRegions && !regions ? <Loading /> : null}
          {regionError ? <ErrorNote message={regionError} onRetry={reloadRegions} /> : null}

          {regions && regions.regions.length === 0 ? (
            <Empty message="아직 올라온 일정이 없어요. 첫 번째가 되어 보세요." />
          ) : null}

          <View style={styles.list}>
            {regions?.regions.map((r, i) => (
              <Rank
                key={r.region}
                at={i + 1}
                title={r.region}
                sub={`여행 ${r.posts}개${r.likes > 0 ? ` · ♥ ${r.likes}` : ''}`}
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
