import { Linking } from 'react-native';

import type { Move, Station, TravelMode } from '@/api/types';

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

/**
 * 장소 사이 길찾기 — 이 앱이 길을 셈하던 자리를 대신합니다.
 *
 * <h3>왜 셈을 걷어냈나 (2026-10-13)</h3>
 *
 * <p>장소 사이마다 구글 Routes 로 세 수단(걷기 · 대중교통 · 차)을 물어 「몇 분 ·
 * 얼마」, 빠름 · 저렴 칩, 「N분 모자라요」 경고, 숙소 앞뒤 구간까지 그렸습니다.
 * 그런데 그 숫자가 실제와 자주 안 맞았습니다 — 일본은 대중교통을 API 로 거의
 * 안 주고, 택시 요금은 우리가 어림한 값이고, 출발 시각은 경도로 짐작했습니다.
 * 그리고 사람은 어차피 길 위에서 구글 지도를 켭니다. 틀릴 수 있는 숫자를 사 와서
 * 보여 주느니, 그 두 곳을 구글 지도에 그대로 넘깁니다. 구글 호출도 그만큼
 * 줄었습니다(장소 N곳이면 하루를 펼칠 때마다 3×(N−1)번이었습니다).
 *
 * <p>사람이 적어 둔 이동({@code place.move})은 그대로 둡니다. 그쪽은 셈이 아니라
 * 사람이 정한 길이라 틀릴 일이 없습니다. 수단도 거기서 읽습니다.
 */
export type Spot = {
  name: string;
  lat: number;
  lng: number;
  placeId?: string | null;
};

/** 사람이 적은 수단 → 구글 길찾기 수단. 모르거나 안 적었으면 대중교통입니다. */
export function travelModeOf(move: Move | null | undefined): TravelMode {
  switch (move?.mode) {
    case 'walk':
      return 'WALK';
    case 'car':
    case 'taxi':
      return 'DRIVE';
    default:
      /* transit · bus 는 물론이고, 비행기 · 배도 구글에서는 대중교통 쪽이
         가장 가깝습니다. */
      return 'TRANSIT';
  }
}

/* 좌표가 있으면 좌표를, 이름만 적은 역이면 이름을 넘깁니다 — 구글이 이름으로도
   찾아 줍니다. */
function where(at: Spot | Station) {
  return at.lat != null && at.lng != null ? `${at.lat},${at.lng}` : at.name;
}

/**
 * A 에서 B 까지 구글 지도 길찾기 주소.
 *
 * <h3>역을 적어 두었으면</h3>
 *
 * <p>대중교통 길은 <b>출발역 → 도착역</b>으로 엽니다. A → 출발역 → 도착역 → B 를
 * 경유지(waypoints)로 넣고 싶었지만, 구글 지도는 대중교통 길에 경유지를 받지
 * 않습니다(앱에서도 「경유지 추가」 가 대중교통에는 없고, 문서는 「경유지를 안
 * 받는 제품에서는 이 값을 무시한다」 고만 적어 둡니다). 넣으면 조용히 버려져
 * A → B 가 열리고, 그러면 적어 둔 역이 아무 소용이 없습니다. 역까지 걷는 짧은
 * 길은 지도 앱이 알아서 붙입니다. 역 하나만 적었으면 그쪽만 바꿉니다.
 */
export function routeUrl(from: Spot, to: Spot, move?: Move | null) {
  const mode = travelModeOf(move);
  const start = mode === 'TRANSIT' && move?.from ? move.from : from;
  const end = mode === 'TRANSIT' && move?.to ? move.to : to;
  const params = new URLSearchParams({
    api: '1',
    origin: where(start),
    destination: where(end),
    travelmode: AS_GOOGLE[mode],
  });
  if (start.placeId) {
    params.set('origin_place_id', start.placeId);
  }
  if (end.placeId) {
    params.set('destination_place_id', end.placeId);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export async function openRoute(from: Spot, to: Spot, move?: Move | null) {
  try {
    await Linking.openURL(routeUrl(from, to, move));
    return true;
  } catch {
    return false;
  }
}

/**
 * 그 장소를 구글 지도에서 엽니다.
 *
 * <p>길찾기와 다릅니다. 길찾기는 "어떻게 가지" 이고 이쪽은 "여기가 어떤
 * 데지" 입니다 — 사진, 후기, 메뉴, 거리뷰. 우리가 갖고 있지 않은 것들이
 * 거기 다 있고, 우리가 그것을 옮겨 오는 것은 약관상으로도 품으로도 할 일이
 * 아닙니다.
 *
 * <p>구글이 그 장소의 주소를 직접 알려 준 것이 있으면 그것을 씁니다(가장
 * 정확합니다). 없으면 좌표와 번호로 만듭니다 — 번호가 있으면 길 건너 엉뚱한
 * 건물이 열리는 일이 없습니다.
 */
export function placeUrl(at: Destination, mapUrl?: string | null) {
  if (mapUrl) {
    return mapUrl;
  }
  const params = new URLSearchParams({
    api: '1',
    query: `${at.lat},${at.lng}`,
  });
  if (at.placeId) {
    params.set('query_place_id', at.placeId);
  }
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export async function openPlace(at: Destination, mapUrl?: string | null) {
  try {
    await Linking.openURL(placeUrl(at, mapUrl));
    return true;
  } catch {
    return false;
  }
}
