import type { PropsWithChildren } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { inShell } from '@/lib/shell-bridge.web';

/**
 * 껍데기가 아는 안전영역을 웹에 알려 줍니다.
 *
 * <h3>웹은 노치를 모릅니다</h3>
 *
 * <p>react-native-safe-area-context 는 웹에서 CSS 의
 * {@code env(safe-area-inset-*)} 를 읽습니다. 그런데 그 값은 문서에
 * {@code viewport-fit=cover} 가 있을 때만 채워지고, 브라우저에서는 주소창이
 * 그 자리를 대신 쓰기 때문에 우리는 그것을 안 켜 두었습니다. 그래서 웹은
 * 위아래 여백을 <b>전부 0</b>으로 압니다.
 *
 * <p>브라우저에서는 그것이 맞습니다. 그런데 앱 껍데기 안에서는 위에
 * 상태표시줄이, 아래에 제스처 바가 있습니다. 0 으로 알면 위는 글자가
 * 시계에 가리고 아래는 하단 띠가 제스처 바에 깔립니다.
 *
 * <h3>한 군데서만 적용합니다</h3>
 *
 * <p>처음에는 껍데기가 웹뷰를 그만큼 내려 놓았습니다. 그러면 상태표시줄
 * 자리가 <b>빈 띠</b>로 남습니다 — 웹의 머리글이 제 여백 안에서 흡수할 수
 * 있는데 그 기회를 뺏은 셈입니다.
 *
 * <p>이제 껍데기는 웹뷰를 화면 끝까지 펴고 <b>숫자만</b> 건넵니다. 그
 * 숫자를 여기서 문맥에 꽂으면, 이미 {@code useSafeAreaInsets()} 를 쓰고 있는
 * 화면들이 전부 제자리를 찾습니다 — 머리글도, 하단 띠도, 바텀시트도.
 * 고칠 자리가 한 군데입니다.
 */

const ZERO = { top: 0, bottom: 0, left: 0, right: 0 };

/** 껍데기가 첫 줄이 그려지기 전에 넣어 준 값. 브라우저면 전부 0 입니다. */
function fromShell() {
  if (!inShell || typeof window === 'undefined') {
    return null;
  }
  const got = (window.FIT_SHELL as { insets?: typeof ZERO } | undefined)?.insets;
  if (!got) {
    return null;
  }
  /* 값이 이상하게 와도 화면이 깨지지는 않게 합니다. */
  return {
    top: Number.isFinite(got.top) ? got.top : 0,
    bottom: Number.isFinite(got.bottom) ? got.bottom : 0,
    left: Number.isFinite(got.left) ? got.left : 0,
    right: Number.isFinite(got.right) ? got.right : 0,
  };
}

export function ShellInsets({ children }: PropsWithChildren) {
  const insets = fromShell();
  if (!insets) {
    /* 브라우저입니다. 지금까지처럼 라이브러리가 재는 값을 씁니다. */
    return <>{children}</>;
  }
  return (
    <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>
  );
}
