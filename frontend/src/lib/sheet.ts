import { decimalsOf, money } from '@/lib/money';
import type { Spend, TripDetail } from '@/api/types';

/**
 * 여행을 표로 폅니다.
 *
 * <h3>왜 엑셀인가</h3>
 *
 * <p>인쇄는 이미 있습니다(print-paper). 그런데 종이는 <b>읽는 것</b>이고,
 * 엑셀로 빼 가는 사람은 대개 <b>고치려는 것</b>입니다 — 정산을 다시 셈해
 * 보거나, 회사에 낼 양식에 옮겨 붙이거나, 다음 여행의 밑그림으로 씁니다.
 * 그래서 담는 것도 다릅니다. 종이에는 안 싣는 숫자 비용과 통화를 여기서는
 * 칸으로 나눠 둡니다.
 *
 * <h3>여기서는 파일을 안 만듭니다</h3>
 *
 * <p>이 파일이 하는 일은 <b>무엇이 어느 칸에 서는가</b>뿐입니다. 실제
 * 엑셀 파일로 굽는 것과 그것을 기기에 내려 주는 것은 쪽마다 달라서
 * 따로 둡니다(book.web). 칸 차례를 바꾸고 싶으면 여기만 봅니다.
 */

/** 시트 한 장. 첫 줄이 머리글입니다. */
export type Sheet = {
  name: string;
  /** 머리글 한 줄과 그 아래 줄들. 칸은 글자 아니면 숫자입니다. */
  rows: (string | number | null)[][];
  /** 칸마다의 너비(글자 수). 안 주면 내용에 맡깁니다. */
  widths?: number[];
};

/** 일정 시트의 칸 차례. 머리글과 줄이 어긋나지 않게 한 곳에서 씁니다. */
const PLAN_HEAD = ['순', '시각', '장소', '현지 이름', '갈래', '비용', '금액', '통화', '메모'];
const PLAN_WIDTH = [4, 7, 24, 20, 10, 14, 10, 6, 7, 40];

/** 가계부 시트의 칸 차례. */
const SPEND_HEAD = ['날짜', '장소', '갈래', '무엇에', '금액', '통화', '낸 사람', '나눠 낸 사람 수'];
const SPEND_WIDTH = [12, 20, 10, 24, 12, 6, 12, 14];

/**
 * 시트 이름으로 쓸 수 있게 다듬습니다.
 *
 * <p>엑셀은 시트 이름에 못 쓰는 글자가 있고(: \ / ? * [ ]) 31자를 넘기면
 * 파일이 안 열립니다. 잘라 내고 바꿉니다 — 여기서 안 막으면 이름에 슬래시
 * 하나 들어간 날짜 때문에 파일 전체가 못 열리는 것이 됩니다.
 */
function sheetName(raw: string, fallback: string): string {
  const clean = raw.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (clean || fallback).slice(0, 31);
}

/**
 * 한 여행을 시트 여러 장으로.
 *
 * @param spends 가계부. 안 주면 가계부 시트를 안 만듭니다 — 못 받아 온 것과
 *               한 건도 없는 것을 가르지 않습니다. 둘 다 보여 줄 것이 없습니다
 */
