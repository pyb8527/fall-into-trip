/* 장소를 담아 두었다가 내 일정 아무 날에나 꺼내 넣는다 */
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
  { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678" } });

console.log("\n[1] 두 사람과 여행 하나");
let r = await reg("saver", "담는이");
const me = r.data.accessToken;
T("가입", r.status === 200, r.data);
r = await reg("other", "남");
const other = r.data.accessToken;

r = await call("POST", "/api/trips", { token: me, body: { title: "오사카", startIso: "2026-11-10", nights: 1 } });
const tripId = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: me });
const dayId = r.data.days[0].id;
T("여행과 날짜 준비", !!dayId, r.data.days?.[0]);

console.log("\n[2] 담기");
r = await call("POST", "/api/saved", { token: me,
  body: { name: "이치란 라멘", lat: 34.6688, lng: 135.5019, placeId: "gplace-ichiran", cat: "식사" } });
T("담김", r.status === 200 && !!r.data.place.id, r.data);
const savedA = r.data.place.id;

r = await call("POST", "/api/saved", { token: me,
  body: { name: "이치란 라멘(다른이름)", lat: 34.6688, lng: 135.5019, placeId: "gplace-ichiran" } });
T("같은 가게는 두 번 안 쌓임", r.data.place.id === savedA, r.data.place);
r = await call("GET", "/api/saved", { token: me });
T("보관함에 하나", r.data.places.length === 1, r.data.places);
T("담을 때 값이 그대로", r.data.places[0].name === "이치란 라멘", r.data.places[0]);

r = await call("POST", "/api/saved", { token: me,
  body: { name: "구로몬 시장", lat: 34.6656, lng: 135.5061 } });
const savedB = r.data.place.id;
T("번호 없는 곳도 담김", r.status === 200 && !!savedB, r.data);

r = await call("POST", "/api/saved", { token: me, body: { name: "  ", lat: 34.6, lng: 135.5 } });
T("이름이 없으면 거절", r.status === 400, r.data);
r = await call("POST", "/api/saved", { token: me, body: { name: "엉뚱한 곳", lat: 999, lng: 999 } });
T("좌표가 이상하면 거절", r.status === 400, r.data);

console.log("\n[3] 남의 보관함은 안 보인다");
r = await call("GET", "/api/saved", { token: other });
T("남에게는 비어 있음", r.data.places.length === 0, r.data.places);
r = await call("DELETE", "/api/saved/" + savedA, { token: other });
T("남의 것은 못 지움", r.status === 404, r.data);

console.log("\n[4] 일정에 꺼내 넣기");
r = await call("POST", `/api/days/${dayId}/places/from-saved`, { token: me, body: { savedIds: [savedA, savedB] } });
T("두 곳 들어감", r.status === 200 && r.data.added === 2, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: me });
const put = r.data.days[0].places;
T("일정에 보임", put.length === 2, put);
T("구글 번호도 따라옴", put.some(p => p.placeId === "gplace-ichiran"), put);

r = await call("GET", "/api/saved", { token: me });
T("보관함에는 그대로 남음", r.data.places.length === 2, r.data.places);

r = await call("POST", `/api/days/${dayId}/places/from-saved`, { token: me, body: { savedIds: [] } });
T("아무것도 안 고르면 거절", r.status === 400, r.data);
r = await call("POST", `/api/days/${dayId}/places/from-saved`, { token: other, body: { savedIds: [savedA] } });
T("남의 여행에는 못 넣음", r.status === 403 || r.status === 404, r.data);

console.log("\n[5] 지우기");
r = await call("DELETE", "/api/saved/" + savedB, { token: me });
T("지움", r.status === 200, r.data);
r = await call("GET", "/api/saved", { token: me });
T("하나 남음", r.data.places.length === 1, r.data.places);
r = await call("GET", "/api/trip?trip=" + tripId, { token: me });
T("이미 넣은 일정은 안 건드림", r.data.days[0].places.length === 2, r.data.days[0].places);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
