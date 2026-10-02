/* 카카오 로그인 — 카카오에 닿기 전까지의 문: 시작, state 두 겹, 취소, 잇기 시작.
   진짜 코드 교환은 카카오 키가 있어야 해서 여기서는 「실패하면 까닭을 싣고 되돌린다」까지만 본다 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,240) : ""));
const go = (path, headers = {}) => fetch(BASE + path, { redirect: "manual", headers });
const cookieOf = (r, name) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0])
  .find((c) => c.startsWith(name + "="))?.split("=")[1];

console.log("\n[1] 켜져 있다고 알림");
let r = await fetch(BASE + "/api/auth/state");
let j = await r.json();
T("state 에 kakao", j.kakao === true, j);

console.log("\n[2] 시작");
r = await go("/api/auth/kakao/start");
const loc = r.headers.get("location") ?? "";
const state = new URL(loc).searchParams.get("state");
T("카카오로 보냄", r.status === 302 && loc.startsWith("https://kauth.kakao.com/oauth/authorize"), loc);
T("콜백 주소가 실림", loc.includes(encodeURIComponent("/api/auth/kakao/callback")), loc);
const cookie = cookieOf(r, "fit_kakao_state");
T("같은 state 를 쿠키에도", cookie === state, [cookie, state]);

console.log("\n[3] state 두 겹");
r = await go(`/api/auth/kakao/callback?code=x&state=${state}`);
T("쿠키 없으면 되돌림", r.status === 302 && r.headers.get("location").startsWith("/login?social_error="), r.headers.get("location"));
r = await go(`/api/auth/kakao/callback?code=x&state=${state}`, { cookie: `fit_kakao_state=${state}` });
T("한 번 쓴 state 는 다시 못 씀(앞에서 꺼냄)", r.headers.get("location").startsWith("/login?social_error="), r.headers.get("location"));

console.log("\n[4] 동의 화면에서 취소");
r = await go("/api/auth/kakao/start");
let s2 = new URL(r.headers.get("location")).searchParams.get("state");
r = await go(`/api/auth/kakao/callback?error=access_denied&state=${s2}`, { cookie: `fit_kakao_state=${s2}` });
T("말 없이 로그인으로", r.status === 302 && r.headers.get("location") === "/login", r.headers.get("location"));

console.log("\n[5] 코드가 틀리면 까닭을 싣고 되돌림");
r = await go("/api/auth/kakao/start");
let s3 = new URL(r.headers.get("location")).searchParams.get("state");
r = await go(`/api/auth/kakao/callback?code=bogus&state=${s3}`, { cookie: `fit_kakao_state=${s3}` });
const back = r.headers.get("location") ?? "";
T("로그인으로 + 까닭", back.startsWith("/login?social_error="), back);
T("세션 쿠키는 안 심음", !cookieOf(r, "fit_refresh"), r.headers.getSetCookie?.());

console.log("\n[6] 잇기 시작은 로그인한 사람만");
r = await fetch(BASE + "/api/auth/link/kakao", { method: "POST" });
T("로그인 없이 401", r.status === 401, r.status);
const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: `k-${Date.now()}@test.com`, name: "카", password: "pw-12345678" }) });
const token = (await reg.json()).accessToken;
r = await fetch(BASE + "/api/auth/link/kakao", { method: "POST", headers: { authorization: "Bearer " + token } });
j = await r.json();
T("갈 주소를 줌", r.status === 200 && j.url.startsWith("https://kauth.kakao.com/"), j);
const s4 = new URL(j.url).searchParams.get("state");
r = await go(`/api/auth/kakao/callback?error=access_denied&state=${s4}`, { cookie: `fit_kakao_state=${s4}` });
T("잇기를 취소하면 설정으로", r.headers.get("location") === "/settings", r.headers.get("location"));

console.log("\n[7] 자리 주소는 가입에 못 씀");
r = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "kakao-1@users.invalid", name: "x", password: "pw-12345678" }) });
T("400", r.status === 400, r.status);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
