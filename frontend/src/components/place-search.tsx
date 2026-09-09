import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Found, PlaceSearchProps } from '@/components/map-types';
import { Colors, Radius, Spacing, Tap } from '@/constants/theme';
import { Body, Caption, Divider, Field, IconButton, Loading, Row } from '@/ui';

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
export function PlaceSearch({ onPick }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  /* 담은 것을 기억해 별을 채웁니다. 서버는 같은 곳을 두 번 담지 않지만,
     화면이 그것을 모르면 눌러도 아무 일도 안 일어난 것처럼 보입니다. */
  const [kept, setKept] = useState<Set<string>>(new Set());

  async function keep(found: Found) {
    try {
      await api.post('/api/saved', {
        name: found.name,
        lat: found.lat,
        lng: found.lng,
        placeId: found.placeId,
      });
      setKept((prev) => new Set(prev).add(found.name));
    } catch {
      /* 담기는 곁다리라 실패해도 검색을 막지 않습니다. 별이 안 켜지는 것으로
         알 수 있습니다. */
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
      setError(e instanceof ApiError ? e.message : '찾지 못했습니다.');
      setResults(null);
    } finally {
      setBusy(false);
    }
  }, [query, busy]);

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
        hint="이름을 넣고 확인을 누르면 자리가 잡힙니다."
      />

      {busy ? <Loading label="찾는 중" /> : null}
      {error ? <Caption tone="danger">{error}</Caption> : null}

      {results && results.length === 0 ? <Caption>찾지 못했습니다.</Caption> : null}

      {results && results.length > 0 ? (
        <View style={styles.results}>
          {results.map((r, i) => (
            <View key={`${r.lat},${r.lng},${i}`}>
              {i > 0 ? <Divider /> : null}
              <Row style={styles.resultRow}>
                <Pressable
                  onPress={() => {
                    onPick(r);
                    setResults(null);
                    setQuery('');
                  }}
                  style={({ pressed }) => [styles.row, styles.grow, pressed && styles.rowPressed]}>
                  <Body strong numberOfLines={1}>
                    {r.name}
                  </Body>
                  {r.address ? <Caption numberOfLines={1}>{r.address}</Caption> : null}
                </Pressable>

                {/* 지금 넣지 않고 나중에 쓰려고 담아만 둘 수도 있습니다. */}
                <IconButton
                  name="star"
                  label={`${r.name} 담기`}
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
