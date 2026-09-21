import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

/**
 * 구글로 로그인하기 (앱).
 *
 * <h3>한동안 앱에는 없었습니다</h3>
 *
 * <p>네이티브 모듈이 붙는 일이라 OTA 로는 안 들어갔고, 그동안 <b>단추를 아예
 * 안 냈습니다.</b> 그래서 앱 사용자는 이메일 로그인만 할 수 있었습니다.
 *
 * <h3>쪽마다 클라이언트 ID 가 다릅니다</h3>
 *
 * <p>구글은 웹·iOS·안드로이드에 <b>각각 다른</b> 클라이언트 ID 를 내줍니다.
 * 그리고 받아 온 ID 토큰의 {@code aud} 에는 그것을 받아 간 쪽의 ID 가
 * 박혀 옵니다.
 *
 * <p>그래서 서버도 여럿을 받게 고쳤습니다({@code fit.social.google.audiences}).
 * 웹 것 하나만 보고 있으면 앱에서 온 토큰이 전부 거절되는데, 남의 앱 토큰을
 * 막으려던 검사가 우리 앱까지 막는 셈이었습니다.
 *
 * <h3>안 넣었으면 안 냅니다</h3>
 *
 * <p>클라이언트 ID 를 빌드에 안 넣었으면 {@code canSignInWithGoogle} 이
 * false 라 단추가 안 뜹니다. 눌러도 아무 일이 없는 단추를 두는 것보다
 * 없는 편이 낫습니다 — 예약 붙여넣기가 이미 같은 규칙을 씁니다.
 */

/* 로그인 창이 닫힌 뒤 앱으로 제대로 돌아오게 합니다. 이걸 안 부르면
   안드로이드에서 창이 남아 있는 채로 멈추는 일이 있습니다. */
WebBrowser.maybeCompleteAuthSession();

const IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const ANDROID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const canSignInWithGoogle = !!(IOS || ANDROID);

/**
 * 로그인 요청 한 벌.
 *
 * <p>훅입니다 — expo-auth-session 이 창을 띄우고 돌아오는 것을 화면 수명에
 * 맞춰 들고 있어야 해서입니다. 그래서 {@code googleCredential()} 같은
 * 그냥 함수로는 만들 수 없고, 단추 쪽(components/google-button)에서 씁니다.
 *
 * <h3>앱에서는 id_token 을 바로 못 받습니다</h3>
 *
 * <p>전에는 {@code useIdTokenAuthRequest} 를 썼습니다. 이름이 그렇게 생겨서
 * 앱에서도 id_token 이 올 줄 알았는데, 그 함수는 <b>웹에서만</b> id_token 을
 * 받아 옵니다(providers/Google.ts 의 {@code isWebAuth} 갈림길). 앱에서는
 * 설치형 앱 규칙에 따라 코드 흐름으로 떨어집니다.
 *
 * <p>그래서 {@code response.params.id_token} 이 늘 비어 있었습니다. 구글
 * 화면을 통과해도 단추는 아무 일도 안 한 것처럼 보였고, 아무 데서도 오류가
 * 나지 않아 어디가 끊겼는지 알 수가 없었습니다.
 *
 * <p>이제 받아 온 코드를 우리가 직접 토큰으로 바꿉니다. 설치형 앱이라
 * 비밀키가 없고, 대신 PKCE 의 {@code code_verifier} 가 "이 코드를 받아 간
 * 것이 나다" 를 증명합니다. {@code openid} 가 기본 스코프라 바꾼 결과에
 * id_token 이 들어 있습니다.
 *
 * @return [준비됐는지, 받아 온 id_token, 창을 띄우는 함수]
 */
export function useGoogleIdToken() {
  const [request, response, prompt] = Google.useAuthRequest({
    iosClientId: IOS || undefined,
    androidClientId: ANDROID || undefined,
    /* 웹 것도 같이 넘깁니다. 안드로이드는 웹 클라이언트로 서명된 토큰을
       내주는 흐름이 있어서, 없으면 그 길이 막힙니다. */
    webClientId: WEB || undefined,
  });
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    const code = response?.type === 'success' ? response.params?.code : null;
    if (!code || !request) {
      return;
    }
    let alive = true;
    AuthSession.exchangeCodeAsync(
      {
        clientId: request.clientId,
        code,
        /* 코드를 받을 때 댄 주소를 그대로 다시 댑니다. 구글이 둘을 맞춰 보고
           다르면 바꿔 주지 않습니다. */
        redirectUri: request.redirectUri,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
      },
      Google.discovery,
    )
      .then((token) => {
        if (alive) {
          setIdToken(token.idToken ?? null);
        }
      })
      .catch(() => {
        /* 바꾸는 데 실패하면 로그인이 안 된 것입니다. 화면은 단추가 그대로
           있는 것으로 압니다 — 다시 누르면 다시 시도합니다. */
        if (alive) {
          setIdToken(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [response, request]);

  return [!!request, idToken, prompt] as const;
}

/**
 * 웹에서만 쓰던 길. 앱에서는 위의 훅을 씁니다.
 *
 * <p>모양을 맞춰 두어야 화면이 쪽을 안 가립니다.
 */
export async function googleCredential(): Promise<string | null> {
  return null;
}
