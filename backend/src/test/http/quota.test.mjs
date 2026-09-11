/*
  구글 호출 문턱 — 부를 것 같은 횟수가 아니라 부른 횟수를 세는가.

  이 묶음은 구글 키가 없는 판에서 도는 것이 오히려 낫습니다. 키가 없으면
  구글이 한 번도 안 불리므로, 그런데도 쿼터가 닳는다면 그것은 세는 자리가
  틀렸다는 뜻입니다.
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
const join = async (who) => {
  const r = await call("POST", "/api/auth/register",
    { body: { email: `${who}-${stamp}@t.test`, name: who, password: "pw-12345678" } });
  return r.data?.accessToken;
};

console.log("\n[1] 준비 — 아무것도 안 한 사람 둘");
const me = await join("quota-a");
const other = await join("quota-b");
T("가입", !!me && !!other);

console.log("\n[2] 구글을 한 번도 안 부르는 요청은 쿼터를 안 쓴다");
/*
  없는 날짜의 영업시간입니다. 컨트롤러는 404 를 내고 구글은 안 불립니다.
  그런데 문턱이 경로만 보고 12씩 빼던 시절에는 열세 번째에 막혔습니다.
*/
let blocked = null;
for (let i = 1; i <= 20; i++) {
  const r = await call("GET", "/api/days/ZZZZZZZZZZZZ/places-info", { token: me });
  if (r.status === 429) { blocked = i; break; }
  if (r.status !== 404) { blocked = `${i}번째에 뜻밖의 ${r.status}`; break; }
}
T("없는 날짜를 스무 번 불러도 안 막힌다", blocked === null, { blocked });

console.log("\n[3] 그래서 첫 장소 검색이 막히지 않는다");
let r = await call("GET", "/api/places/search?q=" + encodeURIComponent("난바 파크스"), { token: me });
/* 키가 없으면 400(꺼져 있음), 있으면 200. 어느 쪽이든 429 는 아니어야 합니다. */
T("검색이 429 가 아니다", r.status !== 429, r.data);

console.log("\n[4] 지도 그림도 마찬가지");
r = await call("POST", "/api/trips", { token: me, body: { title: "쿼터 재기", startIso: "2026-12-01", nights: 1 } });
const tripId = r.data?.trip?.id;
T("여행 생성", !!tripId, r.data);
let mapBlocked = null;
for (let i = 1; i <= 20; i++) {
  const res = await fetch(`${BASE}/api/trips/${tripId}/map`, { headers: { authorization: "Bearer " + me } });
  if (res.status === 429) { mapBlocked = i; break; }
}
/* 장소가 없어 400("그릴 곳이 없습니다")이 납니다. 구글은 안 불립니다. */
T("못 그리는 지도를 스무 번 불러도 안 막힌다", mapBlocked === null, { mapBlocked });

console.log("\n[5] 그래도 문턱은 살아 있다");
/*
  여기서는 "정말 막히는가" 를 직접 못 봅니다 — 구글 키가 없으면 어느
  자리도 실제로 세지 않기 때문입니다. 대신 문턱이 지나가는 자리에서
  엉뚱한 상태를 내지 않는지만 봅니다.
*/
r = await call("GET", "/api/places/search?q=" + encodeURIComponent("도톤보리"), { token: other });
T("다른 사람도 막히지 않는다", r.status !== 429, r.data);
r = await call("GET", "/api/places/search?q=" + encodeURIComponent("도톤보리"));
T("로그인 없이는 401 이지 429 가 아니다", r.status === 401, r.data);

await call("DELETE", "/api/trips/" + tripId, { token: me });

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
