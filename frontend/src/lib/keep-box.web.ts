import type { Box } from '@/lib/keep-box';

export type { Box } from '@/lib/keep-box';

/**
 * 담아 둘 상자 (웹).
 *
 * <p>브라우저의 localStorage 를 그대로 씁니다. 앱 쪽(keep-box.ts)은
 * expo-sqlite 의 kv-store 를 같은 생김새로 감싸 둡니다.
 */
export function keepBox(): Box | null {
  try {
    /* 사파리의 사생활 보호 모드처럼 있는데 못 쓰는 경우가 있습니다. */
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
