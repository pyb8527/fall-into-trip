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

export const canNotify =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/**
 * 지금 어떤 상태인지.
 *
 * <ul>
 *   <li><b>on</b> — 이 기기에서 이미 켜 두었습니다.</li>
 *   <li><b>blocked</b> — 브라우저가 막았습니다. 우리가 할 수 있는 것이
 *       없고, 주소창 옆 자물쇠에서 사람이 직접 풀어야 합니다.</li>
 *   <li><b>off</b> — 아직 안 켰습니다.</li>
 * </ul>
 */
export async function notifyState(): Promise<'off' | 'on' | 'blocked'> {
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

/** 알림을 켭니다. */
export async function turnOn(api: ApiClient): Promise<'on' | 'blocked' | 'failed'> {
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
