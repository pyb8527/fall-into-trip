import type { TripMapProps } from '@/components/map-types';

export type { MapPlace } from '@/components/map-types';

/**
 * 지도 (앱).
 *
 * <p>웹은 trip-map.web.tsx 가 구글 지도 JS API 로 그립니다. 앱에서 지도를
 * 그리려면 네이티브 지도 SDK 가 들어간 개발용 빌드가 필요한데, 아직 거기까지
 * 가지 않았습니다. 그래서 지도 자리를 비우고 나머지(목록·장소 편집)는 그대로
 * 씁니다.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TripMap(_props: TripMapProps) {
  return null;
}
