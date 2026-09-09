import type { TripDetail } from '@/api/types';

/**
 * 일정을 종이 한 장으로.
 *
 * <p>앱에서는 아직 못 합니다. 인쇄는 운영체제 쪽 모듈을 붙여야 하는 일이고,
 * 그것은 앱을 다시 빌드해야 들어갑니다(docs/design.md). 그때까지는 단추를
 * 내지 않습니다 — 눌러서 안 되는 것을 보여 주느니 없는 편이 낫습니다.
 *
 * <p>웹에서는 print.web.ts 가 잡혀 브라우저 인쇄 판을 엽니다.
 */
export const canPrint = false;

export function printItinerary(_trip: TripDetail): void {
  /* 여기까지 올 일이 없습니다. canPrint 가 false 라 단추가 안 뜹니다. */
}
