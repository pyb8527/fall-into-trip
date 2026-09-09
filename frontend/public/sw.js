/*
 * 설치해서 쓰는 데 필요한 최소한.
 * ---------------------------------------------------------------------------
 * 안드로이드가 "앱으로 설치" 를 내주려면 서비스 워커가 하나 있어야 하고, 그
 * 워커가 요청을 실제로 받아 봐야 합니다.
 *
 * 여기서 조심할 것이 둘입니다.
 *
 *   1. API 응답은 절대 담아 두지 않습니다. 로그인한 사람마다 다른 것이 오는데
 *      한 번 담아 두면 다음 사람에게 남의 것이 보일 수 있습니다.
 *   2. 화면(HTML)은 담아 둔 것을 먼저 쓰지 않습니다. 새로 올린 뒤에도 옛
 *      화면이 계속 뜨면 고친 것이 반영되지 않은 줄 압니다.
 *
 * 그래서 담아 두는 것은 이름에 해시가 붙은 것(_expo)과 글꼴·아이콘뿐입니다.
 * 그것들은 내용이 바뀌면 이름도 바뀌므로 오래 들고 있어도 틀릴 일이 없습니다.
 */

const SHELL = 'fit-shell-v1';

/** 이름이 바뀌지 않는 것들. 새로 받아 온 것으로 늘 갈아 끼웁니다. */
const ALWAYS_FRESH = ['/manifest.json', '/sw.js'];

self.addEventListener('install', () => {
  /* 미리 받아 두지 않습니다. 무엇을 받아 둘지는 배포할 때마다 달라지는데,
     목록을 손으로 적어 두면 언젠가 어긋나고 그때부터 조용히 옛것이 뜹니다. */
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      /* 옛 판의 창고를 치웁니다. 이름을 바꿔 올린 뒤에도 남아 있으면 자리만
         차지합니다. */
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== SHELL).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/** 오래 들고 있어도 되는 것인지. 이름에 해시가 붙어 내용이 바뀌면 이름도 바뀝니다. */
function keepable(url) {
  return (
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  /* 읽기만 가로챕니다. 보내는 것을 건드리면 두 번 보내지는 일이 생깁니다. */
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  /* 남의 서버(구글 지도 같은)는 그대로 둡니다. */
  if (url.origin !== self.location.origin) {
    return;
  }

  /* API 는 절대 담아 두지 않습니다. 사람마다 다른 것이 오고, 지금 것이어야
     합니다. */
  if (url.pathname.startsWith('/api/') || ALWAYS_FRESH.includes(url.pathname)) {
    return;
  }

  if (keepable(url)) {
    /* 담아 둔 것이 있으면 그것부터. 없으면 받아 와서 담아 둡니다. */
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((box) => box.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  /*
    화면은 새것부터 받아 봅니다.

    받아 오지 못했을 때만(비행기 안, 지하) 마지막으로 담아 둔 화면을 꺼냅니다.
    그러지 않으면 인터넷이 끊긴 순간 아무것도 안 뜨고 브라우저 오류만 나옵니다.
  */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((box) => box.put('/index.html', copy));
          }
          return res;
        })
        .catch(async () => {
          const saved = await caches.match('/index.html');
          return (
            saved ||
            new Response('<h1>연결이 끊겼습니다</h1>', {
              status: 503,
              headers: { 'content-type': 'text/html; charset=utf-8' },
            })
          );
        }),
    );
  }
});
