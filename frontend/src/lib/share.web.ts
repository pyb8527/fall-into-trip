/**
 * 링크를 남에게 보냅니다 (웹).
 *
 * <p>폰 브라우저에는 공유 판이 있고 데스크톱에는 없습니다. 있으면 그걸
 * 쓰고, 없으면 클립보드에 넣습니다. 둘 다 안 되면 화면에 띄워 둔 링크를
 * 직접 긁는 수밖에 없습니다.
 *
 * <p>앱 껍데기 안에서는 웹뷰에 공유 판이 없습니다. 껍데기에게 넘겨 폰의
 * 공유 판을 엽니다 — 브라우저로 들어온 사람에게는 아무것도 안 달라집니다.
 */
import { askShell, inShell } from '@/lib/shell-bridge.web';

export type ShareResult = 'sent' | 'copied' | 'failed';

export async function shareLink(url: string, title: string): Promise<ShareResult> {
  if (inShell) {
    try {
      return (await askShell({ kind: 'share', url, title })) as ShareResult;
    } catch {
      /* 껍데기가 못 했습니다. 아래 클립보드 길로 내려갑니다. */
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'sent';
    } catch {
      /* 사용자가 닫았을 수도, 브라우저가 거절했을 수도 있습니다.
         가르지 않고 클립보드로 넘어갑니다. */
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      /* 보안 맥락(https)이 아니면 막힙니다. */
    }
  }

  return 'failed';
}
