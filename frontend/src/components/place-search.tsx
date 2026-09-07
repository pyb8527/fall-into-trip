import type { PlaceSearchProps } from '@/components/map-types';

/**
 * 장소 검색 (앱).
 *
 * 웹은 place-search.web.tsx 가 구글 장소 검색을 씁니다. 앱에서는 아직
 * 자리를 비우고, 이름과 좌표를 직접 넣는 길만 둡니다.
 */

/** 이 환경에서 장소 검색이 되는지. 안 되면 화면이 좌표 칸을 대신 엽니다. */
export const hasPlaceSearch = () => false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PlaceSearch(_props: PlaceSearchProps) {
  return null;
}
