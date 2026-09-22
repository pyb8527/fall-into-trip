import { askShell } from '@/lib/shell-bridge.web';

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
 * <h3>앱 껍데기 안에서는 구글이 막습니다</h3>
 *
 * <p>로그인 창이 웹뷰 안에 박혀 있으면 주소창이 없어서, 쓰는 사람이 지금
 * 진짜 구글에 비밀번호를 넣는 것인지 확인할 수가 없습니다. 그래서 구글은
 * 웹뷰에서 온 요청을 {@code disallowed_useragent} 로 돌려보냅니다.
 *
 * <p>껍데기가 폰의 브라우저를 앱 위에 띄워(Custom Tabs) 받아 온 id_token 을
 * 건네줍니다. 받은 뒤는 브라우저에서와 똑같습니다 — 서버에 그 토큰을
 * 넘기는 것뿐입니다.
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

/**
 * 껍데기에게 로그인 창을 부탁합니다.
 *
 * @return 받은 id_token. 사람이 창을 닫았으면 null
 */
export async function shellSignIn(): Promise<string | null> {
  return (await askShell({ kind: 'signIn' })) as string | null;
}