export function tripSheets(trip: TripDetail, spends: Spend[] | null): Sheet[] {
  const out: Sheet[] = [];

  /*
    요약을 맨 앞에 둡니다.

    <p>파일을 열면 첫 시트가 먼저 뜹니다. 닷새짜리 일정에서 1일차가 먼저
    뜨면 "이게 무슨 파일인지" 를 알려면 시트를 훑어야 합니다.
  */
  const summary: (string | number | null)[][] = [
    ['여행', trip.trip.title],
    ['날짜 수', trip.days.length],
    ['장소 수', trip.days.reduce((n, d) => n + d.places.length, 0)],
  ];

  /* 잡아 둔 비용은 통화마다 따로 셉니다. 엔과 원을 더하면 아무 뜻도 없는
     숫자가 됩니다. */
  const planned = new Map<string, number>();
  for (const day of trip.days) {
    for (const place of day.places) {
      if (place.costAmount != null && place.costCurrency) {
        planned.set(
          place.costCurrency,
          (planned.get(place.costCurrency) ?? 0) + place.costAmount,
        );
      }
    }
  }
  planned.forEach((amount, currency) => {
    summary.push([`잡은 돈 (${currency})`, money(amount, currency, decimalsOf(currency))]);
  });

  if (spends) {
    const paid = new Map<string, number>();
    /* 소수점 자릿수는 지출이 들고 옵니다. 통화표에 없는 것이 섞여 있을 수
       있어서, 우리 표보다 들고 온 값을 먼저 씁니다. */
    const digits = new Map<string, number>();
    for (const spend of spends) {
      paid.set(spend.currency, (paid.get(spend.currency) ?? 0) + spend.amount);
      digits.set(spend.currency, spend.decimals);
    }
    paid.forEach((amount, currency) => {
      const at = digits.get(currency) ?? decimalsOf(currency);
      summary.push([`쓴 돈 (${currency})`, money(amount, currency, at)]);
    });
  }

  out.push({ name: '요약', rows: summary, widths: [18, 24] });

  /*
    날짜마다 시트 한 장.

    <p>한 시트에 날짜를 칸으로 반복해 넣을 수도 있지만, 그러면 하루만 보려고
    할 때마다 걸러야 합니다. 여행은 날짜 단위로 움직이는 것이라 시트도 그렇게
    나눕니다.
  */
  trip.days.forEach((day, index) => {
    const rows: (string | number | null)[][] = [PLAN_HEAD];

    /* 날짜에 딸린 것들 — 타는 편과 잘 곳. 장소가 아니라 그날 전체에 걸리는
       것이라 표 위에 한 줄씩 얹습니다. */
    const notes: string[] = [];
    if (day.flight) {
      notes.push(`항공 ${day.flight}`);
    }
    if (day.stay?.name) {
      notes.push(`숙소 ${day.stay.name}`);
    }
    if (day.budget) {
      notes.push(`예산 ${day.budget}`);
    }

    day.places.forEach((place, at) => {
      rows.push([
        at + 1,
        place.time ?? '',
        place.name,
        place.ja ?? place.en ?? '',
        place.cat ?? '',
        place.cost ?? '',
        /* 숫자는 숫자로 넣습니다. 글자로 넣으면 엑셀에서 합계가 안 됩니다 —
           엑셀로 빼 가는 까닭의 절반이 그것입니다. */
        place.costAmount ?? null,
        place.costCurrency ?? '',
        place.note ?? '',
      ]);
    });

    out.push({
      name: sheetName(day.date || day.label, `${index + 1}일차`),
      rows: notes.length > 0 ? [[notes.join('  ·  ')], [], ...rows] : rows,
      widths: PLAN_WIDTH,
    });
  });

  if (spends && spends.length > 0) {
    /* 지출이 어느 날·어느 곳 것인지는 번호로만 들어 있습니다. 이름으로
       바꿔 둡니다 — 표를 받아 본 사람에게 번호는 아무것도 아닙니다. */
    const dayName = new Map(trip.days.map((d) => [d.id, d.date || d.label]));
    const placeName = new Map(
      trip.days.flatMap((d) => d.places.map((p) => [p.id, p.name] as const)),
    );

    const rows: (string | number | null)[][] = [SPEND_HEAD];
    for (const spend of spends) {
      rows.push([
        spend.dayId ? (dayName.get(spend.dayId) ?? '') : '',
        spend.placeId ? (placeName.get(spend.placeId) ?? '') : '',
        spend.cat ?? '',
        spend.name,
        spend.amount,
        spend.currency,
        spend.payerName,
        /* 비어 있으면 전원이 나눈 것입니다. 0 으로 적으면 "아무도 안 냈다"
           로 읽히므로 빈칸으로 둡니다. */
        spend.share.length > 0 ? spend.share.length : '',
      ]);
    }
    out.push({ name: '가계부', rows, widths: SPEND_WIDTH });
  }

  return out;
}

/**
 * 파일 이름.
 *
 * <p>내려받은 폴더에 여러 여행이 쌓입니다. 제목만 쓰면 무엇이 언제 것인지
 * 모르므로 받은 날을 붙입니다.
 */
export function sheetFileName(trip: TripDetail): string {
  const title = trip.trip.title.replace(/[\\/:*?"<>|]/g, ' ').trim() || '여행';
  const today = new Date().toISOString().slice(0, 10);
  return `${title} ${today}.xlsx`;
}
