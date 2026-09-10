/*
  말로 묻고 갈 곳 받기 — 울타리 부분.

  구글 키가 없는 곳에서 돕니다. 그래서 실제 추천 결과는 여기서 못 봅니다 —
  그건 키를 넣고 사람이 눌러 봐야 아는 일입니다. 여기서 보는 것은 그 앞의
  것들입니다: 누가 부를 수 있는지, 무엇을 거절하는지, 남의 여행 날짜를
  섞어 넣을 수 있는지.
*/
const BASE = process.env.BASE || "http://127.0.0.1:8080";
const SETUP_TOKEN = process.env.SETUP_TOKEN || "devtoken";
const J = { "content-type": "application/json" };

let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { ...J };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

const TAG = Date.now().toString(36);
let r;

console.log("\n[0] 준비");
r = await call("POST", "/api/auth/setup", { body: { email: "admin@local.test", name: "관리자", password: "trip-test-1234", token: SETUP_TOKEN } });
const host = r.data.accessToken;
T("운영자 준비", !!host, r.data);

r = await call("POST", "/api/auth/register", { body: { email: `mate-${TAG}@local.test`, name: "동행자", password: "mate-test-1234" } });
const mate = r.data.accessToken;
r = await call("POST", "/api/auth/register", { body: { email: `x-${TAG}@local.test`, name: "남", password: "other-test-1234" } });
const stranger = r.data.accessToken;

r = await call("POST", "/api/trips", { token: host, body: { title: "오사카", startIso: "2026-11-02", nights: 1 } });
const tripId = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
const days = r.data.days;

r = await call("POST", "/api/trips", { token: stranger, body: { title: "남의 여행", startIso: "2026-12-01", nights: 1 } });
const otherTrip = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${otherTrip}`, { token: stranger });
const otherDay = r.data.days[0].id;

const ask = (body, token) => call("POST", `/api/trips/${tripId}/recommend`, { token, body });

console.log("\n[1] 볼 수 있는 사람만");
r = await ask({ query: "조용한 카페" }, stranger);
T("남은 못 부른다", r.status === 403 || r.status === 404, r.data);
r = await ask({ query: "조용한 카페" }, undefined);
T("로그인 없이는 못 부른다", r.status === 401, r.data);

r = await call("POST", `/api/trips/${tripId}/invites`, { token: host, body: { role: "EDITOR" } });
await call("POST", `/api/invites/${r.data.invite.token}/accept`, { token: mate });

console.log("\n[2] 무엇을 거절하는가");
r = await ask({ query: "" }, host);
T("빈 질의는 거절", r.status === 400 && /한 줄/.test(r.data.error), r.data);
r = await ask({}, host);
T("질의가 아예 없어도 거절", r.status === 400, r.data);
r = await ask({ query: "   " }, host);
T("공백만 있어도 거절", r.status === 400, r.data);
r = await ask({ query: "가".repeat(201) }, host);
T("너무 길면 거절", r.status === 400 && /줄여/.test(r.data.error), r.data);

console.log("\n[3] 날짜는 이 여행의 것이어야 한다");
r = await ask({ query: "카페", dayId: otherDay }, host);
T("남의 여행 날짜는 거절", r.status === 400 && /이 여행의 날짜/.test(r.data.error), r.data);
r = await ask({ query: "카페", dayId: "없는날짜" }, host);
T("없는 날짜는 404", r.status === 404, r.data);

console.log("\n[4] 키가 없으면 정직하게 말한다");
/*
  이 서버에는 구글 키가 없습니다. 그때 빈 목록을 조용히 내놓으면 "찾은 곳이
  없구나" 로 읽힙니다. 검색이 꺼져 있다는 것과 찾은 곳이 없다는 것은 다른
  말입니다.
*/
r = await ask({ query: "비 올 때 갈 만한 실내", dayId: days[0].id }, host);
T("검색이 꺼져 있다고 말한다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);

console.log("\n[5] 지금 자리는 본문으로 받는다");
/* 주소에 실으면 nginx 접근 기록과 브라우저 방문 기록에 남습니다.
   본문으로 받는지는 좌표를 넣어도 같은 자리까지 간다는 것으로 봅니다. */
r = await ask({ query: "카페", here: { lat: 34.6, lng: 135.5 } }, host);
T("좌표를 본문으로 받는다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);
r = await ask({ query: "카페", here: { lat: 999, lng: 999 } }, host);
T("이상한 좌표는 거절", r.status === 400 && /위도|경도/.test(r.data.error), r.data);

console.log("\n[6] 동행자도 물어볼 수 있다");
r = await ask({ query: "카페" }, mate);
T("동행자는 부를 수 있다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
