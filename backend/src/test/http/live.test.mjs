/* 임시 핀과 실시간 위치. 동행자만 보고, 자취는 남지 않는다 */
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

console.log("\n[1] 주인·동행자·남");
let r = await reg("host", "주인");
const host = r.data.accessToken;
r = await reg("mate", "동행자");
const mate = r.data.accessToken;
r = await reg("stranger", "남");
const stranger = r.data.accessToken;
T("셋 가입", !!host && !!mate && !!stranger);

r = await call("POST", "/api/trips", { token: host, body: { title: "부산", startIso: "2027-05-01", nights: 1 } });
const tripId = r.data.trip.id;
r = await call("POST", `/api/trips/${tripId}/invites`, { token: host, body: { role: "EDITOR" } });
r = await call("POST", `/api/invites/${r.data.invite.token}/accept`, { token: mate });
T("동행자가 들어옴", r.status === 200, r.data);

console.log("\n[2] 임시 핀");
r = await call("POST", `/api/trips/${tripId}/pins`, { token: mate,
  body: { lat: 35.1587, lng: 129.1604, label: "여기 카페" } });
T("꽂힘", r.status === 200 && !!r.data.id, r.data);
const pinId = r.data.id;
r = await call("GET", `/api/trips/${tripId}/pins`, { token: host });
T("동행자에게 보임", r.data.pins.length === 1 && r.data.pins[0].label === "여기 카페", r.data.pins);
T("누가 꽂았는지 보임", r.data.pins[0].authorName === "동행자", r.data.pins?.[0]);
T("내 것이 아니라고 표시", r.data.pins[0].mine === false, r.data.pins?.[0]);
r = await call("GET", `/api/trips/${tripId}/pins`, { token: stranger });
T("남은 못 봄", r.status === 403 || r.status === 404, r.data);
r = await call("POST", `/api/trips/${tripId}/pins`, { token: mate, body: { lat: 999, lng: 999 } });
T("좌표가 이상하면 거절", r.status === 400, r.data);

r = await call("DELETE", `/api/pins/${pinId}`, { token: host });
T("남이 꽂은 것은 못 뺌", r.status === 403, r.data);
r = await call("DELETE", `/api/pins/${pinId}`, { token: mate });
T("내가 꽂은 것은 뺌", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/pins`, { token: host });
T("사라짐", r.data.pins.length === 0, r.data.pins);

console.log("\n[3] 실시간 위치");
r = await call("GET", `/api/trips/${tripId}/locations`, { token: host });
T("처음에는 아무도 안 켬", r.data.people.length === 0 && r.data.sharing === false, r.data);

r = await call("PUT", `/api/trips/${tripId}/location`, { token: mate,
  body: { lat: 35.1587, lng: 129.1604, accuracy: 12 } });
T("켬", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/locations`, { token: host });
T("동행자가 보임", r.data.people.length === 1 && r.data.people[0].name === "동행자", r.data.people);
T("정확도도 옴", r.data.people[0].accuracy === 12, r.data.people?.[0]);
T("보는 사람은 안 켠 상태", r.data.sharing === false, r.data.sharing);

r = await call("GET", `/api/trips/${tripId}/locations`, { token: mate });
T("켠 사람은 켰다고 나옴", r.data.sharing === true, r.data.sharing);
T("내 자리는 안 돌려줌", r.data.people.length === 0, r.data.people);

console.log("\n[4] 자취를 남기지 않는다");
await call("PUT", `/api/trips/${tripId}/location`, { token: mate, body: { lat: 35.2, lng: 129.2 } });
await call("PUT", `/api/trips/${tripId}/location`, { token: mate, body: { lat: 35.3, lng: 129.3 } });
r = await call("GET", `/api/trips/${tripId}/locations`, { token: host });
T("여러 번 보내도 한 줄", r.data.people.length === 1, r.data.people);
T("마지막 자리만 남음", r.data.people[0].lat === 35.3, r.data.people?.[0]);

console.log("\n[5] 남은 못 켜고 못 본다");
r = await call("PUT", `/api/trips/${tripId}/location`, { token: stranger, body: { lat: 35.1, lng: 129.1 } });
T("남은 못 켬", r.status === 403 || r.status === 404, r.data);
r = await call("GET", `/api/trips/${tripId}/locations`, { token: stranger });
T("남은 못 봄", r.status === 403 || r.status === 404, r.data);

console.log("\n[6] 끄기");
r = await call("DELETE", `/api/trips/${tripId}/location`, { token: mate });
T("끔", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/locations`, { token: host });
T("바로 사라짐", r.data.people.length === 0, r.data.people);
r = await call("GET", `/api/trips/${tripId}/locations`, { token: mate });
T("켠 표시도 내려감", r.data.sharing === false, r.data.sharing);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
