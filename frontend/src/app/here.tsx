import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveMap } from '@/components/live-map';
import { hasTiltMaps } from '@/components/replay-stage';
import { Colors, Elevation, Radius, Spacing } from '@/constants/theme';
import { useHere } from '@/lib/here';
import { Body, Button, Caption, IconButton, Row } from '@/ui';

/**
 * 「지금 여기」 — 내 자리만 보는 지도(홈 머리의 단추).
 *
 * <p>여행과 상관없이 지금 어디 있는지, 움직이면 지도가 따라오는 것만 합니다.
 * 다음 장소 안내 · 동행자 위치는 여행 상세의 「지금 여기」에만 있습니다 — 그
 * 둘은 여행(갈 곳 · 같이 간 사람)이 있어야 뜻이 있습니다.
 *
 * <p>위치는 이 화면에 있는 동안만 받습니다. 떠나면 멈추고, 어디에도 보내지
 * 않습니다(동행자에게 알리기는 여행 상세에서 따로 켭니다).
 */
export default function HereScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const me = useHere();
  const [threeD, setThreeD] = useState(false);
  const tilt = hasTiltMaps();

  const { start } = me;
  useEffect(() => {
    start();
  }, [start]);

  return (
    <View style={styles.screen}>
      <LiveMap here={me.here} threeD={threeD} bottomInset={insets.bottom} />

      <Row
        pointerEvents="box-none"
        style={[styles.bar, { top: insets.top + Spacing.s2 }]}>
        <IconButton
          name="chevron-left"
          label="돌아가기"
          onMap
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : router.replace('/(app)/home'))}
        />
        {tilt ? (
          <IconButton
            name="cube"
            label={threeD ? '평평한 지도로 보기' : '3D 로 보기'}
            onMap
            active={threeD}
            onPress={() => setThreeD((v) => !v)}
          />
        ) : null}
      </Row>

      {/* 위치를 못 받을 때 — 왜인지와 다시 하기. */}
      {!me.supported || (me.error && !me.here) ? (
        <View style={[styles.notice, { bottom: insets.bottom + Spacing.s4 }]}>
          <Body small strong>
            지금 위치를 볼 수 없어요
          </Body>
          <Caption tone="secondary">
            {me.supported ? me.error : '이 기기에서는 위치를 쓸 수 없어요.'}
          </Caption>
          {me.supported ? <Button label="다시 해 보기" compact onPress={me.start} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bar: {
    position: 'absolute',
    left: Spacing.s3,
    right: Spacing.s3,
    justifyContent: 'space-between',
  },
  notice: {
    position: 'absolute',
    left: Spacing.s3,
    right: Spacing.s3,
    gap: Spacing.s2,
    padding: Spacing.s4,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Elevation.float,
  },
});
