import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ApiClient } from '@/lib/notify.web';

export type { ApiClient } from '@/lib/notify.web';

/**
 * 동행자가 고쳤을 때 알려 주기 (앱).
 *
 * <h3>한동안 앱에는 없었습니다</h3>
 *
 * <p>서버에는 이미 알림이 다 있었습니다 — 열쇠도, 구독 표도, 보내는 자리도.
 * 다만 그것이 전부 <b>브라우저용</b>이었습니다. 앱은 전송 방식이 아예
 * 달라서(애플·구글을 거칩니다) 서버에 두 번째 길이 필요했고, 그동안 앱에서는
 * 스위치를 아예 안 냈습니다.
 *
 * <h3>Expo 가 대신 넘깁니다</h3>
 *
 * <p>우리가 애플·구글에 직접 넣으려면 APNs 인증서와 FCM 열쇠를 서버가 들고
 * 있어야 하고 둘의 규격도 다릅니다. Expo 가 그 둘을 상대해 주므로 우리는
 * 토큰 한 줄을 서버에 올려 두고, 서버는 그 토큰으로 보냅니다.
 *
 * <p>그래서 브라우저 쪽과 달리 <b>내용이 Expo 를 지나갑니다.</b> 담는 것은
 * "동행자가 일정을 고쳤습니다" 정도이고 무엇을 어떻게 고쳤는지는 앱을
 * 열어야 보입니다 — 브라우저 쪽도 같은 것만 담고 있어 둘이 다르지 않습니다.
 *
 * <h3>허락은 스위치를 눌렀을 때만 묻습니다</h3>
 *
 * <p>폰은 한 번 거절하면 시스템 설정까지 들어가야 되돌립니다. 무엇에 쓰는
 * 것인지 모르는 채로 물으면 대개 거절하고, 그러면 그 기기에서는 사실상
 * 못 켭니다. 웹이 같은 이유로 같은 규칙을 씁니다.
 */

/*
  앱이 떠 있을 때도 알림을 보여 줍니다.

  <p>기본은 안 보여 주는 것입니다 — 보고 있는 화면을 덮을 이유가 없다는
  뜻인데, 우리 알림은 <b>지금 보고 있지 않은 여행</b>에 대한 것입니다.
  동행자가 어제 여행을 고친 것을 오늘 다른 화면에서 알아야 합니다.
*/
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const canNotify = true;

/** 이 기기에서 켜 둔 토큰. 껐다 켤 때 같은 것을 다시 씁니다. */
let token: string | null = null;

export async function notifyState(): Promise<'off' | 'on' | 'blocked'> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') {
    return token ? 'on' : 'off';
  }
  /*
    다시 물을 수 없으면 막힌 것입니다.

    <p>브라우저의 "차단" 과 같은 자리입니다. 우리가 할 수 있는 것이 없고,
    설정에서 사람이 직접 풀어야 합니다.
  */
  return canAskAgain ? 'off' : 'blocked';
}

export async function turnOn(api: ApiClient): Promise<'on' | 'blocked' | 'failed'> {
  try {
    const asked = await Notifications.requestPermissionsAsync();
    if (asked.status !== 'granted') {
      return asked.canAskAgain ? 'failed' : 'blocked';
    }

    /*
      안드로이드는 갈래(channel)가 있어야 알림이 뜹니다.

      <p>안 만들어 두면 8.0 위에서는 조용히 사라집니다 — 보냈는데 안 오는
      것만큼 찾기 어려운 것이 없습니다.
    */
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '동행자 소식',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    /* 어느 앱으로 보낼지를 Expo 가 알아야 합니다. app.json 의 것을 그대로
       씁니다 — 여기 따로 적어 두면 언젠가 둘이 어긋납니다. */
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const got = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = got.data;

    /* 서버는 생김새로 갈래를 알아봅니다 — ExponentPushToken[...] 이면 앱.
       브라우저 열쇠 자리는 비워 둡니다. */
    await api.post('/api/push/subscribe', { endpoint: token, p256dh: null, auth: null });
    return 'on';
  } catch {
    return 'failed';
  }
}

export async function turnOff(api: ApiClient): Promise<void> {
  if (!token) {
    return;
  }
  try {
    await api.post('/api/push/unsubscribe', { endpoint: token });
  } catch {
    /* 못 껐으면 서버는 계속 보냅니다. 다만 기기가 안 받게 하는 길은 설정
       쪽이라, 여기서 더 할 수 있는 것이 없습니다. */
  }
  token = null;
}
