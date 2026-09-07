import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing, Tap } from '@/constants/theme';
import type { Found, PlaceSearchProps } from '@/components/map-types';
import { gmaps, hasMaps, loadMaps } from '@/lib/gmaps.web';
import { Body, Caption, Divider, Field, Loading } from '@/ui';

/**
 * 장소 검색 (웹).
 *
 * <p>이름으로 찾아 고르면 좌표가 저절로 채워집니다. 위도·경도를 손으로 적게
 * 두면 대부분은 지도를 따로 켜서 숫자를 옮겨 적어야 하고, 그러다 한 자리
 * 틀리면 엉뚱한 나라에 점이 찍힙니다.
 *
 * <p>키가 없으면 이 자리를 통째로 비웁니다. 그때는 아래 이름·좌표 칸으로
 * 직접 넣습니다.
 */

export function PlaceSearch({ onPick }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* PlacesService 는 붙일 곳이 필요합니다. 지도를 띄우지 않으므로 문서에
     붙지 않은 빈 div 를 하나 만들어 씁니다. */
  const anchor = useRef<HTMLDivElement | null>(null);
  const service = useRef<any>(null);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loadMaps();
      if (!service.current) {
        anchor.current = document.createElement('div');
        service.current = new (gmaps().places.PlacesService)(anchor.current);
      }
      const found = await new Promise<Found[]>((resolve, reject) => {
        service.current.textSearch({ query: q }, (res: any[], status: string) => {
          const S = gmaps().places.PlacesServiceStatus;
          if (status === S.ZERO_RESULTS) {
            resolve([]);
            return;
          }
          if (status !== S.OK || !res) {
            reject(new Error(status));
            return;
          }
          resolve(
            res.slice(0, 6).map((r) => ({
              name: r.name ?? q,
              address: r.formatted_address ?? '',
              lat: r.geometry.location.lat(),
              lng: r.geometry.location.lng(),
            })),
          );
        });
      });
      setResults(found);
    } catch (e) {
      /* 구글이 돌려준 상태를 그대로 보여 주면 무슨 말인지 알 수 없습니다. */
      const status = e instanceof Error ? e.message : '';
      setError(
        status === 'REQUEST_DENIED'
          ? '장소 검색이 막혀 있습니다. 아래에 직접 넣어 주세요.'
          : '검색하지 못했습니다. 아래에 직접 넣어 주세요.',
      );
      setResults(null);
    } finally {
      setBusy(false);
    }
  }, [query, busy]);

  if (!hasMaps()) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Field
        label="장소 찾기"
        value={query}
        onChangeText={setQuery}
        placeholder="난바 파크스, 도쿄역…"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={search}
        hint="이름을 넣고 확인을 누르면 좌표가 저절로 채워집니다."
      />

      {busy ? <Loading label="찾는 중" /> : null}
      {error ? <Caption tone="danger">{error}</Caption> : null}

      {results && results.length === 0 ? (
        <Caption>찾지 못했습니다. 아래에 직접 넣어 주세요.</Caption>
      ) : null}

      {results && results.length > 0 ? (
        <View style={styles.results}>
          {results.map((r, i) => (
            <View key={`${r.lat},${r.lng},${i}`}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => {
                  onPick(r);
                  setResults(null);
                  setQuery('');
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Body strong numberOfLines={1}>
                  {r.name}
                </Body>
                {r.address ? <Caption numberOfLines={1}>{r.address}</Caption> : null}
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
