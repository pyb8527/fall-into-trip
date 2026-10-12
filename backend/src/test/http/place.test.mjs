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

const ADMIN = { email: "place@local.test", name: "Tester", password: "place-test-1234", over14: true, terms: true, privacy: true };

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
    r.data.places.every(p => Object.keys(p).sort().join() === "address,lat,lng,name,placeId"),
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

console.log("\n[3-1] 번호 하나로 상세 — 옮긴 자리를 따라갈 때 이 길을 씁니다");
/* 「새 자리 보기」 를 누르면 판이 옮긴 자리 번호로 이 길을 부릅니다
   (plan-moved-place.md). 그 번호는 우리 DB 에 없는 곳이라, 모르는 번호가
   와도 500 이 아니라 빈 답이어야 판이 「불러오지 못했어요」 를 말할 수
   있습니다. 확인용 서버에는 키가 없어 늘 빈 답입니다. */
r = await call("GET", "/api/places/ChIJ-no-such-place-0000/info");
T("로그인 없이는 401", r.status === 401, r.data);
r = await call("GET", "/api/places/ChIJ-no-such-place-0000/info", { token });
if (r.status === 200 && r.data?.info) {
  /* 키가 있는 서버라면 구글이 모르는 번호에 답을 줄 리 없습니다. */
  T("모르는 번호에 정보가 오지 않음", false, r.data);
} else {
  T("모르는 번호 · 키 없음은 200 에 빈 정보(500 아님)", r.status === 200 && r.data?.info == null, r.data);
}

console.log("\n[4] 잘못 보낸 요청");
r = await call("POST", "/api/auth/login", { raw: '{"email":' });
T("깨진 JSON 은 400", r.status === 400, r.data);
r = await call("POST", "/api/auth/login", {});
T("빈 본문도 400", r.status === 400, r.data);

console.log(`\n${fail === 0 ? "모두 통과" : "실패 있음"} — ok ${pass}, fail ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
