/**
 * 돈을 사람이 읽는 모양으로.
 *
 * <p>서버는 금액을 <b>그 통화의 가장 작은 단위</b>로 보냅니다 — 12.50달러는
 * 1250, 9000엔은 9000. 실수로 들고 다니면 셋이 나눠 낼 때마다 끝자리가
 * 흐려지고, 그 흐려짐이 정산에서 드러납니다.
 *
 * <p>그래서 읽을 때만 자릿수를 되돌립니다. 자릿수는 서버가 금액에 딸려
 * 보내 줍니다 — 우리가 표를 들고 있으면 언젠가 어긋납니다.
 *
 * <p>가계부와 일정 화면이 같은 값을 다르게 적지 않도록 한 곳에 둡니다.
 */
export function money(units: number, currency: string, decimals: number) {
  const value = units / 10 ** decimals;
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency}`;
}

/**
 * 자주 쓰는 통화의 자릿수.
 *
 * <p>사람이 친 것을 최소 단위로 바꿀 때 씁니다. 서버도 통화마다 정확한
 * 자릿수를 보내 주지만, 그것은 <b>이미 적힌 것</b>에 딸려 옵니다 — 아직 안
 * 적은 것에는 없어서 여기 둡니다.
 *
 * <p>모르는 통화는 0 으로 봅니다. 여기 없는 통화도 서버는 받습니다
 * (<code>Currencies.COMMON</code> 은 울타리가 아니라 손이 덜 가게 하는
 * 목록입니다).
 */
/**
 * 장소에 적어 둔 비용을 한 줄로.
 *
 * <p>칸이 둘입니다 — 셈할 수 있는 금액과, 사람이 자유롭게 적은 글자.
 * <b>숫자가 있으면 그것을, 없으면 글자를</b> 보여 줍니다. 둘 다 적혀
 * 있으면 숫자가 이깁니다 — 그쪽이 가계부와 이어지는 값이라, 두 값이
 * 다를 때 화면이 가리켜야 하는 것도 그쪽입니다.
 *
 * <p>둘 다 없으면 <code>null</code> 입니다. 부르는 쪽이 줄 자체를 안
 * 그리게 합니다.
 */
export function costLabel(place: {
  cost?: string | null;
  costAmount?: number | null;
  costCurrency?: string | null;
}) {
  if (place.costAmount != null && place.costCurrency) {
    return money(place.costAmount, place.costCurrency, decimalsOf(place.costCurrency));
  }
  return place.cost || null;
}

/**
 * 고르는 자리에 먼저 내놓을 통화.
 *
 * <p>서버의 <code>Currencies.COMMON</code> 과 같은 차례입니다. 서버가
 * 주인이고 이것은 <b>아직 아무것도 안 적은 칸</b>에 내놓을 목록입니다 —
 * 가계부는 서버가 준 목록을 쓰지만(이미 여행 하나가 정해져 있으므로),
 * 장소 판은 여행을 모르는 자리에서도 열립니다.
 */
export const COMMON = [
  'KRW',
  'JPY',
  'USD',
  'EUR',
  'TWD',
  'HKD',
  'THB',
  'SGD',
  'VND',
  'CNY',
];

export const DECIMALS: Record<string, number> = {
  KRW: 0,
  JPY: 0,
  VND: 0,
  TWD: 0,
  USD: 2,
  EUR: 2,
  HKD: 2,
  THB: 2,
  SGD: 2,
  CNY: 2,
};

/** 그 통화가 소수점 아래 몇 자리를 쓰는지. 모르면 0. */
export function decimalsOf(currency: string) {
  return DECIMALS[currency] ?? 0;
}

/**
 * 사람이 친 것을 가장 작은 단위로.
 *
 * <p>"12.50" 을 1250 으로. 자릿수가 0인 통화에서는 소수점을 무시합니다 —
 * 9000.5엔 같은 것은 없습니다.
 *
 * <p>숫자로 못 읽으면 <code>null</code> 입니다. 0 으로 넘기면 "안 적었다" 와
 * "0원이라고 적었다" 가 같아집니다.
 */
export function unitsOf(raw: string, decimals: number): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 10 ** decimals);
}
