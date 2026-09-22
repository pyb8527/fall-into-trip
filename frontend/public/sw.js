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
 *
 *   3. 그런데 <b>글꼴과 아이콘에는 해시가 없습니다.</b> /fonts/ 와 /icons/ 는
 *      이름이 고정이라 "내용이 바뀌면 이름도 바뀐다" 는 전제가 안 섭니다.
 *      캐시 우선으로 두었더니 한 번 담긴 뒤로 영영 안 바뀌었습니다 — 글꼴을
 *      바꾸고 아이콘을 다시 구워 올려도 이미 다녀간 사람에게는 옛 그림이
 *      계속 나왔습니다.
 *
 *      해시 있는 것(_expo)만 캐시 우선으로 두고, 이름이 고정인 것은 담아 둔
 *      것을 먼저 내주되 <b>뒤에서 새것을 받아 갈아 끼웁니다.</b> 지금 화면은
 *      빠르고, 다음에 열면 새것입니다.
 */

/* 판을 올리면 옛 창고가 통째로 비워집니다(activate). 위의 3번처럼 담는
   규칙을 고쳤을 때는 올려야 합니다 — 안 올리면 고친 규칙이 이미 담긴
   것에는 안 먹습니다. */
const SHELL = 'fit-shell-v2';

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

/** 이름에 해시가 붙은 것. 내용이 바뀌면 이름도 바뀌므로 오래 들고 있어도 됩니다. */
function hashed(url) {
  return url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/');
}

/**
 * 이름이 고정인 무거운 것들.
 *
 * <p>글꼴과 아이콘입니다. 오래 들고 있고 싶지만 이름이 안 바뀌므로, 담아 둔
 * 것을 내주면서 뒤에서 새것을 받아 둡니다.
 */
function steady(url) {
  return (
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/splash-icon.png'
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

  if (hashed(url)) {
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

  if (steady(url)) {
    /*
      담아 둔 것을 내주고, 뒤에서 새것을 받아 갈아 끼웁니다.

      <p>지금 화면은 기다리지 않고, 다음에 열면 새것입니다. 이름이 고정인
      것들이라 이렇게 하지 않으면 한 번 담긴 뒤로 영영 안 바뀝니다.
    */
    event.respondWith(
      caches.match(request).then((hit) => {
        const fresh = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((box) => box.put(request, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
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

/* ==========================================================================
   알림
   --------------------------------------------------------------------------
   동행자가 일정을 고치면 서버가 여기로 한 줄 보냅니다. 화면이 닫혀 있어도
   워커는 깨어나므로, 앱을 열어 두지 않아도 받습니다.
   ========================================================================== */

self.addEventListener('push', (event) => {
  /*
    본문이 비어 오는 일이 있습니다. 브라우저가 워커를 깨우려고 빈 것을 보낼
    때도 있고, 우리가 보낸 것이 어딘가에서 잘릴 때도 있습니다. 그때 아무것도
    안 띄우면 사용자에게는 그냥 안 온 것이 되는데, 안드로이드는 push 를 받고
    알림을 안 띄우면 "이 사이트가 몰래 뭔가 했다" 는 딱지를 대신 띄웁니다.
    그러느니 우리가 한 줄 띄웁니다.
  */
  let note = { title: 'FIT', body: '일정에 새 소식이 있습니다.', url: '/' };
  try {
    if (event.data) {
      note = { ...note, ...event.data.json() };
    }
  } catch {
    /* 우리가 보낸 모양이 아닙니다. 위의 기본값으로 띄웁니다. */
  }

  event.waitUntil(
    self.registration.showNotification(note.title, {
      body: note.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      /* 같은 여행의 알림은 겹쳐 씁니다. 다섯 번 고치면 다섯 줄이 쌓이는
         것이 아니라 마지막 것 하나만 남습니다. */
      tag: note.url,
      renotify: false,
      data: { url: note.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const go = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      /*
        이미 열려 있는 창이 있으면 그리로 데려갑니다. 누를 때마다 새 창이
        뜨면 금세 같은 앱이 다섯 개 열립니다.
      */
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of open) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(go);
          }
          return;
        }
      }
      await self.clients.openWindow(go);
    })(),
  );
});
