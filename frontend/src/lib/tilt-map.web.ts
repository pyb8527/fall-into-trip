import { gmaps, loadMaps } from '@/lib/gmaps.web';

/**
 * 기울인 지도 — 구글 벡터 지도를 비스듬히 눕히고 돌릴 수 있게 세웁니다.
 *
 * <h3>왜 따로 두는가</h3>
 *
 * <p>동선 다시 보기(components/replay-stage)가 처음 썼고, 여행 상세의 「3D」
 * 보기도 같은 지도를 씁니다. 지도 ID · 벡터 · 첫 기울기를 한 곳에서 정해야 두
 * 화면이 같은 모양으로 섭니다.
 *
 * <h3>지도 ID 가 있어야 합니다</h3>
 *
 * <p>벡터 · 기울기 · 회전은 {@code mapId} 가 있는 지도에서만 됩니다
 * (EXPO_PUBLIC_GMAPS_MAP_ID, 콘솔에서 「JavaScript · 벡터 · 기울기와 회전」으로
 * 만든 것). 없으면 {@link hasTiltMaps} 가 거짓이고, 부르는 쪽은 평평한
 * {@code TripMap} 을 씁니다.
 *
 * <p>{@code mapId} 를 쓰면 {@code styles} 가 무시됩니다 — 일정 화면의 평평한
 * 지도는 {@code styles} 로 꾸미고, 기울인 지도는 콘솔의 모양을 씁니다. 한
 * 화면에서 둘을 오가면 색이 바뀌어 보일 수 있습니다(콘솔 모양을 앱 색에 맞춰
 * 두면 덜합니다).
 */

export const MAP_ID = process.env.EXPO_PUBLIC_GMAPS_MAP_ID ?? null;

/** 기울인 지도를 쓸 수 있는지. 지도 ID 가 있어야 합니다. */
export const hasTiltMaps = () => Boolean(MAP_ID);

/**
 * 배율에 맞는 기울기. 가까울수록 눕힙니다 — 구글은 배율이 낮으면 많이 못
 * 눕히고, 멀리서 많이 눕히면 지평선만 보입니다. 배율과 함께 움직여야 날아오를 때
 * 자연스럽게 세워집니다.
 */
export function tiltFor(zoom: number) {
  const k = Math.max(0, Math.min(1, (zoom - 9) / 8));
  return 30 + k * 37;
}

/**
 * 기울인 지도를 세우고, 처음 다 그려질 때(idle) 돌려줍니다.
 *
 * <p>지도 물건은 any 입니다(lib/gmaps.web 와 같은 규칙).
 *
 * @throws 키나 지도 ID 가 없거나 스크립트를 못 받았을 때
 */
export async function createTiltMap(
  box: HTMLElement,
  center: { lat: number; lng: number },
  zoom = 14,
): Promise<any> {
  await loadMaps();
  if (!MAP_ID) {
    throw new Error('지도 ID 가 없어요.');
  }
  const g = gmaps();
  const map = new g.Map(box, {
    mapId: MAP_ID,
    renderingType: g.RenderingType?.VECTOR ?? 'VECTOR',
    center,
    zoom,
    tilt: tiltFor(zoom),
    heading: 0,
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    keyboardShortcuts: false,
    clickableIcons: false,
  });
  await new Promise<void>((resolve) => g.event.addListenerOnce(map, 'idle', () => resolve()));
  return map;
}
