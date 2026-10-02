import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { request } from '@/api/client';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Colors, Radius, Spacing, Tabular, Type, Weight, dayColor } from '@/constants/theme';
import { formatSpan } from '@/lib/countdown';
import { Band, Body, Button, Caption, Empty, Loading, Screen, Title } from '@/ui';
import { LogoLockup } from '@/ui/logo';

/** 링크를 연 사람이 받는 것. 사람 이름이 하나도 없습니다. */
type Shown = {
  title: string;
  emoji?: string | null;
  theme?: string | null;
  until?: string | null;
  days: {
    label: string;
    date?: string | null;
    iso?: string | null;
    places: { name: string; time?: string | null; note?: string | null }[];
  }[];
};

/**
 * 로그인 없이 보는 일정.
 *
 * <h3>읽기만 합니다</h3>
 *
 * <p>숙소 주인, 같이 가는 친구의 가족, 아직 가입 안 한 동행이 받는 화면입니다.
 * 날짜·장소·시각·메모만 있고 누를 것이 거의 없습니다 — 지도도 없습니다.
 * 지도를 그리려면 구글을 부르는데, 계정 없는 사람이 링크를 열 때마다 그 값을
 * 치를 까닭이 없습니다.
 *
 * <h3>맨 아래에 들어오는 길</h3>
 *
 * <p>같이 고치려면 모임에 들어와야 합니다. 초대는 모임 사람이 따로 보내므로
 * 여기서는 앱이 무엇인지만 알리고 시작 화면으로 보냅니다.
 *
 * <p>끊긴 링크·지난 링크·모르는 링크는 모두 같은 말을 합니다. 서버가 그
 * 셋을 가리지 않습니다.
 */
export default function ViewScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data, error, loading } = useAsync<Shown>(
    (signal) =>
      request<Shown>(`/api/view/${encodeURIComponent(token)}`, { anonymous: true, signal }),
    [token],
  );

  const from = data?.days[0]?.iso ?? null;
  const to = data?.days[data.days.length - 1]?.iso ?? null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.logo}>
        <LogoLockup />
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? (
        <Empty
          icon="calendar"
          message="열 수 없는 링크예요."
          note="끊겼거나 여행이 끝난 링크일 수 있어요. 보낸 사람에게 새로 받아 주세요."
        />
      ) : null}

      {data ? (
        <>
          <Title>
            {data.emoji ? `${data.emoji} ` : ''}
            {data.title}
          </Title>
          <Caption tone="secondary">{formatSpan(from, to)}</Caption>

          {data.days.map((d, i) => (
            <View key={`${d.label}-${i}`} style={styles.day}>
              <View style={styles.dayHead}>
                <View style={[styles.mark, { backgroundColor: dayColor(i) }]} />
                <Text style={styles.dayTitle}>{d.label}</Text>
                {d.date ? <Caption tone="secondary">{d.date}</Caption> : null}
              </View>
              {d.places.length === 0 ? (
                <Caption tone="muted">아직 비어 있어요.</Caption>
              ) : (
                d.places.map((p, j) => (
                  <View key={`${p.name}-${j}`} style={styles.place}>
                    <Text style={styles.time}>{p.time ?? ''}</Text>
                    <View style={styles.grow}>
                      <Body strong>{p.name}</Body>
                      {p.note ? (
                        <Caption tone="secondary">{p.note}</Caption>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          ))}

          <Band />
          <Body small tone="secondary">
            FIT 은 같이 가는 사람들과 일정·가계부·사진을 한 곳에서 짜는 여행 앱이에요. 이 일정을
            같이 고치려면 보낸 사람에게 모임 초대를 받아 주세요.
          </Body>
          <Button
            label={user ? '내 여행으로' : 'FIT 둘러보기'}
            variant="secondary"
            onPress={() => router.replace('/')}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    paddingVertical: Spacing.s4,
  },
  day: {
    gap: Spacing.s2,
    paddingVertical: Spacing.s3,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
  },
  mark: {
    width: 4,
    height: 18,
    borderRadius: Radius.full,
  },
  dayTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  place: {
    flexDirection: 'row',
    gap: Spacing.s3,
    paddingLeft: Spacing.s3,
  },
  /* 시각 칸은 폭을 고정합니다. 들쑥날쑥하면 장소 이름이 한 줄로 안 섭니다. */
  time: {
    ...Type.caption,
    ...Tabular,
    width: 44,
    color: Colors.textSecondary,
    paddingTop: 2,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
});
