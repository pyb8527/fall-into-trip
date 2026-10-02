import { inShell } from '@/lib/shell-bridge.web';

/**
 * 카카오톡으로 보내기 (웹).
 *
 * <h3>키가 없으면 단추가 없습니다</h3>
 *
 * <p>JavaScript 키(EXPO_PUBLIC_KAKAO_JS_KEY)는 번들에 박힙니다. 비밀이 아니고,
 * 카카오 콘솔에 등록한 도메인에서만 돕니다. 안 넣었으면 카톡 단추를 안 내고
 * 보통 공유만 남깁니다.
 *
 * <h3>앱 껍데기 안에서는 안 씁니다</h3>
 *
 * <p>카카오 스크립트는 카카오톡을 여는 특수 주소로 넘어가는데, 웹뷰에서는
 * 그 주소가 열리는지 장담할 수 없습니다. 껍데기는 폰의 공유 판을 여는데,
 * 거기 카카오톡이 이미 있습니다.
 *
 * <h3>스크립트는 누를 때 받습니다</h3>
 *
 * <p>공유는 가끔 하는 일입니다. 첫 화면에 카카오 스크립트를 실어 두면 모든
 * 사람이 그만큼 늦게 뜹니다.
 */
const KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
const SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

export const canShareToKakao = !!KEY && !inShell;

type KakaoSdk = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: { sendDefault: (args: unknown) => void };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let loading: Promise<KakaoSdk> | null = null;

function load(): Promise<KakaoSdk> {
  if (window.Kakao) {
    return Promise.resolve(window.Kakao);
  }
  loading ??= new Promise((ok, no) => {
    const tag = document.createElement('script');
    tag.src = SDK;
    tag.async = true;
    tag.onload = () => (window.Kakao ? ok(window.Kakao) : no(new Error('카카오를 못 불렀어요')));
    tag.onerror = () => {
      loading = null;
      no(new Error('카카오를 못 불렀어요'));
    };
    document.head.appendChild(tag);
  });
  return loading;
}

/**
 * 카카오톡으로 링크 하나를 보냅니다.
 *
 * <p>글 카드(text)로 보냅니다. 그림 카드(feed)는 그림 주소가 있어야 하는데,
 * 일정에는 대표 그림이 없습니다.
 */
export async function shareToKakao(url: string, text: string): Promise<void> {
  const kakao = await load();
  if (!kakao.isInitialized()) {
    kakao.init(KEY);
  }
  kakao.Share.sendDefault({
    objectType: 'text',
    text,
    link: { webUrl: url, mobileWebUrl: url },
    buttonTitle: '일정 보기',
  });
}
