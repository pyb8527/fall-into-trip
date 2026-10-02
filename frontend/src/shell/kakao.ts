import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

/**
 * 카카오 로그인 (껍데기).
 *
 * <h3>웹뷰 안에서 하면 앱 밖에서 끝납니다</h3>
 *
 * <p>카카오 주소는 우리 자리가 아니라서 껍데기가 폰 브라우저로 내보냅니다
 * (shell.tsx). 로그인이 거기서 끝나면 세션도 거기 생기고, 앱으로는 아무것도
 * 안 돌아옵니다.
 *
 * <p>그래서 구글처럼 <b>앱 위에 브라우저를 띄웁니다</b>(인증 세션). 서버가
 * 끝에 {@code fit://kakao?ticket=…} 로 돌려보내면 그 창이 닫히며 주소를
 * 넘겨줍니다. 표는 웹뷰가 서버에서 세션으로 바꿉니다 — 여기서는 주소만
 * 건넵니다.
 *
 * @param url 서버의 시작 주소. 웹뷰가 만든 일회용 값이 실려 있습니다
 * @return 돌아온 주소의 값들. 창을 닫았으면 null
 */
export async function kakaoReturn(url: string): Promise<Record<string, string> | null> {
  const got = await WebBrowser.openAuthSessionAsync(url, 'fit://kakao');
  if (got.type !== 'success' || !got.url) {
    return null;
  }
  const params = Linking.parse(got.url).queryParams ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') {
      out[k] = v;
    }
  }
  return out;
}
