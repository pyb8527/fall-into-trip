/* 장소를 "어느 곳 다음" 에 넣으면 그 자리에 들어가는지. */
const BASE = process.env.BASE || "http://127.0.0.1:8090";
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
let r = await call("POST", "/api/auth/register", {
  body: { email: `after-${stamp}@test.com`, name: "짜는 사람", password: "pw-12345678" },
});
const token = r.data.accessToken;
T("가입", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token, body: { title: "끼워넣기", startIso: "2026-05-01" } });
const tripId = r.data.trip.id;
T("여행", r.status === 200, r.data);

r = await call("GET", `/api/trip?trip=${tripId}`, { token });
const dayId = r.data.days[0].id;

/* 시간을 안 적은 곳 셋. 순서는 넣은 차례 그대로여야 합니다. */
const made = [];
for (const name of ["가", "나", "다"]) {
  r = await call("POST", "/api/places", { token, body: { dayId, name, lat: 35.6, lng: 139.7 } });
  made.push(r.data.place.id);
}
r = await call("GET", `/api/trip?trip=${tripId}`, { token });
let names = r.data.days[0].places.map((p) => p.name);
T("넣은 차례대로", names.join(",") === "가,나,다", names);

/* "가" 다음에 끼웁니다. 맨 뒤가 아니라 둘째 자리여야 합니다. */
r = await call("POST", "/api/places", {
  token, body: { dayId, name: "사이", lat: 35.6, lng: 139.7, after: made[0] },
});
T("끼워 넣기", r.status === 200, r.data);

r = await call("GET", `/api/trip?trip=${tripId}`, { token });
names = r.data.days[0].places.map((p) => p.name);
T("가 다음에 들어감", names.join(",") === "가,사이,나,다", names);

/* 맨 마지막 것 다음 */
r = await call("POST", "/api/places", {
  token, body: { dayId, name: "끝에", lat: 35.6, lng: 139.7, after: made[2] },
});
r = await call("GET", `/api/trip?trip=${tripId}`, { token });
names = r.data.days[0].places.map((p) => p.name);
T("마지막 다음도 됨", names.join(",") === "가,사이,나,다,끝에", names);

/* after 를 안 주면 지금까지처럼 맨 뒤 */
r = await call("POST", "/api/places", { token, body: { dayId, name: "그냥", lat: 35.6, lng: 139.7 } });
r = await call("GET", `/api/trip?trip=${tripId}`, { token });
names = r.data.days[0].places.map((p) => p.name);
T("안 주면 맨 뒤", names[names.length - 1] === "그냥", names);

/* 없는 장소를 가리키면 맨 뒤. 터지지 않아야 합니다. */
r = await call("POST", "/api/places", {
  token, body: { dayId, name: "엉뚱", lat: 35.6, lng: 139.7, after: "없는아이디" },
});
T("모르는 자리여도 안 터짐", r.status === 200, r.data);
r = await call("GET", `/api/trip?trip=${tripId}`, { token });
names = r.data.days[0].places.map((p) => p.name);
T("모르는 자리면 맨 뒤", names[names.length - 1] === "엉뚱", names);

/* 시각이 적힌 것은 시각이 이깁니다 — 끼워 넣어도 제 시각 자리로 갑니다. */
r = await call("POST", "/api/places", {
  token, body: { dayId, name: "아침", lat: 35.6, lng: 139.7, time: "08:00", after: made[2] },
});
r = await call("GET", `/api/trip?trip=${tripId}`, { token });
names = r.data.days[0].places.map((p) => p.name);
T("시각이 있으면 시각이 이김", names.includes("아침"), names);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
