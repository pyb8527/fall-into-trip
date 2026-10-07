/* 다음 장소까지의 이동 — 적고, 고치고, 지우고, 이상한 것은 거절 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,240) : ""));
async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const stamp = Date.now();
const reg = async (who, name) => {
  const r = await call("POST", "/api/auth/register",
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678", over14: true, terms: true, privacy: true } });
  return r.data.accessToken;
};

const A = await reg("lga", "가"), X = await reg("lgx", "남");
let r = await call("POST", "/api/trips", { token: A, body: { title: "도쿄", startIso: "2027-04-01", nights: 1 } });
const tripId = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
const dayId = r.data.days[0].id;
r = await call("POST", "/api/places", { token: A, body: { dayId, name: "닛포리", lat: 35.728, lng: 139.770 } });
const placeId = r.data.place.id;
T("처음엔 이동이 없음", r.data.place.move == null, r.data.place);

console.log("\n[1] 적는다");
r = await call("PATCH", `/api/places/${placeId}`, { token: A, body: {
  move: JSON.stringify({ mode: "transit", via: " 야마노테선 ", min: 10, cost: "170엔", junk: 1 }) } });
T("200", r.status === 200, r.data);
T("다듬어서 객체로 돌려줌", r.data.place.move?.mode === "transit" && r.data.place.move?.via === "야마노테선"
  && r.data.place.move?.min === 10 && r.data.place.move?.cost === "170엔", r.data.place.move);
T("모르는 칸은 버림", r.data.place.move && !("junk" in r.data.place.move), r.data.place.move);
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
T("일정에 실림", r.data.days[0].places[0].move?.via === "야마노테선", r.data.days[0].places[0]);

console.log("\n[2] 다른 칸을 고쳐도 이동은 그대로");
r = await call("PATCH", `/api/places/${placeId}`, { token: A, body: { note: "스이카 충전" } });
T("남아 있음", r.data.place.move?.via === "야마노테선", r.data.place);

console.log("\n[3] 이상한 것은 거절");
for (const [what, move] of [
  ["모르는 수단", { mode: "rocket" }],
  ["하루 넘는 시간", { min: 2000 }],
  ["너무 긴 길", { via: "가".repeat(81) }],
]) {
  r = await call("PATCH", `/api/places/${placeId}`, { token: A, body: { move: JSON.stringify(move) } });
  T(`${what} 400`, r.status === 400, r.data);
}
r = await call("PATCH", `/api/places/${placeId}`, { token: A, body: { move: "{깨진" } });
T("깨진 글자 400", r.status === 400, r.data);

console.log("\n[4] 남은 못 고침");
r = await call("PATCH", `/api/places/${placeId}`, { token: X, body: { move: JSON.stringify({ via: "몰래" }) } });
T("404", r.status === 404, r.data);

console.log("\n[5] 지운다");
r = await call("PATCH", `/api/places/${placeId}`, { token: A, body: { move: "" } });
T("빈 글자면 지워짐", r.status === 200 && r.data.place.move == null, r.data.place);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
