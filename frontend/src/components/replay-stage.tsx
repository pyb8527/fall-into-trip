/**
 * 동선 다시 보기 — 기울인 지도 (앱 짝).
 *
 * <p>앱은 웹뷰라 이 짝은 돌지 않습니다(docs/survey-native.md §1). Metro 가
 * 짝을 찾을 수 있게 모양만 맞춰 둡니다 — 늘 「못 쓴다」고 답해 평평한
 * {@code TripMap} 으로 갑니다.
 */
export const MAP_ID = null;

export const hasTiltMaps = () => false;

export type StagePlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
  mode?: string | null;
};

export function ReplayStage(_: {
  places: StagePlace[];
  step: number;
  gone: number;
  done: boolean;
  onReady: () => void;
  height?: number;
}) {
  return null;
}
