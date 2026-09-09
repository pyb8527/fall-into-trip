import type { ApiClient } from '@/lib/notify.web';

/**
 * 동행자가 고쳤을 때 알려 주기.
 *
 * <p>앱에서는 아직 못 합니다. 폰 알림은 운영체제 쪽 모듈을 붙여야 하는 일이고,
 * 그것은 앱을 다시 빌드해야 들어갑니다(docs/design.md). 그때까지는 스위치를
 * 내지 않습니다 — 켰는데 안 오는 것만큼 나쁜 것이 없습니다.
 *
 * <p>웹에서는 notify.web.ts 가 잡혀 브라우저 알림으로 갑니다.
 */
export const canNotify = false;

export async function notifyState(): Promise<'off' | 'on' | 'blocked'> {
  return 'off';
}

export async function turnOn(_api: ApiClient): Promise<'on' | 'blocked' | 'failed'> {
  return 'failed';
}

export async function turnOff(_api: ApiClient): Promise<void> {
  /* 켤 수 없으니 끌 것도 없습니다. */
}
