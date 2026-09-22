import { router } from 'expo-router';

import { hearShell, inShell } from '@/lib/shell-bridge.web';

/**
 * 알림을 눌러 들어왔을 때 그 화면을 엽니다 (웹).
 *
 * <h3>왜 웹이 여는가</h3>
 *
 * <p>알림은 폰이 받습니다(껍데기). 그런데 <b>어느 화면인지</b>는 웹만
 * 압니다 — 주소와 화면을 잇는 표가 여기 있습니다. 그래서 껍데기는 주소만
 * 건네고 여는 것은 웹이 합니다.
 *
 * <p>서버가 알림에 실어 보내는 주소는 우리 것뿐입니다. 그래도 한 번 더
 * 봅니다 — 주소를 그대로 믿고 열면, 알림 내용이 어디선가 바뀌었을 때
 * 엉뚱한 곳으로 끌려갑니다.
 *
 * <p>브라우저에서는 아무 일도 안 합니다. 껍데기가 없으면 들을 말이
 * 없습니다.
 */
export function listenForShellOpen(): () => void {
  if (!inShell) {
    return () => {};
  }

  return hearShell((tell) => {
    if (tell.kind !== 'opened') {
      return;
    }

    const path = insidePath(tell.url);
    if (path) {
      router.push(path as never);
    }
  });
}

/**
 * 우리 화면 주소만 골라냅니다.
 *
 * @return 열어도 되는 앱 안 경로. 남의 자리거나 모양이 이상하면 null
 */
function insidePath(url: string): string | null {
  /* 이미 경로만 온 경우(/trip/abc). 제일 흔한 모양입니다. */
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.origin !== window.location.origin) {
      /* 남의 자리입니다. 알림을 눌렀다고 밖으로 내보내지 않습니다. */
      return null;
    }
    return parsed.pathname + parsed.search;
  } catch {
    return null;
  }
}
