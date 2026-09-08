import { Linking } from 'react-native';

import type { TravelMode } from '@/api/types';

/**
 * 길찾기를 구글 지도에 넘깁니다.
 *
 * <p>우리가 직접 안내하지 않습니다. 골목에서 실제로 길을 따라가는 일은 구글
 * 지도가 훨씬 잘합니다. 음성 안내도, 실시간 환승 정보도, 내려서 몇 번 출구로
 * 나가야 하는지도 그쪽에 있습니다. 사용자는 어차피 그걸 켤 텐데, 주소를
 * 옮겨 적게 만들 이유가 없습니다.
 *
 * <p>여기서 만드는 주소는 구글이 정한 범용 형식이라 웹에서는 새 창으로,
 * 앱이 깔린 폰에서는 앱으로 열립니다. 우리가 플랫폼을 가릴 필요가 없습니다.
 *
 * @see https://developers.google.com/maps/documentation/urls/get-started
 */

/** 우리 이동 수단을 구글이 쓰는 이름으로. */
const AS_GOOGLE: Record<TravelMode, string> = {
  WALK: 'walking',
  TRANSIT: 'transit',
  DRIVE: 'driving',
};

export type Destination = {
  name: string;
  lat: number;
  lng: number;
  /**
   * 구글이 아는 그 장소의 번호.
   *
   * 좌표만 주면 길 건너 엉뚱한 건물로 안내될 때가 있습니다. 번호를 같이
   * 주면 구글이 정확히 그 가게를 집습니다. 없으면 좌표만으로도 됩니다.
   */
  placeId?: string | null;
};

export function directionsUrl(to: Destination, mode: TravelMode | null) {
  const params = new URLSearchParams({
    api: '1',
    /* 좌표를 목적지로 주되, 이름도 함께 실어 구글 화면에 뭐라고 뜰지 맞춥니다. */
    destination: `${to.lat},${to.lng}`,
    travelmode: AS_GOOGLE[mode ?? 'TRANSIT'],
  });
  if (to.placeId) {
    params.set('destination_place_id', to.placeId);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * 출발지는 넣지 않습니다. 비워 두면 구글이 현재 위치에서 출발한다고 봅니다.
 * 우리가 위치를 알아내 넘기는 것보다 정확하고, 위치 권한도 그쪽에서 받습니다.
 */
export async function openDirections(to: Destination, mode: TravelMode | null) {
  const url = directionsUrl(to, mode);
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    /* 열 수 있는 앱도 브라우저도 없는 경우입니다. 화면이 알려 주게 합니다. */
    return false;
  }
}
