/**
 * 구글로 로그인하기 (웹).
 *
 * <p>웹에서는 구글이 스크립트로 단추를 직접 그리고 토큰까지 건네줍니다
 * (components/google-button.web). 그래서 여기서 할 일이 없습니다.
 *
 * <p><b>켜고 끄는 것은 서버가 정합니다.</b> 클라이언트 ID 를 서버가
 * 내려 주면 단추가 그려지고, 안 내려 주면 안 그려집니다 — 그 판단은
 * auth-panel 이 이미 합니다. 여기서는 "이 쪽에 길이 있다" 까지만
 * 말합니다.
 *
 * <p>앱 쪽(google-signin.ts)은 반대입니다. 빌드에 제 클라이언트 ID 가
 * 박혀 있어야 하고, 없으면 여기가 false 를 냅니다.
 */
export const canSignInWithGoogle = true;

/**
 * 앱에서만 씁니다. 웹은 구글 스크립트가 대신합니다.
 *
 * <p>모양만 맞춰 둡니다 — [준비됐는지, 받아 온 id_token, 창을 띄우는 함수].
 * 웹 단추(google-button.web)는 이것을 부르지 않습니다.
 */
export function useGoogleIdToken() {
  return [false, null, async () => {}] as const;
}
