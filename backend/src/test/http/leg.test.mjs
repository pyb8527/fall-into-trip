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

console.log("\n[6] 타는 역 · 내리는 역 — 동행은 적고, 남은 404");
/* 역은 장소 검색으로 고르면 이름 · 자리 · 구글 번호가, 검색이 안 되면 이름만
   옵니다. 칸이 늘어도 문(누가 고칠 수 있나)은 이동과 같아야 합니다. */
{
  const B = await reg("lgb", "나");
  r = await call("POST", "/api/groups", { token: A, body: { name: "역 모임" } });
  const groupId = r.data.group.id;
  r = await call("POST", `/api/groups/${groupId}/invites`, { token: A, body: {} });
  r = await call("POST", "/api/group-invites/" + r.data.invite.token + "/accept", { token: B });
  T("동행이 모임에 들어옴", r.status === 200, r.data);
  r = await call("POST", "/api/trips", { token: A, body: { title: "역 여행", startIso: "2027-04-10", nights: 0, groupId } });
  const gTrip = r.data.trip.id;
  const gDay = (await call("GET", "/api/trip?trip=" + gTrip, { token: A })).data.days[0].id;
  r = await call("POST", "/api/places", { token: A, body: { dayId: gDay, name: "도쿄도청", lat: 35.689, lng: 139.692 } });
  const gPlace = r.data.place.id;

  const move = { mode: "transit", via: "야마노테선", min: 10,
    from: { name: " 신주쿠역 ", lat: 35.6896, lng: 139.7006, placeId: "ChIJ-shinjuku", junk: 1 },
    to: { name: "시부야역" } };
  r = await call("PATCH", `/api/places/${gPlace}`, { token: B, body: { move: JSON.stringify(move) } });
  T("동행이 역을 적음 200", r.status === 200, r.data);
  const m = r.data.place?.move;
  T("타는 역은 이름 · 자리 · 번호까지", m?.from?.name === "신주쿠역" && m?.from?.lat === 35.6896
    && m?.from?.lng === 139.7006 && m?.from?.placeId === "ChIJ-shinjuku" && !("junk" in (m?.from ?? {})), m);
  T("내리는 역은 이름만", m?.to?.name === "시부야역" && m?.to?.lat === undefined, m);
  r = await call("GET", "/api/trip?trip=" + gTrip, { token: A });
  T("일정에 역이 실림", r.data.days[0].places[0].move?.from?.name === "신주쿠역", r.data.days[0].places[0]);

  r = await call("PATCH", `/api/places/${gPlace}`, { token: X, body: { move: JSON.stringify(move) } });
  T("남은 역을 못 적음 404", r.status === 404, r.data);
  r = await call("PATCH", `/api/places/${gPlace}`, { token: B, body: {
    move: JSON.stringify({ mode: "transit", from: { name: "신주쿠역", lat: 35.6 } }) } });
  T("반쪽 좌표 400", r.status === 400, r.data);
  r = await call("GET", "/api/trip?trip=" + gTrip, { token: A });
  T("거절된 뒤에도 적어 둔 역은 그대로", r.data.days[0].places[0].move?.to?.name === "시부야역", r.data.days[0].places[0]);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
