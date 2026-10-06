import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

/**
 * 구글 로그인 (껍데기).
 *
 * <h3>브라우저를 띄우던 것을 폰 계정으로 바꿨습니다</h3>
 *
 * <p>{@code expo-auth-session} 으로 폰의 브라우저를 앱 위에 띄웠습니다.
 * 웹뷰 안에서는 구글이 막으므로({@code disallowed_useragent}) 그것이 유일한
 * 길이었는데, 쓰는 사람에게는 <b>앱이 아니라 웹</b>으로 보였습니다 — 창이
 * 뜨고 주소가 보이고 로그인한 뒤 돌아오는 그 세 박자가 전부입니다.
 *
 * <p>폰에는 이미 로그인해 둔 구글 계정이 있습니다. 네이티브 쪽은 그것을
 * 그대로 씁니다 — 계정을 고르는 판 하나가 뜨고 끝납니다. 창이 안 뜨므로
 * 거기서 돌아오지 못해 끊기는 자리도 없어집니다.
 *
 * <p>{@code docs/plan-social-login.md} §9 가 「앱은 이번에 안 합니다 —
 * 네이티브 로그인은 EAS 재빌드가 필요하고, 그건 앱 작업 때 묶기로 한
 * 것입니다」로 미뤄 두었던 그 자리입니다.
 *
 * <h3>부르는 자리는 그대로입니다</h3>
 *
 * <p>{@link googleIdToken} 과 {@link canSignIn} 의 생김새를 안 바꿨습니다.
 * 웹은 {@code askShell({ kind: 'signIn' })} 로 부탁하고 id_token 한 줄을
 * 받습니다 — 그 아래가 브라우저인지 폰 계정인지 웹은 몰라도 됩니다. 그래서
 * 이 바꿈은 <b>웹 쪽 코드를 한 줄도 건드리지 않습니다.</b>
 *
 * <h3>PKCE 로 코드를 바꾸던 일이 없어졌습니다</h3>
 *
 * <p>브라우저 길은 코드를 받아 와 우리가 토큰으로 바꿨습니다(설치형 앱에는
 * 비밀키가 없어서 id_token 을 곧바로 못 받습니다). 네이티브 쪽은 구글의
 * SDK 가 그 일을 폰 안에서 하고 id_token 을 바로 줍니다.
 *
 * <h3>서버가 받아 줄 aud 를 늘려야 합니다</h3>
 *
 * <p>구글은 쪽마다 다른 클라이언트 ID 를 내주고, id_token 의 {@code aud} 에는
 * 받아 간 쪽의 ID 가 박혀 옵니다. 서버는 그것을
 * {@code fit.social.google.audiences} (환경 변수 {@code GOOGLE_AUDIENCES})
 * 로 이미 여럿 받게 되어 있습니다({@code SocialTokens}) — <b>거기에 iOS·
 * 안드로이드 클라이언트 ID 를 넣어야</b> 앱에서 온 토큰이 통과합니다. 안
 * 넣으면 로그인 판은 뜨고 서버가 400 으로 거절합니다.
 */

/*
  클라이언트 ID.

  <p>웹 것은 {@code webClientId} 로 넘깁니다 — 이것이 있으면 안드로이드가
  id_token 을 내줍니다(없으면 토큰이 없는 로그인이 됩니다).

  <p>{@code docs/plan-social-login.md} §10.1 은 웹에서 클라이언트 ID 를
  빌드에 안 박고 서버가 내려보내게 했습니다. 껍데기는 그렇게 못 합니다 —
  로그인은 웹이 뜨기 전에도 눌릴 수 있고, 무엇보다 이 값들은 <b>빌드할 때
  네이티브 쪽에 박히는</b> 것이라(iOS 의 돌아올 주소) 어차피 빌드가 알아야
  합니다. 그래서 여기만 환경 변수입니다.
*/
const IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
/*
  웹 것은 EAS 에 {@code EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID} 로 들어 있습니다.
  여기서 {@code EXPO_PUBLIC_GOOGLE_CLIENT_ID} 만 읽고 있어서 빌드에 웹 것이
  빈 값으로 박혔고, 안드로이드는 계정을 고르고도 id_token 없이 돌아와
  「창을 닫은 것」으로 읽혀 아무 일도 안 일어났습니다. 옛 이름도 받아 둡니다.
*/
const WEB =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/**
 * 이 빌드가 구글 로그인을 할 수 있는지.
 *
 * <p>쪽마다 보는 값이 다릅니다. iOS 는 제 클라이언트 ID 가 있어야 하고,
 * 안드로이드는 앱에 적을 값이 없는 대신(구글이 패키지 이름과 서명 지문으로
 * 알아봅니다) <b>웹 것</b>이 있어야 id_token 이 나옵니다.
 */
