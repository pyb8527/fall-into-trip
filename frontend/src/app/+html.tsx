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
        {/*
          손가락으로 벌려 확대하는 것을 막습니다.

          <p>열어 두었었습니다 — 글자가 작게 보이는 사람에게 막으면 길이
          없어진다고 봤습니다.

          <p>그런데 이 화면들은 <b>앱으로 쓰는 것</b>입니다. 굴리다 손가락이
          스치면 전체가 커지고, 되돌리려면 다시 정확히 오므려야 합니다.
          폰에서 그 몸짓은 지도와 사진 위에서 특히 자주 걸립니다 — 그 둘이
          화면의 절반입니다.

          <p>글자를 키워야 하는 사람에게는 더 나은 길이 있습니다. 폰과
          브라우저의 글꼴 크기 설정은 이 화면에도 그대로 먹고, 레이아웃이
          따라 늘어나며, 무엇보다 <b>한 번 정해 두면 계속 그대로</b>입니다.
          벌려서 키운 것은 화면을 옮길 때마다 다시 해야 합니다.

          <p>iOS 사파리는 이 값을 무시합니다. 거기서는 지금처럼 벌려 볼 수
          있습니다 — 애플이 일부러 그렇게 두었고, 우리가 막을 길이 없습니다.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no"
        />

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
        <meta name="theme-color" content="#FFFFFF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FIT" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/*
          웹은 화면 전체가 아니라 안쪽 영역만 스크롤합니다. 이것을 넣지 않으면
          body 까지 함께 늘어나 고정해 둔 아래 단추가 밀려 올라갑니다.
        */}
        <ScrollViewStyleReset />

        {/*
          시작 화면.

          <p>앱에는 expo-splash-screen 이 있는데 웹에는 없습니다. 그래서 웹은
          꾸러미를 받는 동안 <b>흰 화면</b>이었습니다. 게다가 손글씨 글꼴을
          받는 동안 ui/hand 가 아무것도 안 그리므로(안 그러면 안드로이드에서
          글자가 통째로 안 나옵니다), 느린 망에서는 그 흰 화면이 꽤 깁니다.
          "안 열리는 것" 과 "여는 중" 이 똑같이 보였습니다.

          <p>글자가 아니라 <b>그림</b>을 씁니다. 글자로 쓰면 손글꼴을 기다려야
          하고, 기다리는 동안 다른 글꼴로 한 번 떴다가 바뀝니다 — 시작 화면이
          제일 하면 안 되는 일입니다. assets 의 시작 화면 그림을 그대로 씁니다
          (앱과 같은 그림입니다).

          <p>스타일도 여기 박아 둡니다. 따로 받아야 하는 것이 하나라도 있으면
          그만큼 늦게 뜨는데, 늦게 뜨는 시작 화면은 있으나 마나입니다.
        */}
        {/*
          글꼴과 바탕.

          <p>이것이 {@code global.css} 에 있었습니다. 그런데 <b>그 파일을
          아무도 import 하지 않아</b> 번들에 실리지도 않았습니다 — 웹은
          프리텐다드를 한 번도 쓴 적이 없고, 글자는 대체 목록 끝의 기기
          고딕으로 그려지고 있었습니다. 스타일시트가 하나도 안 붙어 있으니
          알아챌 길도 없었습니다.

          <p>여기로 옮깁니다. 이 파일은 웹에서만 도는 것이 확실하고, 머리에
          그대로 박히므로 번들러를 거치지 않습니다.
        */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
@font-face {
  font-family: 'Pretendard';
  /* public/ 은 통째로 뿌리에 복사됩니다. 번들러는 CSS 안의 url() 을 안 건드립니다. */
  src: url('/fonts/PretendardVariable.woff2') format('woff2');
  font-weight: 45 920;
  font-style: normal;
  /* 받는 동안 글자가 안 보이는 것보다, 기기 글꼴로 먼저 보여 주는 편이 낫습니다. */
  font-display: swap;
}
:root {
  --font-sans: Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo',
    'Segoe UI', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
html, body, #root { background: #FFFFFF; }
body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
/*
  키보드로 옮겨 다니는 사람에게 「지금 여기」를 보여 줍니다.

  지금 어디에 있는지 표시가 없었습니다. 마우스를 쓰면 가리키는 자리가
  보이지만, Tab 으로 옮겨 다니면 눌릴 것이 어디인지 아무 데도 안 나옵니다 —
  엉뚱한 것을 누르고 나서야 압니다.

  :focus 가 아니라 :focus-visible 입니다. :focus 는 마우스로 누른 뒤에도
  남아서, 단추를 누를 때마다 테두리가 하나씩 생기는 것으로 보입니다.

  부품마다 넣지 않고 여기 한 줄로 둡니다. 웹에서만 있는 개념이라 React
  Native 스타일에는 자리가 없고, 쉰 군데에 같은 판단을 흩어 두면 언젠가
  한 곳이 빠집니다.
*/
:focus-visible {
  outline: 2px solid #6D5BF6;
  outline-offset: 2px;
  /* 둥근 것에 네모난 테두리가 둘리면 모서리가 삐져 나옵니다. */
  border-radius: inherit;
}
#fit-splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 시안의 바이올렛. 앱 스플래시와 같은 바탕입니다. */
  background: #6D5BF6;
  transition: opacity .25s ease;
}
/* 앱 시작 화면(app.json imageWidth)과 같은 크기. 다르면 넘어갈 때 그림이 커졌다 줄어듭니다. */
#fit-splash img { width: 120px; height: auto; }
#fit-splash.gone { opacity: 0; pointer-events: none; }
/* 움직임을 줄여 달라고 해 둔 사람에게는 서서히 사라지는 것도 안 해요. */
@media (prefers-reduced-motion: reduce) { #fit-splash { transition: none; } }`,
          }}
        />
      </head>
      <body>
        <div id="fit-splash">
          {/* 화면 읽어 주는 것에는 안 읽힙니다 — 여는 중이라는 것은 아래
              글자가 말합니다. */}
          <img src="/splash-icon.png" alt="" aria-hidden="true" />
        </div>

        {children}

        {/*
          화면이 실제로 그려지면 시작 화면을 걷습니다.

          <p>정해진 시간이 지나면 걷는 것이 아니라 <b>#root 에 무언가
          들어왔을 때</b> 걷습니다. 시간으로 하면 빠른 망에서는 다 뜬 화면을
          가리고 있고, 느린 망에서는 흰 화면이 도로 드러납니다.

          <p>혹시 관찰이 안 먹는 브라우저를 위해 8초 뒤에는 그냥 걷습니다.
          시작 화면이 안 걷히는 것은 앱이 아예 안 열리는 것과 같습니다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  var splash = document.getElementById('fit-splash');
  if (!splash) return;

  /*
    앱 껍데기에게 "이제 보인다" 고 알립니다.

    껍데기의 시작 화면은 웹뷰가 다 받았다고 할 때(onLoadEnd) 내려가는데,
    그때는 이미 화면이 뜬 뒤라 이 시작 화면을 볼 틈이 없어요. 이 줄이
    그려진 지금이 넘겨받기 좋은 때입니다 — 같은 글자가 같은 자리에 있어
    이어지는 것처럼 보여요.
  */
  if (window.ReactNativeWebView) {
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ id: 'painted', ask: { kind: 'painted' } })
      );
    } catch (e) {}
  }
  var done = false;
  function clear() {
    if (done) return;
    done = true;
    splash.classList.add('gone');
    setTimeout(function () { splash.remove(); }, 300);
  }

  /*
    손글씨가 올 때까지도 기다립니다.

    화면이 붙었다고 곧바로 걷으면, 글꼴이 아직 안 온 동안 첫 글자들이
    대체 글꼴로 한 번 그려졌다가 바뀝니다. 스플래시 다음의 로딩 화면만
    다른 글씨체로 나오던 것이 이거예요.

    글꼴은 안 기다립니다.

    <p>손글씨를 쓰던 시절에는 그것이 도착할 때까지 시작 화면을 붙들고
    있었습니다. 굵기가 하나뿐인 손글씨는 시스템 고딕과 생김새가 아주 달라서,
    먼저 그렸다가 갈아 끼우면 화면이 통째로 바뀌는 것처럼 보였기 때문입니다.

    <p>프리텐다드는 시스템 고딕과 거의 같은 꼴이라 바뀌는 티가 안 납니다.
    먼저 그리고 도착하면 조용히 갈아 끼웁니다 — 망이 느린 사람이 흰 화면을
    보고 있는 것보다 낫습니다.
  */
  function whenReady() {
    clear();
  }

  var root = document.getElementById('root');
  if (root && root.childElementCount > 0) { whenReady(); return; }
  if (root && window.MutationObserver) {
    var watch = new MutationObserver(function () {
      if (root.childElementCount > 0) { watch.disconnect(); whenReady(); }
    });
    watch.observe(root, { childList: true });
  }
  setTimeout(clear, 8000);
})();`,
          }}
        />

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
