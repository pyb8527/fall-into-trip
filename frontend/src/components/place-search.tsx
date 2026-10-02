import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Found, PlaceSearchProps } from '@/components/map-types';
import { Colors, Radius, Spacing, Tap } from '@/constants/theme';
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import {
  SORT_GIVEN,
  SORT_NEAR,
  SORT_RATING,
  SortBar,
  sortPlaces,
  type SortBy,
} from '@/components/sort-bar';
import { Body, Button, Caption, Divider, Field, IconButton, Loading, Row } from '@/ui';
import { KEEP } from '@/constants/words';

/**
 * 이름으로 장소 찾기.
 *
 * <p>구글에 직접 묻지 않고 우리 서버에 묻습니다. 키가 서버에만 있으면
 * 앱 번들에서 꺼내 갈 수 없고, 브라우저에서 부를 때 CORS 로 막히는 일도
 * 없습니다. 웹과 앱이 같은 길을 쓰므로 결과 모양도 갈리지 않습니다.
 *
 * <p>고르면 좌표가 뒤에서 채워집니다. 쓰는 사람은 위도·경도를 볼 일이
 * 없습니다.
 */
export function PlaceSearch({ onPick, here }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  /** 들여다보는 중인 곳. 누르면 지도와 사정이 뜹니다. */
  const [looking, setLooking] = useState<Found | null>(null);
  /* 구글이 준 순서는 "이 말과 얼마나 맞는가" 입니다. 고를 때 보는 눈은
     그것 하나가 아닙니다. */
  const [by, setBy] = useState<SortBy>('given');
  const [results, setResults] = useState<Found[] | null>(null);
  /* 담은 것을 기억해 책갈피를 채웁니다. 서버는 같은 곳을 두 번 담지 않지만,
     화면이 그것을 모르면 눌러도 아무 일도 안 일어난 것처럼 보입니다. */
  const [kept, setKept] = useState<Set<string>>(new Set());

  async function keep(found: Found) {
    try {
      await api.post('/api/saved', {
        name: found.name,
        lat: found.lat,
        lng: found.lng,
        placeId: found.placeId,
        /* 서버가 구글 갈래로 미리 찍어 둔 핀 그림. 여기서 안 넘기면 보석함을
           거쳐 온 곳만 지도에서 민무늬가 됩니다. */
        icon: found.icon,
      });
      setKept((prev) => new Set(prev).add(found.name));
    } catch {
      /* 담기는 곁다리라 실패해도 검색을 막지 않습니다. 책갈피가 안 켜지는
         것으로 알 수 있습니다. */
    }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.get<{ places: Found[] }>(
        `/api/places/search?q=${encodeURIComponent(q)}`,
      );
      setResults(res.places ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
      setResults(null);
    } finally {
      setBusy(false);
    }
  }, [query, busy]);

  return (
    <View style={styles.wrap}>
      {/* 찾기 단추를 칸 아래에 따로 두었더니 둘이 한 벌로 안 읽히고 세로로만
          길어졌습니다. 칸 안 오른쪽 끝에 돋보기로 붙입니다. */}
      {/*
        지역을 함께 쓰라고 먼저 말합니다.

        <p>상호명만 넣으면 잘 안 나옵니다. 구글이 덜 주는 것이 아니라
        <b>지역을 안 주면 못 좁히는 것</b>입니다 — 「이치란」은 세계에 수십
        군데이고, 그중 어디를 찾는지는 말해 주지 않으면 알 수 없습니다.

        <p>찾은 뒤에 「찾지 못했어요」로 알리면 늦습니다. 그때는 이미 한 번
        헛걸음한 것이고, 무엇을 고쳐 적어야 하는지도 말해 주지 않습니다.
        그래서 <b>칸 아래 힌트</b>입니다 — 적기 전에 읽는 자리입니다.

        <p>여기 있던 「이름을 넣고 찾아 주세요. 고르면 지도에 자리가 잡혀요」를
        걷습니다. 앞쪽은 라벨과 자리 표시 글자가 이미 하는 말이고, 뒤쪽은
        고른 다음 이야기라 찾기 전에 쓸 데가 없습니다. 힌트 줄은 하나입니다 —
        둘을 쌓으면 둘 다 안 읽힙니다.

        <p>예를 답니다. 「지역을 함께」라는 말만으로는 「오사카부 주오구」처럼
        적어야 하나 싶은데, 보기 하나를 보면 그만큼만 적으면 되는 것을 압니다.
      */}
      <Field
        label="장소 찾기"
        value={query}
        onChangeText={setQuery}
        placeholder="난바 파크스, 도쿄역…"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={search}
        hint="지역과 상호명을 함께 쓰면 더 잘 찾아요. 예) 오사카 이치란"
        action={{
          icon: 'search',
          label: '장소 찾기',
          disabled: !query.trim() || busy,
          onPress: search,
        }}
      />

      {/* 기다리는 말은 앱 어디서나 해요체입니다. 「찾는 중」은 우리끼리 쓰는
          말투고, 읽는 사람에게 하는 말이 아닙니다. */}
      {busy ? <Loading label="찾고 있어요" /> : null}
      {error ? <Caption tone="danger">{error}</Caption> : null}

      {results && results.length === 0 ? <Caption>찾지 못했어요.</Caption> : null}

      <PlaceDetailSheet
        place={looking}
        here={here}
        onClose={() => setLooking(null)}
        /*
          담는 것은 구글 지도 옆 그림입니다.

          <p>「여기로 고르기」와 나란한 글자 단추였습니다. 그러면 둘이 같은
          무게로 보이는데, 이 화면에서 하려던 일은 <b>고르는 것</b>이고 담아
          두는 것은 「지금은 아니고 나중에」 입니다. 아래 결과 줄마다 이미
          같은 일을 책갈피 그림으로 하고 있으니, 판 안에서도 같은 그림입니다.
        */
        scrap={
          looking ? { kept: kept.has(looking.name), onPress: () => keep(looking) } : null
        }
        actions={
          looking ? (
            <Button
              label="여기로 고르기"
              compact
              onPress={() => {
                onPick(looking);
                setLooking(null);
                setResults(null);
                setQuery('');
              }}
            />
          ) : null
        }
      />

      {results && results.length > 1 ? (
        <SortBar
          options={here ? [SORT_GIVEN, SORT_RATING, SORT_NEAR] : [SORT_GIVEN, SORT_RATING]}
          value={by}
          onChange={setBy}
        />
      ) : null}

      {results && results.length > 0 ? (
        <View style={styles.results}>
          {sortPlaces(results, by, here).map((r, i) => (
            <View key={`${r.lat},${r.lng},${i}`}>
              {i > 0 ? <Divider /> : null}
              <Row style={styles.resultRow}>
                {/*
                  누르면 바로 넣지 않고 들여다봅니다.

                  이름과 주소만으로는 "이치란 도톤보리점" 과 "이치란 난바점"
                  중 어느 쪽인지 고를 수가 없었습니다. 지도에 찍어 보고 평점과
                  영업시간을 본 뒤에 넣는 것이 순서입니다.
                */}
                <Pressable
                  onPress={() => setLooking(r)}
                  accessibilityLabel={`${r.name} 자세히 보기`}
                  style={({ pressed }) => [styles.row, styles.grow, pressed && styles.rowPressed]}>
                  <Body strong numberOfLines={1}>
                    {r.name}
                  </Body>
                  {r.address ? <Caption numberOfLines={1}>{r.address}</Caption> : null}
                </Pressable>

                {/* 지금 넣지 않고 나중에 쓰려고 담아만 둘 수도 있습니다. */}
                <IconButton
                  name="bookmark"
                  label={`${r.name} ${KEEP}`}
                  tone={kept.has(r.name) ? 'accent' : 'default'}
                  active={kept.has(r.name)}
                  onPress={() => keep(r)}
                />
              </Row>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  resultRow: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
  wrap: {
    gap: Spacing.md,
  },
  results: {
    backgroundColor: Colors.fill,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  row: {
    minHeight: Tap.min,
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: 2,
  },
  rowPressed: {
    backgroundColor: Colors.fillPressed,
  },
});
