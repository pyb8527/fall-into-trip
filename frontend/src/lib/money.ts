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