export const canSignIn = Platform.OS === 'ios' ? !!IOS : !!WEB;

/*
  설정은 한 번만 합니다.

  <p>{@code configure} 는 값만 적어 두는 일이라 싸고, 로그인을 누를 때마다
  부르면 그 값이 어디서 왔는지가 흩어집니다.

  <p>{@code webClientId} 를 iOS 에도 넘깁니다. 그러면 id_token 의
  {@code aud} 가 웹 것으로 와서 서버가 이미 보던 값과 같아집니다 — 다만
  SDK 판에 따라 iOS 것이 박혀 오기도 해서, 서버 쪽 {@code GOOGLE_AUDIENCES}
  에는 <b>셋 다</b> 넣어 두는 것이 맞습니다.
*/
GoogleSignin.configure({
  ...(IOS ? { iosClientId: IOS } : {}),
  ...(WEB ? { webClientId: WEB } : {}),
  /* 이름과 메일 주소입니다 — 서버가 계정을 만들 때 씁니다. */
  scopes: ['profile', 'email'],
  /*
    서버가 사람 대신 구글 API 를 부를 일이 없습니다. 켜면 코드가 하나 더
    따라오고 그것을 받아 둘 자리가 서버에 필요해집니다.
  */
  offlineAccess: false,
});

/**
 * 폰 계정으로 로그인하고 id_token 을 받아 옵니다.
 *
 * @return 받은 id_token. 쓰는 사람이 계정 고르기를 닫았으면 null
 */
export async function googleIdToken(): Promise<string | null> {
  if (!canSignIn) {
    throw new Error('이 빌드에 구글 클라이언트 ID 가 없어요');
  }

  /*
    안드로이드는 구글 서비스가 있어야 합니다.

    <p>없는 기기가 있습니다(중국 판, 일부 태블릿). 그때 그냥 로그인을
    부르면 알아보기 어려운 오류가 나므로 먼저 봅니다. 받을 수 있는 판을
    권하는 창은 구글이 띄워 줍니다.
  */
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  /*
    먼저 끊고 시작합니다.

    <p>한 번 로그인하면 SDK 가 그 계정을 들고 있어, 다음부터는 고르는 판이
    뜨지 않고 <b>같은 계정으로 바로</b> 들어갑니다. 폰에 계정이 둘인 사람은
    다른 쪽으로 들어갈 길이 없어집니다.
  */
  await GoogleSignin.signOut().catch(() => {
    /* 들고 있는 것이 없었습니다. 그대로 갑니다. */
  });

  try {
    const got = await GoogleSignin.signIn();
    if (!isSuccessResponse(got)) {
      /* 고르는 판을 닫았습니다. 고장이 아니므로 아무 말도 안 합니다. */
      return null;
    }
    /*
      계정은 골랐는데 토큰이 없습니다. 닫은 것과 다르므로 null 로 돌려주지
      않습니다 — 그러면 웹이 아무 말도 안 하고, 누른 사람에게는 단추가
      죽은 것으로 보입니다. 웹 클라이언트 ID 가 빌드에 없을 때 이렇게 됩니다.
    */
    if (!got.data.idToken) {
      throw new Error('구글이 로그인 정보를 주지 않았어요');
    }
    return got.data.idToken;
  } catch (e) {
    /*
      판이 이미 떠 있는데 또 눌렀습니다. 두 번째 부름은 거절되는데, 그것은
      고장이 아니라 첫 번째가 아직 진행 중이라는 뜻입니다.
    */
    if (codeOf(e) === statusCodes.IN_PROGRESS) {
      return null;
    }
    throw e;
  }
}

/**
 * 구글 SDK 가 오류에 붙여 보내는 까닭.
 *
 * <p>꾸러미가 {@code isErrorWithCode} 를 주지만 여기서는 안 씁니다 —
 * 그것은 타입을 좁히는 도우미여서, 이 파일이 <b>꾸러미를 아직 안 깐
 * 상태에서도 읽히게</b> 두려면 자리 하나를 직접 들여다보는 쪽이 낫습니다.
 */
function codeOf(e: unknown): string | null {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}
