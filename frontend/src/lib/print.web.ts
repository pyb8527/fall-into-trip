import type { TripDetail } from '@/api/types';

import { paper } from '@/lib/print-paper';

/**
 * 일정을 종이 한 장으로.
 *
 * <h3>왜 화면을 그대로 뽑지 않는가</h3>
 *
 * <p>지금 화면은 지도가 바탕이고 그 위에 판이 얹혀 있습니다. 그대로 뽑으면
 * 지도의 회색 무늬가 잉크를 다 먹고, 정작 필요한 글자는 판 안에 잘려
 * 들어갑니다. 화면에서 좋은 짜임과 종이에서 좋은 짜임은 다릅니다.
 *
 * <p>그래서 인쇄용 문서를 따로 짭니다. 흰 종이에 검은 글씨, 하루가 한 덩어리,
 * 덩어리는 페이지 중간에서 잘리지 않게. 지도도 색도 없습니다 — 길에서 꺼내
 * 보거나 숙소에 붙여 두는 종이입니다.
 *
 * <h3>새 창이 아니라 숨은 틀에서</h3>
 *
 * <p>window.open 으로 창을 열면 팝업 차단에 걸립니다. 사람이 단추를 눌러
 * 시작한 일인데도 브라우저에 따라 막힙니다. 보이지 않는 iframe 을 하나
 * 만들어 그 안에서 인쇄하면 그럴 일이 없습니다.
 */
export const canPrint = true;

export function printItinerary(trip: TripDetail): void {
  const frame = document.createElement('iframe');
  /* 화면 밖으로 밀어 둡니다. display:none 으로 두면 브라우저에 따라 안이
     그려지지 않아 빈 종이가 나옵니다. */
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(paper(trip));
  doc.close();

  const win = frame.contentWindow;
  if (!win) {
    document.body.removeChild(frame);
    return;
  }

  /* 글꼴이 잡히기 전에 부르면 줄이 밀린 채로 뽑힙니다. 다 그려진 뒤에
     엽니다. */
  const go = () => {
    win.focus();
    win.print();
    /* 인쇄 판이 닫힌 뒤에 치웁니다. 바로 지우면 판이 뜨기도 전에 문서가
       사라져 빈 종이가 나옵니다. */
    setTimeout(() => {
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    }, 1000);
  };

  if (doc.readyState === 'complete') {
    go();
  } else {
    win.addEventListener('load', go);
  }
}
