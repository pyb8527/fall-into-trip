/**
 * 여행 하나를 폰 캘린더에 꽂기 (앱).
 *
 * <p>앱은 웹을 띄우는 껍데기라 이 화면들은 앱 묶음에 안 들어갑니다
 * (index.js 는 shell 하나만 실습니다). 그래도 파일이 있어야 합니다 —
 * Metro 는 불러오는 자리를 <b>실행하기 전에</b> 찾아 두므로, 짝이 없으면
 * 앱 묶음을 만드는 것 자체가 실패합니다({@code lib/pick-photo.ts} 와 같은
 * 자리입니다).
 *
 * <p>실제로 꽂는 쪽은 {@code shell/calendar.ts} 입니다. 앱이 화면을 직접
 * 그리게 되는 날에는 그 함수를 여기서 그대로 부르면 됩니다.
 */
import type { Added, TripEvent } from '@/lib/calendar.web';

export type { TripEvent, Added } from '@/lib/calendar.web';

/** 이 자리에서 꽂을 수 있는지. 화면이 단추를 낼지 말지를 이것으로 정합니다. */
export const canAddToCalendar = false;

/* trip 은 웹 쪽 짝과 모양을 맞추려고 받습니다. 여기서는 아무것도 안
   꽂으므로 쓸 일이 없습니다. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function addToCalendar(trip: TripEvent): Promise<Added> {
  return 'tooOld';
}
