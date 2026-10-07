/**
 * 카카오로 들어가기 (앱 원래 화면).
 *
 * <p>앱은 이제 웹을 띄우는 껍데기라 이 길을 안 탑니다 — 껍데기 안의 웹이
 * kakao-signin.web 을 씁니다. 모양만 맞춰 둡니다.
 */
export async function startKakao(
  _exchange: (ticket: string, nonce: string) => Promise<void>,
): Promise<'redirected' | 'done' | 'closed'> {
  return 'closed';
}

export const canLinkKakao = false;

/** 탈퇴 직전의 카카오 다시 확인. 원래 화면에서는 이 길을 안 탑니다. */
export async function confirmKakaoForWithdraw(): Promise<'redirected' | 'done' | 'closed'> {
  return 'closed';
}
