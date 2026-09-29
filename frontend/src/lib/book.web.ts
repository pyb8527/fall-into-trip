import { askShell, inShell } from '@/lib/shell-bridge.web';
import { sheetFileName, tripSheets } from '@/lib/sheet';
import type { Spend, TripDetail } from '@/api/types';

/**
 * 여행을 엑셀 파일로 구워 내려 줍니다 (웹).
 *
 * <h3>누를 때만 받습니다</h3>
 *
 * <p>엑셀을 굽는 라이브러리는 이 앱에서 제일 무거운 짐입니다. 화면 꾸러미에
 * 같이 실으면 <b>엑셀을 한 번도 안 받는 사람까지</b> 열 때마다 그것을
 * 받습니다. 그래서 단추를 누른 그 순간에 받습니다({@code import()}).
 * 처음 한 번만 기다리고 그 뒤로는 브라우저가 들고 있습니다.
 *
 * <h3>읽지는 않습니다</h3>
 *
 * <p>이 라이브러리의 알려진 약점은 전부 <b>남이 준 파일을 읽을 때</b>
 * 생깁니다(프로토타입 오염·정규식 폭주). 우리는 굽기만 하고 절대 안
 * 읽습니다 — {@code XLSX.read} 를 이 저장소 어디에도 두지 마세요. 읽을 일이
 * 생기면 그때는 라이브러리를 바꾸는 것이 맞습니다.
 */

/** 엑셀이 쓰는 이름. 브라우저가 이 이름을 보고 무엇으로 열지 정합니다. */
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function downloadTripBook(
  trip: TripDetail,
  spends: Spend[] | null,
): Promise<void> {
  const XLSX = await import('xlsx');
  const sheets = tripSheets(trip, spends);

  const book = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const page = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.widths) {
      /* 열 너비를 안 주면 긴 장소 이름이 '####' 로 잘립니다. 받자마자
         칸을 늘려야 읽히는 표는 정리해 준 것이 아닙니다. */
      page['!cols'] = sheet.widths.map((wch) => ({ wch }));
    }
    XLSX.utils.book_append_sheet(book, page, sheet.name);
  }

  const bytes: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  await handOver(new Uint8Array(bytes), sheetFileName(trip));
}

/**
 * 만든 파일을 기기에 넘깁니다.
 *
 * <p>브라우저에서는 링크 하나 만들어 누르면 됩니다. <b>앱 껍데기 안에서는
 * 그것이 안 먹습니다</b> — 웹뷰는 내려받기를 제가 처리하지 않고 그냥
 * 무시합니다. 눌렀는데 아무 일도 안 일어나는 모양이 됩니다.
 *
 * <p>그래서 껍데기에 넘겨 폰이 받게 합니다. 인쇄·공유와 같은 자리입니다.
 */
async function handOver(bytes: Uint8Array, name: string): Promise<void> {
  if (inShell) {
    await askShell({ kind: 'saveFile', name, mime: XLSX_MIME, base64: toBase64(bytes) });
    return;
  }

  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  /* 곧바로 거두면 브라우저가 받기도 전에 사라집니다. 한 박자 둡니다. */
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * 껍데기로 넘기려면 글자여야 합니다.
 *
 * <p>웹과 껍데기 사이는 글자만 오갑니다(postMessage). 파일은 바이트라
 * base64 로 바꿔 넘깁니다.
 *
 * <p>한 번에 다 넘기면 큰 파일에서 부릅니다 — {@code apply} 에 넘길 수 있는
 * 인자 수에 한계가 있습니다. 나눠서 이어 붙입니다.
 */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let raw = '';
  for (let at = 0; at < bytes.length; at += CHUNK) {
    raw += String.fromCharCode(...bytes.subarray(at, at + CHUNK));
  }
  return btoa(raw);
}
