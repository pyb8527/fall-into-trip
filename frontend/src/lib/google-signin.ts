import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

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
 */
export function useGoogleIdToken() {
  return Google.useIdTokenAuthRequest({
    iosClientId: IOS || undefined,
    androidClientId: ANDROID || undefined,
    /* 웹 것도 같이 넘깁니다. 안드로이드는 웹 클라이언트로 서명된 토큰을
       내주는 흐름이 있어서, 없으면 그 길이 막힙니다. */
    webClientId: WEB || undefined,
  });
}

/**
 * 웹에서만 쓰던 길. 앱에서는 위의 훅을 씁니다.
 *
 * <p>모양을 맞춰 두어야 화면이 쪽을 안 가립니다.
 */
export async function googleCredential(): Promise<string | null> {
  return null;
}
