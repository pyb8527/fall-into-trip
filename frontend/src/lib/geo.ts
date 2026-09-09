/**
 * 좌표 사이의 거리.
 *
 * 지도 라이브러리에도 비슷한 것이 있지만, 그것은 지도가 떠 있어야 쓸 수
 * 있습니다. 여기서 필요한 것은 지도와 상관없이 "여기와 저기가 같은 자리인가"
 * 를 재는 일이라 따로 둡니다.
 */

/** 위경도만 있으면 됩니다. 핀이든 장소든 내 자리든 다 통합니다. */
type At = { lat: number; lng: number };

/**
 * 두 좌표 사이의 거리(미터).
 *
 * 지구를 공으로 놓고 잽니다. 실제 지구는 조금 눌린 타원이라 아주 먼 거리에서는
 * 몇 미터씩 어긋나지만, 우리가 쓰는 곳은 수십 미터짜리 판단이라 그 차이가
 * 문제되지 않습니다.
 */
export function metersBetween(a: At, b: At): number {
  const r = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * 같은 자리로 보는 거리(미터).
 *
 * 휴대폰이 알려 주는 자리는 건물 안이나 골목에서 이십 미터쯤 흔들립니다.
 * 그래서 가만히 서서 두 번 눌러도 좌표는 조금씩 다릅니다. 그 흔들림보다 조금
 * 넉넉하게 잡아야 "같은 자리" 를 제대로 알아봅니다.
 *
 * 서버에도 같은 값이 있습니다(LiveService.SAME_SPOT). 한쪽만 바꾸면 화면은
 * 괜찮다는데 서버가 거절하는 일이 생깁니다.
 */
export const SAME_SPOT = 30;
