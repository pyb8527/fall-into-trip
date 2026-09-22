import type { Ask, Tell } from '@/shell/talk';

/**
 * 앱 껍데기에게 부탁하는 길 (웹 쪽).
 *
 * <p>이 파일은 <b>웹 번들에만</b> 들어갑니다. 브라우저에서 열면 껍데기가
 * 없으므로 {@link inShell} 이 false 고, 부르는 쪽은 지금까지 쓰던 브라우저의
 * 길로 갑니다.
 *
 * <h3>왜 웹이 이것을 알아야 하나</h3>
 *
 * <p>앱은 이제 이 웹을 띄우기만 합니다. 그런데 폰만 할 수 있는 일이 몇 가지
 * 남습니다 — 구글은 웹뷰 안에서 로그인을 안 시켜 주고(창이 앱 안에 박혀
 * 있으면 막습니다), 웹뷰는 푸시 알림을 못 받습니다. 그런 것만 껍데기에
 * 넘기고 나머지는 전부 웹이 합니다.
 *
 * <p>브라우저로 들어온 사람에게는 아무것도 안 달라집니다.
 */

type Shell = { version: number; os: string };

declare global {
  interface Window {
    FIT_SHELL?: Shell;
    ReactNativeWebView?: { postMessage: (data: string) => void };
    __fitShellSays?: (raw: string) => void;
  }
}

/** 지금 앱 껍데기 안인지. 브라우저면 false 입니다. */
export const inShell =
  typeof window !== 'undefined' && !!window.FIT_SHELL && !!window.ReactNativeWebView;

/** 껍데기를 띄운 것이 무엇인지. 'ios' | 'android', 브라우저면 null. */
export const shellOs = typeof window !== 'undefined' ? (window.FIT_SHELL?.os ?? null) : null;

/** 답을 기다리고 있는 부탁들. */
const waiting = new Map<string, { ok: (v: unknown) => void; no: (e: Error) => void }>();

/** 껍데기가 먼저 거는 말을 듣는 사람들. */
const listeners = new Set<(tell: Tell) => void>();

let counter = 0;

if (typeof window !== 'undefined') {
  /*
    껍데기가 이 함수로 말을 넣습니다.

    <p>덮어쓰지 않고 한 번만 겁니다. 화면을 옮겨도 창은 그대로라, 다시
    걸면 앞서 기다리던 부탁들이 답을 못 받습니다.
  */
  window.__fitShellSays ??= (raw: string) => {
    let tell: Tell;
    try {
      tell = JSON.parse(raw) as Tell;
    } catch {
      /* 말이 깨졌습니다. 버립니다 — 여기서 터뜨리면 화면이 통째로
         하얘집니다. */
      return;
    }

    if (tell.kind === 'done' || tell.kind === 'failed') {
      const seat = waiting.get(tell.id);
      if (!seat) {
        /* 이미 떠난 화면의 부탁입니다. */
        return;
      }
      waiting.delete(tell.id);
      if (tell.kind === 'done') {
        seat.ok(tell.value);
      } else {
        seat.no(new Error(tell.why));
      }
      return;
    }

    listeners.forEach((hear) => hear(tell));
  };
}

/**
 * 껍데기에게 부탁하고 답을 기다립니다.
 *
 * <p>껍데기가 없으면 곧바로 거절합니다. 부르는 쪽이 {@link inShell} 을 먼저
 * 보게 되어 있지만, 안 보고 불러도 조용히 멈춰 있지는 않게 합니다 — 답이
 * 영영 안 오는 것이 제일 나쁩니다.
 *
 * @param seconds 이만큼 기다려도 답이 없으면 포기합니다. 껍데기가 어딘가에서
 *                넘어졌을 때 화면이 영영 "기다리는 중" 으로 남지 않게
 *                하는 것입니다
 */
export function askShell(ask: Ask, seconds = 90): Promise<unknown> {
  if (!inShell) {
    return Promise.reject(new Error('껍데기가 없습니다'));
  }
  const id = `${Date.now().toString(36)}-${counter++}`;

  return new Promise((ok, no) => {
    const timer = setTimeout(() => {
      if (waiting.delete(id)) {
        no(new Error('껍데기가 답을 안 합니다'));
      }
    }, seconds * 1000);

    waiting.set(id, {
      ok: (v) => {
        clearTimeout(timer);
        ok(v);
      },
      no: (e) => {
        clearTimeout(timer);
        no(e);
      },
    });

    window.ReactNativeWebView!.postMessage(JSON.stringify({ id, ask }));
  });
}

/**
 * 껍데기가 먼저 거는 말을 듣습니다.
 *
 * <p>알림을 눌러서 들어왔을 때가 이것입니다. 부탁한 적이 없으니 짝이 되는
 * 답이 없고, 듣고 있던 쪽이 받습니다.
 *
 * @return 그만 듣는 함수
 */
export function hearShell(hear: (tell: Tell) => void): () => void {
  listeners.add(hear);
  return () => {
    listeners.delete(hear);
  };
}
