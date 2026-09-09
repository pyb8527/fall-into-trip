/* 가고 싶은 곳을 후보로 올리고, 동행자 전원이 좋다고 한 것만 일정으로 옮긴다 */
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
const cardOf = (list, id) => list.find(c => c.id === id);

console.log("\n[1] 주인과 동행자");
let r = await reg("host", "주인");
const host = r.data.accessToken;
r = await reg("mate", "동행자");
const mate = r.data.accessToken;
r = await reg("stranger", "남");
const stranger = r.data.accessToken;
T("셋 가입", !!host && !!mate && !!stranger);

r = await call("POST", "/api/trips", { token: host, body: { title: "삿포로", startIso: "2027-01-10", nights: 2 } });
const tripId = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: host });
const dayId = r.data.days[0].id;

r = await call("POST", `/api/trips/${tripId}/invites`, { token: host, body: { role: "EDITOR" } });
r = await call("POST", `/api/invites/${r.data.invite.token}/accept`, { token: mate });
T("동행자가 들어옴", r.status === 200, r.data);

console.log("\n[2] 후보 올리기");
r = await call("POST", `/api/trips/${tripId}/candidates`, { token: host,
  body: { name: "니조 시장", lat: 43.0553, lng: 141.3546, cat: "식사" } });
T("올라감", r.status === 200 && !!r.data.id, r.data);
const a = r.data.id;
r = await call("POST", `/api/trips/${tripId}/candidates`, { token: mate,
  body: { name: "모이와야마", lat: 43.0398, lng: 141.3242 } });
const b = r.data.id;
T("동행자도 올릴 수 있음", r.status === 200, r.data);

r = await call("POST", `/api/trips/${tripId}/candidates`, { token: stranger, body: { name: "몰래", lat: 43, lng: 141 } });
T("남은 못 올림", r.status === 403 || r.status === 404, r.data);
r = await call("POST", `/api/trips/${tripId}/candidates`, { token: host, body: { name: "  ", lat: 43, lng: 141 } });
T("이름 없으면 거절", r.status === 400, r.data);

console.log("\n[3] 보석함에서 가져와 올리기");
r = await call("POST", "/api/saved", { token: host,
  body: { name: "스프카레 가게", lat: 43.0621, lng: 141.3544, placeId: "gplace-soup" } });
const savedId = r.data.place.id;
r = await call("POST", `/api/trips/${tripId}/candidates`, { token: host, body: { savedId } });
T("보석함 것이 후보로", r.status === 200, r.data);
const c = r.data.id;
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: host });
T("이름·번호가 따라옴",
  cardOf(r.data.candidates, c)?.name === "스프카레 가게" && cardOf(r.data.candidates, c)?.placeId === "gplace-soup",
  cardOf(r.data.candidates, c));

console.log("\n[4] 투표");
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: host });
T("동행자 수를 셈", cardOf(r.data.candidates, a)?.memberCount === 2, r.data.candidates?.[0]);
T("처음에는 아무도 안 정함", cardOf(r.data.candidates, a)?.agreed === false, cardOf(r.data.candidates, a));

r = await call("PUT", `/api/candidates/${a}/vote`, { token: host, body: { yes: true } });
T("주인 찬성", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: host });
T("한 표만으로는 안 정해짐", cardOf(r.data.candidates, a)?.agreed === false, cardOf(r.data.candidates, a));
T("내 표가 보임", cardOf(r.data.candidates, a)?.myVote === true, cardOf(r.data.candidates, a));

r = await call("PUT", `/api/candidates/${a}/vote`, { token: mate, body: { yes: true } });
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: host });
T("전원이 좋다고 하면 정해짐", cardOf(r.data.candidates, a)?.agreed === true, cardOf(r.data.candidates, a));
T("찬성 수도 맞음", cardOf(r.data.candidates, a)?.yes === 2, cardOf(r.data.candidates, a));

r = await call("PUT", `/api/candidates/${b}/vote`, { token: host, body: { yes: false } });
r = await call("PUT", `/api/candidates/${b}/vote`, { token: mate, body: { yes: true } });
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: host });
T("한 명이라도 싫으면 안 정해짐", cardOf(r.data.candidates, b)?.agreed === false, cardOf(r.data.candidates, b));

r = await call("PUT", `/api/candidates/${a}/vote`, { token: mate, body: {} });
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: host });
T("표를 거두면 다시 미정", cardOf(r.data.candidates, a)?.agreed === false, cardOf(r.data.candidates, a));
T("거둔 표는 반대가 아님", cardOf(r.data.candidates, a)?.no === 0, cardOf(r.data.candidates, a));
r = await call("PUT", `/api/candidates/${a}/vote`, { token: stranger, body: { yes: true } });
T("남은 투표 못 함", r.status === 403 || r.status === 404, r.data);

console.log("\n[5] 내리기");
r = await call("DELETE", `/api/candidates/${b}`, { token: host });
T("주인은 남이 올린 것도 내림", r.status === 200, r.data);
r = await call("POST", `/api/trips/${tripId}/candidates`, { token: mate, body: { name: "동행자 것", lat: 43.05, lng: 141.35 } });
const d = r.data.id;
r = await call("DELETE", `/api/candidates/${d}`, { token: mate });
T("올린 사람은 자기 것을 내림", r.status === 200, r.data);

console.log("\n[6] 일정으로 옮기기");
r = await call("PUT", `/api/candidates/${a}/vote`, { token: mate, body: { yes: true } });
r = await call("POST", `/api/days/${dayId}/places/from-candidates`, { token: host, body: { candidateIds: [a, c] } });
T("두 곳 옮김", r.status === 200 && r.data.added === 2, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: host });
T("일정에 들어감", r.data.days[0].places.length === 2, r.data.days[0].places);
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: host });
T("후보에서는 사라짐", r.data.candidates.length === 0, r.data.candidates);
r = await call("POST", `/api/days/${dayId}/places/from-candidates`, { token: host, body: { candidateIds: [] } });
T("아무것도 안 고르면 거절", r.status === 400, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
