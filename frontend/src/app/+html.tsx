import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * 웹에서 감싸는 문서 껍데기.
 *
 * <p>이 파일은 <b>웹에서만</b> 쓰입니다. 앱에는 HTML 이 없습니다.
 *
 * <h3>이게 왜 필요한가</h3>
 *
 * <p>아이콘 글꼴(Feather)은 번들 안에 <code>assets/…/Feather.ttf</code> 처럼
 * <b>상대 주소</b>로 적혀 있습니다. 첫 화면(/login)에서는 그것이
 * <code>/assets/…</code> 로 풀려 잘 받아집니다. 그런데 여행 상세처럼 한 단
 * 깊은 주소(/trip/abc)를 새로고침하거나 링크로 바로 열면
 * <code>/trip/assets/…</code> 로 풀립니다.
 *
 * <p>그 주소에는 글꼴이 없습니다. 그런데 화면 라우팅을 위해 없는 주소를 전부
 * index.html 로 돌려주게 되어 있어서, 404 가 아니라 <b>HTML 이 200 으로</b>
 * 돌아옵니다. 브라우저는 그것을 글꼴이라고 믿고 읽다가 실패하고, 아이콘이
 * 전부 네모나 X 로 나옵니다. 조용히 깨지므로 원인을 찾기가 어렵습니다.
 *
 * <p><code>&lt;base href="/"&gt;</code> 하나면 모든 상대 주소가 뿌리에서
 * 풀립니다. 어느 깊이에서 열든 같은 곳에서 글꼴을 찾습니다.
 */
export default function Document({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* 폰에서 손가락으로 벌려 확대하는 것은 막지 않되, 처음 배율은 1 로. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          아이콘 글꼴이 깊은 주소에서 엉뚱한 곳으로 새는 것을 막습니다.
          이 한 줄이 없으면 /trip/… 로 바로 들어온 사람에게는 화면의 모든
          아이콘이 X 로 보입니다.
        */}
        <base href="/" />

        {/*
          홈 화면에 설치해서 쓸 수 있게.

          안드로이드는 이 셋이 모두 있어야 "앱으로 설치" 를 내줍니다 — 설명서
          (manifest), 192·512 아이콘, 그리고 요청을 실제로 받아 보는 서비스
          워커. 셋 중 하나만 빠져도 조용히 안 뜹니다.

          iOS 는 설명서를 잘 안 읽어서 apple- 로 시작하는 것들을 따로 답니다.
          그쪽은 "공유 → 홈 화면에 추가" 로만 됩니다.
        */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FAFAFA" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FIT" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/*
          웹은 화면 전체가 아니라 안쪽 영역만 스크롤합니다. 이것을 넣지 않으면
          body 까지 함께 늘어나 고정해 둔 아래 단추가 밀려 올라갑니다.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}

        {/*
          서비스 워커를 등록합니다.

          화면이 다 뜬 뒤에 합니다. 첫 그림보다 먼저 하면 그만큼 늦게 뜨는데,
          이것은 두 번째 방문부터 쓰이는 것이라 서두를 이유가 없습니다.

          안 되는 브라우저에서는 조용히 넘어갑니다. 없으면 설치가 안 될 뿐,
          화면은 그대로 돕니다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}`,
          }}
        />
      </body>
    </html>
  );
}
