/**
 * 여행 상세의 「3D」 보기 (앱 짝).
 *
 * <p>앱은 웹뷰라 이 짝은 돌지 않습니다(docs/survey-native.md §1). Metro 가 짝을
 * 찾을 수 있게 모양만 맞춰 둡니다 — 「3D」 단추는 hasTiltMaps 가 거짓이라
 * 이쪽에서는 안 섭니다.
 */
export type Place3D = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  dayIndex: number;
  order: number;
  color: string;
  mode?: string | null;
  path?: { lat: number; lng: number }[] | null;
};

export function TripMap3D(_: {
  places: Place3D[];
  activeId: string | null;
  onSelect: (placeId: string) => void;
}) {
  return null;
}
