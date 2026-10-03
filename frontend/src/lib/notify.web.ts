import { forget, remember, remembered, stillOn } from '@/lib/notify-token';
import { askShell, inShell } from '@/lib/shell-bridge.web';

/**
 * 동행자가 고쳤을 때 알려 주기 (웹).
 *
 * <h3>세 가지가 다 있어야 켜집니다</h3>
 *
 * <p>서비스 워커, 알림 허락, 그리고 서버의 공개키. 하나라도 없으면 켤 수
 * 없습니다. 그래서 스위치를 누르기 전에 먼저 물어보고, 못 켜는 자리에서는
 * 스위치 자체를 내지 않습니다.
 *
 * <h3>허락은 한 번만 물을 수 있습니다</h3>
 *
 * <p>브라우저는 "차단" 을 고르면 그다음부터 물어보지도 않습니다. 그래서 화면을
 * 열자마자 묻지 않습니다 — 무엇에 쓰는 것인지 모르는 채로 물으면 대개
 * 차단하고, 그러면 그 브라우저에서는 영영 못 켭니다. 사람이 스위치를 눌렀을
 * 때만 묻습니다.
 */

/** 서버를 부르는 자리. 화면이 쓰던 것을 그대로 받습니다. */
export type ApiClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
};

/*
  앱 껍데기 안에서는 웹 푸시가 안 됩니다. 웹뷰는 브라우저가 백그라운드에서
  서비스워커를 깨워 주는 일을 안 합니다. 대신 폰이 FCM·APNs 로 받아서
  띄우고, 우리는 그 열쇠를 서버에 등록합니다.

  <p>서버는 이미 둘 다 받습니다 — 열쇠 생김새로 가립니다.
*/
/*
  받아 둔 열쇠는 기기에 남깁니다.

  <p>모듈 변수 한 줄({@code let shellToken})에 들고 있었습니다. 그런데 앱은
  이 웹을 띄우는 껍데기라 <b>앱을 켤 때마다 웹이 처음부터 다시 뜹니다.</b>
  그러면 그 줄이 비고, 폰이 허락해 둔 상태여도 스위치가 꺼진 채로 보였습니다 —
  서버에는 등록이 멀쩡히 남아 있는데 말입니다. 「안 켜짐」으로 올라온 바로
  그 모습입니다.

  <p>남기는 자리와 서버에 되묻는 규칙은 {@link import('./notify-token')} 에
  있습니다. 앱 쪽(notify.ts)과 같은 것을 써야 하므로 따로 두었습니다.
*/

export const canNotify =
  inShell ||
  (typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window);

/**
 * 막혔을 때 어디서 푸는지.
 *
 * <p>「주소창 옆 자물쇠」라고만 적어 두었습니다. 앱에는 주소창이 없습니다 —
 * 앱에서 막힌 사람에게 없는 것을 누르라고 말하고 있었습니다.
 */
export const unblockHint = inShell
  ? '폰 설정의 이 앱 알림이 꺼져 있어요. 거기서 켜면 받을 수 있어요.'
  : '이 브라우저에서 알림을 막아 뒀어요. 주소창 왼쪽의 자물쇠를 눌러 알림을 허용으로 바꾸면 켤 수 있어요.';

/**
 * 지금 어떤 상태인지.
 *
 * <ul>
 *   <li><b>on</b> — 이 기기에서 이미 켜 두었습니다.</li>
 *   <li><b>blocked</b> — 브라우저가 막았습니다. 우리가 할 수 있는 것이
 *       없고, 주소창 옆 자물쇠에서 사람이 직접 풀어야 합니다.</li>
 *   <li><b>off</b> — 아직 안 켰습니다.</li>
 * </ul>
 *
 * @param api 서버에 되물을 자리. 기기에 남은 열쇠만 보면 서버가 지운 것을
 *            모릅니다 — {@link import('./notify-token').stillOn} 을 보세요
 */
