import { api, API_BASE } from '@/api/client';
import { askShell, inShell } from '@/lib/shell-bridge.web';

/**
 * 카카오로 들어가기 (웹).
 *
 * <h3>브라우저에서는 페이지를 옮깁니다</h3>
 *
 * <p>서버 시작 주소로 가면 카카오를 거쳐 서버 콜백으로 돌아오고, 서버가
 * 그 자리에서 세션 쿠키를 심어 첫 화면으로 보냅니다. 돌아오는 것을 기다릴
 * 것이 없습니다.
 *
 * <h3>앱 껍데기 안에서는 껍데기에게 맡깁니다</h3>
 *
 * <p>웹뷰에서 페이지를 옮기면 카카오 주소가 우리 자리가 아니라서 껍데기가
 * 폰 브라우저로 내보내고, 로그인이 앱 밖에서 끝나 버립니다. 그래서 껍데기가
 * 앱 위에 브라우저를 띄우고, 끝에 받아 온 일회용 표를 여기서 세션으로
 * 바꿉니다.
 *
 * <p>그 표는 <b>여기서 만든 값(nonce)이 있어야</b> 바뀝니다. 남이 제 표를
 * 내 앱에 밀어 넣어도 이 값을 모르니 못 씁니다.
 *
 * @param exchange 표와 값을 서버에 내고 세션을 받는 일(auth-provider)
 * @return 'redirected' 페이지를 옮겼음 · 'done' 들어왔음 · 'closed' 창을 닫음
 */
export async function startKakao(
  exchange: (ticket: string, nonce: string) => Promise<void>,
): Promise<'redirected' | 'done' | 'closed'> {
  const base = API_BASE || window.location.origin;
  if (!inShell) {
    window.location.assign(`${base}/api/auth/kakao/start`);
    return 'redirected';
  }

  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  /* 동의 화면을 읽고 카카오톡을 다녀오는 데 90초는 모자랄 수 있습니다. */
  const got = (await askShell(
    { kind: 'kakaoSignIn', url: `${base}/api/auth/kakao/start?app=1&nonce=${nonce}` },
    600,
  )) as Record<string, string> | null;

  if (!got || got.cancel) {
    return 'closed';
  }
  if (got.error) {
    throw new Error(got.error);
  }
  if (!got.ticket) {
    return 'closed';
  }
  await exchange(got.ticket, nonce);
  return 'done';
}

/** 잇기는 브라우저에서만 됩니다 — 앱에서는 콜백이 설정 화면으로 못 돌아옵니다. */
export const canLinkKakao = !inShell;

/**
 * 탈퇴 직전에 카카오로 다시 확인합니다.
 *
 * <h3>왜 다시 다녀오나</h3>
 *
 * <p>카카오와의 연결을 끊으려면 그 사람의 카카오 토큰이 있어야 합니다.
 * 로그인할 때 받은 토큰은 서버가 들고 있지 않으므로(그 자리에서 누구인지만
 * 묻고 버립니다) 한 번 더 받아 옵니다. 그 토큰으로 서버가 탈퇴할 때 연결을
 * 끊습니다. 남이 잠깐 빌린 폰으로 지우지 못하게 하는 확인도 겸합니다.
 *
 * <p>길은 로그인과 같습니다 — 브라우저면 페이지째 다녀와 탈퇴 화면으로
 * 돌아오고, 앱 껍데기 안이면 앱 위에 띄운 브라우저가 다녀옵니다. 앱에서는
 * 표를 바꿀 것이 없습니다. 서버가 확인된 것을 이 계정에 적어 두었으니
 * 화면은 다시 묻기만 하면 됩니다.
 *
 * @return 'redirected' 페이지를 옮겼음 · 'done' 확인했음 · 'closed' 창을 닫음
 */
export async function confirmKakaoForWithdraw(): Promise<'redirected' | 'done' | 'closed'> {
  if (!inShell) {
    const got = await api.post<{ url: string }>('/api/auth/withdraw/kakao', {});
    window.location.assign(got.url);
    return 'redirected';
  }

  /* 앱 위에 띄운 브라우저에는 이 웹뷰의 쿠키가 없습니다. 이 값이 「앱에서
     시작했다」는 표시가 됩니다(서버의 KakaoLogin.take). */
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const { url } = await api.post<{ url: string }>('/api/auth/withdraw/kakao', { nonce });

  const got = (await askShell({ kind: 'kakaoSignIn', url }, 600)) as Record<string, string> | null;
  if (!got || got.cancel) {
    return 'closed';
  }
  if (got.error) {
    throw new Error(got.error);
  }
  return got.withdraw ? 'done' : 'closed';
}
