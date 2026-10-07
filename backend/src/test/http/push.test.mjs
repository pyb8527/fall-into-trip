/*
  알림 켜기 — 브라우저와 앱은 보내는 모양이 다르다.

  이 파일이 생긴 까닭이 있다. 「앱에서 이 기기에서 알림 받기가 안 된다」는
  말을 들었는데, 웹에서는 되고 앱에서만 안 됐다. 원인은 컨트롤러의 검증이었다 —
  SubscribeRequest 가 p256dh·auth 에 @NotBlank 를 달고 있었고, 앱은 그 둘을
  null 로 보낸다(Expo 가 대신 넘겨 주므로 열쇠가 없다). 그래서 400 에 막혀
  PushService 까지 닿지도 못했다. 정작 그 서비스는 「앱은 열쇠가 없습니다」라며
  생김새로 가려 받게 짜여 있었다 — 맞는 규칙이 도달 불가였던 셈이다.

  단위 시험으로는 안 잡힌다. 검증 애너테이션은 스프링이 읽는 것이라 서비스를
  직접 부르는 시험은 그 자리를 지나간다. 그래서 여기서 HTTP 로 두드린다.
*/
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,200) : ""));
async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const stamp = Date.now();
const reg = (who, name) => call("POST", "/api/auth/register",
  { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678", over14: true, terms: true, privacy: true } });

console.log("\n[1] 사람 둘");
let r = await reg("push", "켜는이");
const me = r.data.accessToken;
T("가입", r.status === 200, r.data);
r = await reg("push-other", "남");
const other = r.data.accessToken;

console.log("\n[2] 열쇠는 로그인 없이도 받는다");
r = await call("GET", "/api/push/key");
T("열쇠가 열림", r.status === 200 && typeof r.data.publicKey === "string" && r.data.publicKey.length > 0, r.data);

console.log("\n[3] 앱 — 토큰 한 줄, 열쇠는 없다");
/* 이 줄이 이 파일의 요점이다. 전에는 여기서 400 이 났다. */
const EXPO = "ExponentPushToken[" + "x".repeat(22) + "]";
r = await call("POST", "/api/push/subscribe", { token: me, body: { endpoint: EXPO, p256dh: null, auth: null } });
T("열쇠 없이도 켜진다", r.status === 200, r.data);

r = await call("GET", "/api/push/state", { token: me });
T("켜진 것으로 보인다", r.status === 200 && r.data.on === true, r.data);

console.log("\n[4] 브라우저 — 주소와 열쇠 둘");
const WEB = "https://fcm.googleapis.com/fcm/send/" + stamp;
r = await call("POST", "/api/push/subscribe", { token: me, body: { endpoint: WEB, p256dh: "BKxQ-test", auth: "auth-test" } });
T("브라우저 모양도 켜진다", r.status === 200, r.data);

console.log("\n[5] 브라우저인데 열쇠가 없으면 막는다");
/*
  @NotBlank 를 걷었다고 아무거나 받는 것이 아니다. 가리는 일은 PushService 가
  한다 — 생김새가 Expo 토큰이 아니면 열쇠 둘이 다 있어야 한다. 없으면 보낼
  수가 없다(우리가 직접 암호화해야 하므로).
*/
r = await call("POST", "/api/push/subscribe", { token: me, body: { endpoint: WEB + "-nokey", p256dh: null, auth: null } });
T("열쇠 없는 브라우저는 거절", r.status === 400, r.data);

console.log("\n[6] 주소가 비면 거절");
r = await call("POST", "/api/push/subscribe", { token: me, body: { endpoint: "", p256dh: "a", auth: "b" } });
T("빈 주소는 거절", r.status === 400, r.data);

console.log("\n[7] 로그인은 있어야 한다");
r = await call("POST", "/api/push/subscribe", { body: { endpoint: EXPO, p256dh: null, auth: null } });
T("로그인 없이는 못 켬", r.status === 401, r.data);

console.log("\n[8] 끄기");
r = await call("POST", "/api/push/unsubscribe", { token: me, body: { endpoint: EXPO } });
T("끈다", r.status === 200, r.data);
/* 브라우저 쪽이 아직 남아 있으므로 state 는 켜진 채다 — 기기마다 따로다. */
r = await call("GET", "/api/push/state", { token: me });
T("다른 기기가 남아 있으면 켜진 채", r.status === 200 && r.data.on === true, r.data);
r = await call("POST", "/api/push/unsubscribe", { token: me, body: { endpoint: WEB } });
r = await call("GET", "/api/push/state", { token: me });
T("다 끄면 꺼진다", r.status === 200 && r.data.on === false, r.data);

console.log("\n[9] 남의 기기는 못 끈다");
r = await call("POST", "/api/push/subscribe", { token: me, body: { endpoint: EXPO, p256dh: null, auth: null } });
r = await call("POST", "/api/push/unsubscribe", { token: other, body: { endpoint: EXPO } });
const mine = await call("GET", "/api/push/state", { token: me });
T("남이 꺼도 내 것은 그대로", mine.data.on === true, { off: r.data, mine: mine.data });

console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
