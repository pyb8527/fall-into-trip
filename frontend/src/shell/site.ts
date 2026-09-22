/**
 * 껍데기가 띄울 곳.
 *
 * <p>웹 앱과 API 가 같은 자리에 있습니다. 그래서 따로 안 주면 API 주소를
 * 그대로 씁니다 — 두 군데에 같은 값을 적어 두면 언젠가 한쪽만 고치게
 * 됩니다.
 *
 * <p>값은 EAS 환경에서 옵니다(EXPO_PUBLIC_API_BASE). 비어 있으면 앱이
 * 어디로 가야 할지 모르므로, 조용히 빈 화면을 띄우는 대신 그렇다고
 * 말합니다.
 */
export const SITE = (
  process.env.EXPO_PUBLIC_WEB_URL ??
  process.env.EXPO_PUBLIC_API_BASE ??
  ''
).replace(/\/+$/, '');

/**
 * 껍데기 안에서 띄울 주소인지.
 *
 * <p>우리 자리면 안에서 띄우고, 남의 자리면 폰의 브라우저로 내보냅니다.
 * 구글 지도 길찾기나 예약 사이트가 앱 안에서 열리면 돌아올 길이 없습니다 —
 * 뒤로가기가 우리 화면 기록과 섞입니다.
 *
 * <p>tel:·mailto:·intent: 같은 것도 브라우저가 아니라 폰이 받아야 합니다.
 */
export function ours(url: string): boolean {
  if (!SITE) {
    return false;
  }
  /* about:blank 은 웹뷰가 처음 뜰 때 제 스스로 부릅니다. */
  return url === 'about:blank' || url.startsWith(SITE);
}
