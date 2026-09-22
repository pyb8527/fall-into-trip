import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * 알림 (껍데기).
 *
 * <h3>왜 웹이 직접 못 하나</h3>
 *
 * <p>웹뷰는 웹 푸시를 못 받습니다. 브라우저가 백그라운드에서 서비스워커를
 * 깨워 주는 일을 웹뷰는 안 합니다. 그래서 폰이 FCM·APNs 로 받아야 하고,
 * 그것은 껍데기의 일입니다.
 *
 * <h3>열쇠만 만들고 등록은 웹이 합니다</h3>
 *
 * <p>껍데기는 로그인 상태를 모릅니다 — 쿠키도 토큰도 웹뷰 안에 있습니다.
 * 그래서 서버에 "이 사람의 기기" 라고 등록하는 일은 웹이 합니다. 껍데기는
 * 폰에게 허락을 받고 열쇠 한 줄을 만들어 건넬 뿐입니다.
 *
 * <p>서버는 이미 둘 다 받습니다. 열쇠 생김새로 가립니다 —
 * {@code ExponentPushToken[...]} 이면 앱, 아니면 브라우저(PushService).
 */

/*
  앱이 떠 있을 때도 알림을 보여 줍니다.

  <p>기본은 안 보여 주는 것인데, 우리 알림은 <b>지금 보고 있지 않은 여행</b>에
  대한 것입니다. 동행자가 어제 여행을 고친 것을 오늘 다른 화면에서 알아야
  합니다.
*/
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * 폰에게 허락을 받고 열쇠를 만듭니다.
 *
 * <p>허락은 <b>웹이 스위치를 눌렀을 때만</b> 묻습니다. 폰은 한 번 거절하면
 * 시스템 설정까지 들어가야 되돌립니다 — 무엇에 쓰는지 모르는 채로 물으면
 * 대개 거절하고, 그러면 그 기기에서는 사실상 못 켭니다.
 *
 * @return 서버에 등록할 열쇠. 거절했으면 null
 */
export async function expoPushToken(): Promise<string | null> {
  const asked = await Notifications.requestPermissionsAsync();
  if (asked.status !== 'granted') {
    return null;
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

  const got = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return got.data;
}

/**
 * 이 기기에 쌓인 알림을 걷습니다.
 *
 * <p>서버에서 빼는 것은 웹이 합니다(로그인한 쪽이라서). 여기서는 폰에 남은
 * 것만 치웁니다 — 껐는데 알림 목록에 옛것이 그대로 있으면 안 꺼진 것처럼
 * 보입니다.
 */
export async function stopPush(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
}

/**
 * 알림을 눌러서 들어왔을 때 어디로 가야 하는지.
 *
 * <p>서버가 알림에 {@code data.url} 을 실어 보냅니다. 그 주소를 웹에 건네면
 * 웹이 그 화면을 엽니다 — 앱이 아니라 웹이 화면을 아는 쪽이기 때문입니다.
 *
 * @param go 갈 곳을 받는 함수
 * @return 그만 듣는 함수
 */
export function onNotificationTap(go: (url: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    const url = res.notification.request.content.data?.url;
    if (typeof url === 'string' && url) {
      go(url);
    }
  });
  return () => sub.remove();
}

/**
 * 앱이 꺼져 있을 때 온 알림을 눌러 들어왔는지.
 *
 * <p>그때는 위의 듣는 자리가 아직 없습니다. 껍데기가 뜨고 나서 한 번
 * 물어봐야 합니다 — 안 물어보면 알림을 눌렀는데 첫 화면이 뜹니다.
 */
export async function tappedToOpen(): Promise<string | null> {
  const res = await Notifications.getLastNotificationResponseAsync();
  const url = res?.notification.request.content.data?.url;
  return typeof url === 'string' && url ? url : null;
}
