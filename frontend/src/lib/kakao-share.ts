/**
 * 카카오톡으로 보내기 (앱 원래 화면).
 *
 * <p>앱은 웹을 띄우는 껍데기라 이 길을 안 탑니다. 카카오 네이티브 공유는
 * 다시 굽기(EAS)가 필요해 2차로 미뤘습니다 — 그동안은 폰 공유 판에서
 * 카카오톡을 고르면 됩니다.
 */
export const canShareToKakao = false;

export async function shareToKakao(_url: string, _text: string): Promise<void> {}
