import type { Move, Station } from '@/api/types';

/**
 * 한 구간(이 장소 → 다음 장소)을 어떤 토막으로 지나는지.
 *
 * <p>지도 선(평평한 지도 · 3D)과 3D 탈것이 <b>같은 점 목록</b>을 씁니다. 선은
 * 역을 거쳐 꺾이는데 탈것은 곧게 가면, 보이는 길과 가는 길이 달라 어느 쪽도
 * 믿기 어렵습니다. 그래서 여기 한 곳에서만 만듭니다.
 *
 * <p>구글 경로선을 따라가던 자리입니다. 길찾기 셈을 걷어낸 뒤(2026-10-13,
 * lib/directions)로는 사람이 적어 둔 역만 씁니다 — 역이 없으면 두 곳을 곧게
 * 잇는 한 토막입니다.
 */
export type LatLng = { lat: number; lng: number };

export type LegPiece = {
  from: LatLng;
  to: LatLng;
  /**
   * 타고 가는 토막인지. 아니면 역까지(또는 역에서) 걷는 토막입니다 — 지도에서는
   * 점선, 탈것은 걷는 사람입니다.
   */
  ride: boolean;
  /** 이 토막의 수단(lib/vehicles 의 FROM_MODE 열쇠). 모르면 null — 거리로 고릅니다. */
  mode: string | null;
};

/**
 * 역 · 정류장을 적는 수단.
 *
 * <p>「닛포리 역」 을 장소로 넣던 사람들이 정말 적고 싶던 것은 <b>어느 역에서 타서
 * 어느 역에서 내리는지</b>였습니다. 탈 곳이 있는 수단에만 칸을 엽니다 — 걷기 ·
 * 택시에 「타는 역」 이 서면 무엇을 적으라는 것인지 모릅니다.
 */
export const STATION_MODES = new Set(['transit', 'bus']);

/** 좌표까지 있는 역. 지도에 세우고 거쳐 갈 수 있는 것만입니다. */
export function placed(st: Station | null | undefined): st is Station & { lat: number; lng: number } {
  return !!st && st.lat != null && st.lng != null;
}

/** 이 이동에서 지도에 세울 역들(타는 역, 내리는 역 차례). */
export function stationsOf(move: Move | null | undefined): (Station & LatLng)[] {
  if (!move?.mode || !STATION_MODES.has(move.mode)) {
    return [];
  }
  return [move.from, move.to].filter(placed);
}

/**
 * A → (타는 역) → (내리는 역) → B.
 *
 * <p>타는 역까지와 내리는 역부터는 걷고, 역과 역 사이는 탑니다. 역을 하나만 적었으면
 * 그쪽만 꺾습니다 — 타는 역만 적었으면 거기서부터 B 까지 탑니다.
 */
export function legPieces(a: LatLng, b: LatLng, move: Move | null | undefined): LegPiece[] {
  const mode = move?.mode ?? null;
  const from = move?.mode && STATION_MODES.has(move.mode) && placed(move.from) ? move.from : null;
  const to = move?.mode && STATION_MODES.has(move.mode) && placed(move.to) ? move.to : null;
  if (!from && !to) {
    return [{ from: a, to: b, ride: true, mode }];
  }
  const out: LegPiece[] = [];
  const boardAt: LatLng = from ? { lat: from.lat, lng: from.lng } : a;
  const leaveAt: LatLng = to ? { lat: to.lat, lng: to.lng } : b;
  if (from) {
    out.push({ from: a, to: boardAt, ride: false, mode: 'walk' });
  }
  out.push({ from: boardAt, to: leaveAt, ride: true, mode });
  if (to) {
    out.push({ from: leaveAt, to: b, ride: false, mode: 'walk' });
  }
  return out;
}
