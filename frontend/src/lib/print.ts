import * as Print from 'expo-print';

import type { TripDetail } from '@/api/types';
import { paper } from '@/lib/print-paper';

/**
 * 일정을 종이 한 장으로 (앱).
 *
 * <h3>앱에서는 인쇄가 곧 공유입니다</h3>
 *
 * <p>폰에 프린터가 물려 있는 일은 드뭅니다. 그런데 iOS 와 안드로이드의 인쇄
 * 판은 <b>PDF 로 저장</b>과 <b>다른 앱으로 보내기</b>를 같은 자리에서
 * 내줍니다 — 실제로 쓰는 길은 대개 그쪽입니다. 숙소에 붙일 종이는 나중에
 * 뽑더라도, 지금 필요한 것은 안 터지는 데서 열어 볼 한 장입니다.
 *
 * <p>그래서 단추 이름을 바꾸지 않습니다. 누르면 그 판이 뜨고, 거기서 뽑든
 * 저장하든 보내든 고르면 됩니다.
 *
 * <h3>종이는 웹과 같은 것을 씁니다</h3>
 *
 * <p>짜는 일은 {@link paper} 하나가 합니다(print-paper). 웹은 그것을 숨은
 * iframe 에 넣고, 여기서는 expo-print 에 넘깁니다. 짜는 일을 양쪽에 두면
 * 한쪽만 고치는 날 두 종이가 달라집니다.
 */
export const canPrint = true;

export function printItinerary(trip: TripDetail): void {
  /*
    기다리지 않습니다.

    <p>인쇄 판은 운영체제가 띄우고 사람이 거기서 고릅니다. 우리가 그 결과를
    받아 할 일이 없으므로, 부르는 쪽을 붙들고 있을 이유도 없습니다.

    <p>사람이 판을 그냥 닫으면 거절로 떨어집니다. 그것은 취소이지 잘못이
    아니므로 조용히 넘어갑니다 — 화면에 "인쇄 실패" 를 띄우면 취소한 사람이
    무언가 잘못한 줄 압니다.
  */
  Print.printAsync({ html: paper(trip) }).catch(() => {
    /* 취소했거나 이 기기가 못 합니다. 둘 다 말할 것이 없습니다. */
  });
}
