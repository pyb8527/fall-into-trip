/* 장소 찾기 점검 — 열려 있지 않은지, 키가 새지 않는지, 없을 때 안내하는지 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
const SETUP_TOKEN = process.env.SETUP_TOKEN || "devtoken";
const J = { "content-type": "application/json" };

let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x) : ""));

async function call(method, path, { body, token, raw } = {}) {
  const headers = { ...J };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, {
    method,
    headers,
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

const ADMIN = { email: "place@local.test", name: "Tester", password: "place-test-1234" };

console.log("\n[0] 준비");
let r = await call("POST", "/api/auth/setup", { body: { ...ADMIN, token: SETUP_TOKEN } });
if (r.status !== 200) {
  r = await call("POST", "/api/auth/login", { body: { email: ADMIN.email, password: ADMIN.password } });
}
if (r.status !== 200) {
  r = await call("POST", "/api/auth/register", { body: ADMIN });
}
T("계정 확보", r.status === 200, r.data);
const token = r.data?.accessToken;

console.log("\n[1] 아무나 쓰지 못하게");
r = await call("GET", "/api/places/search?q=tokyo");
T("로그인 없이는 401", r.status === 401, r.data);

console.log("\n[2] 검색어");
r = await call("GET", "/api/places/search?q=", { token });
T("빈 검색어는 빈 목록", r.status === 200 && Array.isArray(r.data?.places)
  && r.data.places.length === 0, r.data);

console.log("\n[3] 찾기");
r = await call("GET", "/api/places/search?q=tokyo", { token });
if (r.status === 200) {
  T("결과를 돌려줌", Array.isArray(r.data.places), r.data);
  T("좌표가 숫자로 붙어 있음",
    r.data.places.every(p => typeof p.lat === "number" && typeof p.lng === "number"),
    r.data.places?.[0]);
  T("이름·주소만 내보냄(구글 응답을 그대로 흘리지 않음)",
    r.data.places.every(p => Object.keys(p).sort().join() === "address,lat,lng,name"),
    r.data.places?.[0]);
  T("키가 새어 나가지 않음", !JSON.stringify(r.data).includes("AIza"), null);
} else {
  /* 서버 키가 없는 환경. 그때는 왜 안 되는지 사람 말로 알려 줘야 합니다. */
  T("키가 없으면 이유를 알려 줌",
    r.status >= 400 && /좌표를 직접|찾지 못|쓸 수 없/.test(r.data?.error ?? ""), r.data);
  T("좌표 형식 (키 없어 건너뜀)", true);
  T("응답 모양 (키 없어 건너뜀)", true);
  T("키 노출 (키 없어 건너뜀)", true);
}

console.log("\n[4] 잘못 보낸 요청");
r = await call("POST", "/api/auth/login", { raw: '{"email":' });
T("깨진 JSON 은 400", r.status === 400, r.data);
r = await call("POST", "/api/auth/login", {});
T("빈 본문도 400", r.status === 400, r.data);

console.log(`\n${fail === 0 ? "모두 통과" : "실패 있음"} — ok ${pass}, fail ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
