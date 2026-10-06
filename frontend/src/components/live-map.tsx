import type { Here } from '@/lib/here';

/**
 * 「지금 여기」 지도 (앱 짝).
 *
 * <p>앱은 웹뷰라 이 짝은 돌지 않습니다(docs/survey-native.md §1). Metro 가 짝을
 * 찾을 수 있게 모양만 맞춰 둡니다.
 */
export type LiveTarget = { id: string; lat: number; lng: number; name: string; color: string };
export type LiveMate = { id: string; name: string; lat: number; lng: number; face: string };

export function LiveMap(_: {
  here: Here | null;
  threeD: boolean;
  target?: LiveTarget | null;
  mates?: LiveMate[];
  bottomInset?: number;
}) {
  return null;
}
