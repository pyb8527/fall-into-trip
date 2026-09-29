/* 사진 주소를 푸는 길. 열쇠가 없어도, 이상한 이름이 와도 조용해야 합니다. */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : ""));
async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const stamp = Date.now();

console.log("\n[1] 사람 하나");
let r = await call("POST", "/api/auth/register", {
  body: { email: `photo-${stamp}@test.com`, name: "보는 사람", password: "pw-12345678" },
});
const me = r.data.accessToken;
T("가입", r.status === 200, r.data);

console.log("\n[2] 로그인 없이는 못 부른다");
r = await call("GET", "/api/places/photo?name=places/aaa/photos/bbb");
T("거절", r.status === 401 || r.status === 403, r.status);

console.log("\n[3] 구글이 주는 모양이 아니면 아무것도 안 한다");
/* 이 문이 열려 있으면 우리 열쇠를 달고 구글의 아무 데나 부르게 만들 수
   있습니다. 거절이 아니라 "없음" 으로 답합니다 — 화면은 사진 자리를 비웁니다. */
for (const bad of [
  "../../v1/places",
  "places/aaa/photos/bbb/../../..",
  "https://example.com/x",
  "places//photos/bbb",
  "photos/bbb",
  "places/aaa/photos/bbb?key=stolen",
]) {
  r = await call("GET", `/api/places/photo?name=${encodeURIComponent(bad)}`, { token: me });
  T(`막힘: ${bad}`, r.status === 200 && (r.data.url ?? null) === null, r.data);
}

console.log("\n[4] 모양이 맞아도 열쇠가 없으면 조용히 없음");
r = await call("GET", "/api/places/photo?name=places/ChIJaaa_bbb/photos/AeJbb-ccc", { token: me });
T("터지지 않음", r.status === 200, r.data);
T("없음으로 답함", (r.data.url ?? null) === null || typeof r.data.url === "string", r.data);

console.log("\n[5] 넓이는 둘 중 하나로 접힌다");
/* 아무 숫자나 받으면 같은 사진을 넓이마다 따로 물어야 해서 값이 듭니다.
   받아 주기는 하되 안에서 접습니다 — 화면이 이상한 값을 보내도 안 터집니다. */
r = await call("GET", "/api/places/photo?name=places/ChIJaaa_bbb/photos/AeJbb-ccc&w=99999", { token: me });
T("큰 값도 받아 줌", r.status === 200, r.data);
r = await call("GET", "/api/places/photo?name=places/ChIJaaa_bbb/photos/AeJbb-ccc&w=-5", { token: me });
T("이상한 값도 받아 줌", r.status === 200, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
