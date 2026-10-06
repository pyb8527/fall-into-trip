import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Button } from '@/ui';

/**
 * 「따라가기」 — 3D 지도에서 손으로 카메라를 가져간 뒤 다시 탈것에 붙이는 단추.
 *
 * <p>3D 지도(lib/journey)는 사람이 밀거나 확대 · 돌리기 · 기울이기를 하면 카메라를
 * 놓아 줍니다. 그때만 이 단추가 지도 오른쪽 아래에 섭니다. 따라가는 동안에는 안
 * 섭니다 — 누를 일이 없는 단추를 늘 세워 두면 지도만 가립니다.
 */
export function FollowButton({
  visible,
  label = '따라가기',
  onPress,
}: {
  visible: boolean;
  label?: string;
  onPress: () => void;
}) {
  if (!visible) {
    return null;
  }
  return (
    <View pointerEvents="box-none" style={styles.slot}>
      <Button label={label} icon="navigation" compact onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    right: Spacing.s3,
    bottom: Spacing.s3,
  },
});