export async function notifyState(api: ApiClient): Promise<'off' | 'on' | 'blocked'> {
  if (inShell) {
    /*
      폰의 허락 상태는 껍데기만 압니다. 스위치를 눌러 봐야 알 수 있어서,
      여기서는 이 기기에 등록해 둔 열쇠로 답합니다.

      <p>그래서 앱에서는 'blocked' 가 안 나옵니다. 폰에서 거절해 둔 사람은
      꺼진 스위치를 보고, 눌렀을 때 비로소 막혔다는 말을 듣습니다. 이미
      거절한 기기에서는 다시 눌러도 창이 안 뜨므로(폰이 바로 거절로
      답합니다) 그 한 번이 사람을 더 몰아세우지는 않습니다.
    */
    const token = remembered();
    return token && (await stillOn(api, token)) ? 'on' : 'off';
  }
  if (!canNotify) {
    return 'off';
  }
  if (Notification.permission === 'denied') {
    return 'blocked';
  }
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

/**
 * 알림을 켭니다.
 *
 * <p><b>tooOld</b> 는 앱 껍데기가 이 일을 모른다는 뜻입니다. 알림은 네이티브
 * 권한이라 OTA 로 안 들어가므로, 이 코드보다 먼저 구워진 앱에서는 켤 길이
 * 없습니다 — 그때 「폰 설정에서 켜 주세요」(blocked)라고 말하면 멀쩡한
 * 설정을 뒤지게 합니다. 고칠 자리가 폰이 아니라 <b>앱 판</b>입니다.
 */
export async function turnOn(api: ApiClient): Promise<'on' | 'blocked' | 'failed' | 'tooOld'> {
  if (inShell) {
    /*
      둘로 나눠 잡습니다.

      <p>한 덩어리로 잡고 있었습니다. 그러면 「폰이 열쇠를 못 만들었다」와
      「서버가 등록을 거절했다」가 똑같이 'failed' 하나로 뭉개져, 콘솔을
      봐도 어느 쪽인지 알 수가 없습니다. 흔한 자리는 앞쪽입니다 — 안드로이드
      에서 FCM 등록(GOOGLE_SERVICES_JSON)이 EAS 빌드에 안 실려 있으면
      {@code getExpoPushTokenAsync} 가 그 자리에서 던집니다(app.config.js
      의 경고를 보세요). 권한은 허락돼 있는데도 이 단계에서 막히므로,
      사람이 보기에는 「설정은 멀쩡한데 안 켜진다」로 보입니다.
    */
    let token: string;
    try {
      const said = await askShell({ kind: 'notifyOn' });
      if (said === null) {
        /* 폰에서 거절했습니다. 한 번 거절하면 설정까지 들어가야 되돌립니다. */
        return 'blocked';
      }
      if (typeof said !== 'string' || !said) {
        /* 답이 비어서 옵니다 — 이 말을 모르는 옛 껍데기입니다. */
        return 'tooOld';
      }
      token = said;
    } catch (e) {
      /* 폰에서 열쇠를 못 만들었습니다. 원격 디버거(Chrome 의
         chrome://inspect, Safari 의 개발자 메뉴)로 보면 이 줄이 찍힙니다. */
      console.error('[notify] 껍데기가 열쇠를 못 만들었어요', e);
      return 'failed';
    }
    try {
      /* 서버에 등록하는 것은 웹이 합니다 — 로그인 상태를 들고 있는 쪽이
         여기입니다. 껍데기는 열쇠만 만들어 줍니다. */
      await api.post('/api/push/subscribe', { endpoint: token, p256dh: null, auth: null });
      /* 등록이 된 뒤에 남깁니다. 먼저 남기면 등록이 실패한 열쇠를 들고
         「켜져 있어요」를 말하게 됩니다. */
      remember(token);
      return 'on';
    } catch (e) {
      console.error('[notify] 서버 등록이 거절됐어요', e);
      return 'failed';
    }
  }

  if (!canNotify) {
    return 'failed';
  }

  try {
    /* 사람이 스위치를 누른 지금이 물어볼 때입니다. 이미 허락해 두었으면
       창이 뜨지 않고 바로 넘어갑니다. */
    const allowed = await Notification.requestPermission();
    if (allowed !== 'granted') {
      return allowed === 'denied' ? 'blocked' : 'failed';
    }

    /* 워커가 자리를 잡을 때까지 기다립니다. 방금 새로 연 화면에서는 아직
       준비 중일 수 있는데, 그때 pushManager 를 부르면 실패합니다. */
    const reg = await navigator.serviceWorker.ready;

    const { publicKey } = await api.get<{ publicKey: string }>('/api/push/key');
    if (!publicKey) {
      return 'failed';
    }

    /*
      이미 켜 둔 것이 있으면 그대로 씁니다.

      다만 서버 열쇠가 바뀌었으면 옛 자리로는 못 보냅니다. 열쇠가 다르면
      물러 두고 새로 받습니다.
    */
    const had = await reg.pushManager.getSubscription();
    if (had && !sameKey(had, publicKey)) {
      await had.unsubscribe();
    }

    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        /* 내용 없는 알림은 크롬이 거부합니다. 우리는 어차피 늘 봉해서
           보냅니다. */
        userVisibleOnly: true,
        applicationServerKey: bytesOf(publicKey),
      }));

    const raw = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
      return 'failed';
    }

    await api.post('/api/push/subscribe', {
      endpoint: raw.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
    });
    return 'on';
  } catch {
    return 'failed';
  }
}

/** 이 기기에서는 그만 받습니다. */
export async function turnOff(api: ApiClient): Promise<void> {
  if (inShell) {
    const token = remembered();
    if (token) {
      await api.post('/api/push/unsubscribe', { endpoint: token }).catch(() => {});
      /* 서버에서 빼지 못했어도 기기에서는 지웁니다. 끈 사람에게 켜진
         스위치를 다시 보여 주지 않는 것이 먼저입니다 — 서버 쪽은 다시
         켤 때 같은 열쇠로 덮어씁니다(PushService 가 endpoint 로 찾습니다). */
      forget();
    }
    await askShell({ kind: 'notifyOff' }).catch(() => {});
    return;
  }

  if (!canNotify) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) {
      return;
    }
    /* 서버에 먼저 알립니다. 브라우저 쪽만 물러 두면 서버는 없는 자리로
       계속 보내다 한참 뒤에야 알아챕니다. */
    await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch {
    /* 못 껐으면 스위치가 켜진 채로 남습니다. 다시 눌러 볼 수 있습니다. */
  }
}

/** 이미 켜 둔 자리가 지금 서버 열쇠로 만든 것인지. */
function sameKey(sub: PushSubscription, publicKey: string): boolean {
  const had = sub.options?.applicationServerKey;
  if (!had) {
    return false;
  }
  const a = new Uint8Array(had);
  const b = bytesOf(publicKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * base64url 을 바이트로.
 *
 * <p>브라우저의 atob 는 표준 base64 만 압니다. 우리 것은 주소에 실을 수 있게
 * - 와 _ 를 쓰는 판이라 바꿔 줘야 하고, 잘라 낸 = 도 도로 채워야 합니다.
 */
function bytesOf(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}
