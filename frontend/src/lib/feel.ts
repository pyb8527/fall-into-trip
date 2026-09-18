import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * 손끝에 닿는 것.
 *
 * <h3>진동과 햅틱은 다릅니다</h3>
 *
 * <p>{@code Vibration.vibrate(18)} 을 쓰고 있었습니다. 안드로이드에서는
 * 18밀리초 동안 짧게 떨리지만, <b>iOS 는 그 숫자를 아예 안 봅니다</b> —
 * 길이를 정할 수 없어서 늘 같은 한 번을 울립니다. 도장을 찍는 순간에
 * 원하던 것은 "톡" 인데 아이폰에서는 "우웅" 이 났습니다.
 *
 * <p>햅틱은 그것과 다른 장치입니다. 세기를 고르면 기기가 제 나름의 가장
 * 짧고 정확한 것을 냅니다. 안드로이드에서도 짧은 진동으로 내려갑니다.
 *
 * <h3>없으면 조용히 넘어갑니다</h3>
 *
 * <p>웹에는 이런 장치가 없고, 안드로이드 기기 중에도 없는 것이 있습니다.
 * 손끝의 느낌은 <b>있으면 좋은 것</b>이지 그것으로 무언가를 알리는 것이
 * 아니므로, 안 되면 아무 일도 없었던 것처럼 지나갑니다 — 여기서 터지면
 * 도장은 찍혔는데 화면이 죽습니다.
 */
function feel(run: () => Promise<unknown>) {
  if (Platform.OS === 'web') {
    return;
  }
  run().catch(() => {
    /* 못 울리는 기기입니다. 그것뿐입니다. */
  });
}

/** 도장이 찍히는 순간, 하나를 챙긴 순간. 가장 가벼운 톡. */
export function feelTick() {
  feel(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/**
 * 끌 것을 손에 쥐는 순간.
 *
 * <p>길게 눌러 집는 동작은 언제 집혔는지가 눈으로만은 안 보입니다. 손끝이
 * 한 번 울려야 "이제 끌면 된다" 를 압니다. 집는 느낌이라 톡보다 조금
 * 무겁습니다.
 */
export function feelGrab() {
  feel(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/**
 * 하나가 아니라 <b>한 벌</b>이 끝난 순간. 다 챙겼을 때, 깃발을 꽂았을 때.
 *
 * <p>성공을 알리는 것은 결이 다릅니다. 톡 하나가 아니라 짧은 두 번으로,
 * 무언가가 마무리되었다고 말합니다.
 */
export function feelDone() {
  feel(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
