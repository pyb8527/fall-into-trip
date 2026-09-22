import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

/**
 * 구글 로그인 (껍데기).
 *
 * <h3>왜 웹뷰 안에서 못 하나</h3>
 *
 * <p>구글이 막습니다. 로그인 창이 앱 안에 박혀 있으면 주소창이 없어서, 쓰는
 * 사람이 지금 진짜 구글에 비밀번호를 넣는 것인지 확인할 수가 없습니다.
 * 앱을 만든 쪽이 그 창을 들여다볼 수도 있고요. 그래서 구글은 웹뷰에서 온
 * 요청을 {@code disallowed_useragent} 로 돌려보냅니다.
 *
 * <p>대신 폰의 브라우저를 앱 위에 띄웁니다. 주소창이 보이고, 브라우저에
 * 이미 로그인해 둔 계정을 그대로 씁니다.
 *
 * <h3>코드를 받아서 우리가 바꿉니다</h3>
 *
 * <p>설치형 앱에는 비밀키가 없어서 id_token 을 곧바로 못 받습니다. 코드를
 * 받아 와 토큰으로 바꾸는데, "이 코드를 받아 간 것이 나다" 는 증명은
 * PKCE 의 {@code code_verifier} 가 합니다.
 *
 * <p>훅(useAuthRequest)이 아니라 그냥 함수로 씁니다 — 껍데기에는 이 일을
 * 걸어 둘 화면이 없고, 웹이 부탁할 때 한 번 돌면 되기 때문입니다.
 */

/* 창이 닫힌 뒤 앱으로 제대로 돌아오게 합니다. */
WebBrowser.maybeCompleteAuthSession();

const IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const ANDROID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

/**
 * 돌아올 주소.
 *
 * <p>패키지 이름이 그대로 scheme 입니다. 구글의 안드로이드·iOS 클라이언트는
 * 이 모양을 받아 줍니다. app.json 의 scheme 에도 같은 것이 적혀 있어야
 * 폰이 이 주소를 우리 앱에게 줍니다 — 매니페스트에 박히는 값이라 그 한
 * 줄만은 빌드해야 들어갑니다.
 */
const BACK = AuthSession.makeRedirectUri({ native: 'net.weeniebeenie.fit:/oauthredirect' });

/** 이 빌드가 구글 로그인을 할 수 있는지. */
export const canSignIn = !!(IOS || ANDROID);

/**
 * 로그인 창을 띄우고 id_token 을 받아 옵니다.
 *
 * @return 받은 id_token. 쓰는 사람이 창을 닫았으면 null
 */
export async function googleIdToken(): Promise<string | null> {
  const clientId = (ANDROID || IOS)!;
  if (!clientId) {
    throw new Error('이 빌드에 구글 클라이언트 ID 가 없습니다');
  }

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri: BACK,
    responseType: AuthSession.ResponseType.Code,
    /* openid 가 있어야 바꾼 결과에 id_token 이 들어옵니다. 나머지 둘은
       이름과 메일 주소입니다 — 서버가 계정을 만들 때 씁니다. */
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
  });

  const result = await request.promptAsync(Google.discovery);
  if (result.type !== 'success' || !result.params.code) {
    /* 닫았거나 거절했습니다. 고장이 아니므로 아무 말도 안 합니다. */
    return null;
  }

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      /* 코드를 받을 때 댄 주소를 그대로 다시 댑니다. 구글이 둘을 맞춰 보고
         다르면 바꿔 주지 않습니다. */
      redirectUri: BACK,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    Google.discovery,
  );

  return token.idToken ?? null;
}
