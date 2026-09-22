import * as Location from 'expo-location';
import * as Print from 'expo-print';
import { Share } from 'react-native';

import { googleIdToken } from '@/shell/sign-in';
import { expoPushToken, stopPush } from '@/shell/push';
import type { Ask } from '@/shell/talk';

/**
 * 웹의 부탁을 실제로 해 주는 곳.
 *
 * <p>여기 있는 것은 <b>폰만 할 수 있는 일</b>뿐입니다. 지도도, 저장도,
 * 화면도 웹이 합니다 — 웹뷰 안에서 그대로 되기 때문입니다.
 *
 * <p>부탁 하나에 함수 하나. 답은 {@code shell.tsx} 가 웹에 돌려줍니다.
 */
export async function answer(ask: Ask): Promise<unknown> {
  switch (ask.kind) {
    /*
      구글 로그인.

      <p>웹뷰 안에서는 못 합니다. 구글이 막습니다 — 창이 앱 안에 박혀 있으면
      주소창이 없어서, 쓰는 사람이 지금 진짜 구글에 비밀번호를 넣는 것인지
      확인할 수가 없기 때문입니다(disallowed_useragent).

      <p>그래서 폰의 브라우저를 <b>앱 위에 띄웁니다</b>(Custom Tabs). 주소창이
      보이고, 브라우저에 이미 로그인해 둔 계정을 그대로 씁니다.
    */
    case 'signIn':
      return googleIdToken();

    /*
      알림.

      <p>웹뷰는 웹 푸시를 못 받습니다. 폰이 FCM 으로 받아서 우리가 띄웁니다.
      서버는 이미 두 가지를 다 받게 되어 있습니다 — 열쇠 모양을 보고
      가립니다(PushService 의 kind).
    */
    case 'notifyOn':
      return expoPushToken();

    case 'notifyOff':
      await stopPush();
      return null;

    /*
      인쇄.

      <p>웹뷰에는 window.print 가 없습니다. 웹이 만든 HTML 을 그대로 받아
      폰의 인쇄 화면에 넘깁니다 — 종이에 나오는 모양이 브라우저와 같습니다.
    */
    case 'print':
      await Print.printAsync({ html: ask.html });
      return null;

    /*
      나누기.

      <p>웹뷰에는 navigator.share 가 없습니다. 폰의 공유 판을 엽니다.
      웹 쪽과 같은 말로 답합니다 — 보냈는지, 베꼈는지, 안 됐는지.
    */
    case 'share': {
      const out = await Share.share({ message: `${ask.title}\n${ask.url}`, url: ask.url });
      return out.action === Share.sharedAction ? 'sent' : 'failed';
    }

    /*
      위치 권한.

      <p>지도 자체는 웹이 그리고 자리도 웹이 브라우저 방식으로 받아 옵니다
      (웹뷰 안에서 그대로 됩니다). 다만 <b>폰이 앱에게 허락</b>을 먼저 해
      줘야 그 길이 열립니다. 그 한 번만 껍데기가 받습니다.
    */
    case 'letMeLocate': {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    }
  }
}
