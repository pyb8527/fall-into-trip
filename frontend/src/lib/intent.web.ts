import type { Intent, IntentState, Progress } from '@/lib/intent-types';

/**
 * 기기 안의 모델 — 웹에는 없습니다.
 *
 * <p>실제 서비스는 nginx 가 내보내는 웹 빌드이고, 거기서 1GB 짜리 모델은
 * 성립하지 않습니다. 브라우저에 그만한 것을 받게 할 수도 없고, 받아도 탭
 * 하나가 그 메모리를 들고 있어야 합니다.
 *
 * <p>그래서 웹은 늘 <code>null</code> 입니다. 화면은 그때 문장을 그대로
 * 서버에 보내고, 서버는 그것을 그대로 구글에 넘깁니다. 결과가 조금 덜
 * 맞을 뿐 못 쓰는 것이 아닙니다.
 *
 * <p>이 파일이 있는 덕에 웹 번들에는 모델 라이브러리가 아예 안 들어갑니다.
 * <code>lib/here.ts</code>·<code>here.web.ts</code> 와 같은 방식입니다.
 */
export const canParseHere = false;

export function intentState(): IntentState {
  return 'none';
}

export async function fetchModel(_onProgress?: (p: Progress) => void): Promise<boolean> {
  return false;
}

export async function parseIntent(_query: string): Promise<Intent | null> {
  return null;
}

export async function dropModel(): Promise<void> {
  /* 받아 둔 것이 없습니다. */
}
