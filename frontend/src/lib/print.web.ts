import type { Day, Place, TripDetail } from '@/api/types';

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

/** 종이 한 장. */
function paper(trip: TripDetail): string {
  const days = trip.days;
  const total = days.reduce((n, d) => n + d.places.length, 0);
  const span =
    days.length === 0
      ? ''
      : `${days[0].date ?? days[0].label} ~ ${days[days.length - 1].date ?? days[days.length - 1].label}`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(trip.trip.title)}</title>
<style>
  @page { size: A4; margin: 14mm; }

  /* 종이에는 우리 글꼴을 싣지 않습니다. 인쇄는 대개 한 번뿐인데 그것 하나
     받자고 기다리게 할 일이 아니고, 기기에 있는 것으로도 충분합니다. */
  body {
    margin: 0;
    color: #000;
    background: #fff;
    font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
  }

  h1 { margin: 0 0 2mm; font-size: 17pt; letter-spacing: -0.02em; }
  .span { margin: 0 0 6mm; font-size: 9.5pt; color: #444; }

  /* 하루가 페이지 중간에서 잘리면 앞장 뒷장을 오가며 봐야 합니다. */
  .day { break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }
  .dayhead {
    display: flex; align-items: baseline; gap: 3mm;
    border-bottom: 0.6pt solid #000;
    padding-bottom: 1.2mm; margin-bottom: 2mm;
  }
  .dayhead b { font-size: 12pt; }
  .dayhead span { font-size: 9pt; color: #444; }

  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1.1mm 0; }

  /* 시간은 자릿수를 맞춰 세웁니다. 세로로 훑을 때 눈이 흔들리지 않습니다. */
  .time { width: 15mm; font-variant-numeric: tabular-nums; color: #444; font-size: 9.5pt; }
  .no { width: 7mm; font-variant-numeric: tabular-nums; color: #666; font-size: 9.5pt; }
  .name { font-weight: 600; }
  .sub { font-size: 9pt; color: #444; }

  /* 길에서 적어 넣을 자리. 종이로 뽑는 이유의 절반은 이것입니다. */
  .blank { border-bottom: 0.4pt dotted #999; height: 4mm; }

  .foot { margin-top: 8mm; font-size: 8.5pt; color: #666; }
</style>
</head>
<body>
  <h1>${esc(trip.trip.title)}</h1>
  <p class="span">${esc(span)}${span ? ' · ' : ''}${days.length}일 · 장소 ${total}곳</p>
  ${days.map(dayBlock).join('')}
  <p class="foot">FIT — fall into trip</p>
</body>
</html>`;
}

function dayBlock(day: Day): string {
  const rows = day.places.length
    ? day.places.map(placeRow).join('')
    : '<tr><td colspan="3" class="sub">아직 넣어 둔 곳이 없습니다.</td></tr>';

  return `<div class="day">
  <div class="dayhead">
    <b>${esc(day.date ?? day.label)}</b>
    ${day.shortName ? `<span>${esc(day.shortName)}</span>` : ''}
    ${day.theme ? `<span>${esc(day.theme)}</span>` : ''}
    ${day.budget ? `<span>예산 ${esc(day.budget)}</span>` : ''}
  </div>
  <table>${rows}</table>
</div>`;
}

function placeRow(place: Place, i: number): string {
  /* 원어 이름을 함께 적습니다. 종이를 들고 현지에서 물어볼 때 한글 이름은
     아무 도움이 안 됩니다. */
  const other = place.ja || place.en;
  const under = [other, place.cat, place.cost, place.note].filter(Boolean).join(' · ');

  return `<tr>
  <td class="time">${esc(place.time ?? '')}</td>
  <td class="no">${i + 1}</td>
  <td>
    <div class="name">${esc(place.name)}</div>
    ${under ? `<div class="sub">${esc(under)}</div>` : '<div class="blank"></div>'}
  </td>
</tr>`;
}

/** 이름에 꺾쇠가 들어 있어도 문서가 깨지지 않게. */
function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
