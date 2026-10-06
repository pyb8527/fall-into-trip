/* 여행 예산 — 멤버 누구나 정하고, 걷고, 남은 못 건드린다 */
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
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678" } });
  return r.data.accessToken;
};

const A = await reg("bga", "가"), B = await reg("bgb", "나"), X = await reg("bgx", "남");
let r = await call("POST", "/api/groups", { token: A, body: { name: "예산 시험" } });
const gid = r.data.group.id;
r = await call("POST", `/api/groups/${gid}/invites`, { token: A, body: {} });
await call("POST", `/api/group-invites/${r.data.invite.token}/accept`, { token: B });
r = await call("POST", "/api/trips", { token: A, body: { title: "오사카", startIso: "2027-04-01", nights: 2, groupId: gid } });
const tripId = r.data.trip.id;

console.log("\n[1] 처음엔 없음");
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
T("budget 비어 있음", r.data.trip.budget == null, r.data.trip);

console.log("\n[2] 멤버가 정함");
r = await call("PUT", `/api/trips/${tripId}/budget`, { token: B, body: { amount: 1500000 } });
T("200", r.status === 200 && r.data.budget === 1500000, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
T("다른 멤버에게도 보임", r.data.trip.budget === 1500000, r.data.trip);

console.log("\n[3] 이상한 값은 거절");
r = await call("PUT", `/api/trips/${tripId}/budget`, { token: A, body: { amount: -1 } });
T("음수 400", r.status === 400, r.data);
r = await call("PUT", `/api/trips/${tripId}/budget`, { token: A, body: { amount: 1000000001 } });
T("10억 넘으면 400", r.status === 400, r.data);

console.log("\n[4] 남은 못 건드림");
r = await call("PUT", `/api/trips/${tripId}/budget`, { token: X, body: { amount: 1 } });
T("404", r.status === 404, r.data);

console.log("\n[5] 걷기");
r = await call("PUT", `/api/trips/${tripId}/budget`, { token: A, body: { amount: 0 } });
T("0 이면 비움", r.status === 200 && r.data.budget == null, r.data);
r = await call("PUT", `/api/trips/${tripId}/budget`, { token: A, body: {} });
T("빈 몸통도 비움", r.status === 200 && r.data.budget == null, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
