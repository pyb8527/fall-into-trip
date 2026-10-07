/* 가고 싶은 곳 투표 마감 — 정하고, 지난 날은 거절하고, 지나면 표와 새 후보를 막고, 옮기기는 둔다 */
import { execSync } from "node:child_process";

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
/* 서버와 같은 날짜(기기의 하루)로 적습니다. toISOString 은 UTC 라 자정 근처에 하루 어긋납니다. */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
const tomorrow = new Date(Date.now() + 86400000);
const yesterday = new Date(Date.now() - 86400000);
const stamp = Date.now();
const reg = async (who, name) => {
  const r = await call("POST", "/api/auth/register",
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678", over14: true, terms: true, privacy: true } });
  return r.data.accessToken;
};

const A = await reg("vua", "가"), B = await reg("vub", "나"), X = await reg("vux", "남");
let r = await call("POST", "/api/groups", { token: A, body: { name: "마감 시험" } });
const gid = r.data.group.id;
r = await call("POST", `/api/groups/${gid}/invites`, { token: A, body: {} });
await call("POST", `/api/group-invites/${r.data.invite.token}/accept`, { token: B });
r = await call("POST", "/api/trips", { token: A, body: { title: "교토", startIso: "2027-04-01", nights: 1, groupId: gid } });
const tripId = r.data.trip.id;
r = await call("POST", `/api/trips/${tripId}/candidates`, { token: A, body: { name: "기요미즈데라", lat: 34.99, lng: 135.78 } });
const cand = r.data.id;

console.log("\n[1] 처음엔 마감이 없음");
r = await call("GET", "/api/trip?trip=" + tripId, { token: B });
T("voteUntil 비어 있음", r.data.trip.voteUntil == null, r.data.trip);

console.log("\n[2] 멤버가 정함");
r = await call("PUT", `/api/trips/${tripId}/vote-until`, { token: B, body: { date: iso(tomorrow) } });
T("200", r.status === 200 && r.data.voteUntil === iso(tomorrow), r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
T("다른 멤버에게도 보임", r.data.trip.voteUntil === iso(tomorrow), r.data.trip);
r = await call("PUT", `/api/trips/${tripId}/vote-until`, { token: A, body: { date: iso(today) } });
T("오늘도 됨", r.status === 200, r.data);
r = await call("PUT", `/api/candidates/${cand}/vote`, { token: B, body: { yes: true } });
T("마감 날 당일은 표를 받음", r.status === 200, r.data);

console.log("\n[3] 이상한 값은 거절");
r = await call("PUT", `/api/trips/${tripId}/vote-until`, { token: A, body: { date: iso(yesterday) } });
T("지난 날 400", r.status === 400, r.data);
r = await call("PUT", `/api/trips/${tripId}/vote-until`, { token: A, body: { date: "내일" } });
T("못 읽는 날짜 400", r.status === 400, r.data);
r = await call("PUT", `/api/trips/${tripId}/vote-until`, { token: X, body: { date: iso(tomorrow) } });
T("남은 404", r.status === 404, r.data);

/* 지난 마감은 화면으로 못 만듭니다. 시험용 DB 를 바로 만질 수 있을 때만 봅니다. */
if (process.env.PSQL_DB) {
  console.log("\n[4] 마감이 지나면");
  execSync(`docker exec fit-scratch-db psql -U fit -d ${process.env.PSQL_DB} -qc "UPDATE trips SET vote_until = current_date - 1 WHERE id = '${tripId}'"`);
  r = await call("PUT", `/api/candidates/${cand}/vote`, { token: A, body: { yes: true } });
  T("표는 409", r.status === 409, r.data);
  r = await call("PUT", `/api/candidates/${cand}/vote`, { token: B, body: {} });
  T("거두기도 409", r.status === 409, r.data);
  r = await call("POST", `/api/trips/${tripId}/candidates`, { token: B, body: { name: "후시미이나리", lat: 34.96, lng: 135.77 } });
  T("새 후보도 409", r.status === 409, r.data);
  r = await call("GET", `/api/trips/${tripId}/candidates`, { token: A });
  T("보는 것은 됨", r.status === 200 && r.data.candidates.length === 1, r.data);
  r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
  const dayId = r.data.days[0].id;
  r = await call("POST", `/api/days/${dayId}/places/from-candidates`, { token: A, body: { candidateIds: [cand] } });
  T("일정으로 옮기기는 됨", r.status === 200, r.data);
} else {
  console.log("\n[4] 건너뜀 — PSQL_DB 가 없어 지난 마감을 만들 수 없습니다");
}

console.log("\n[5] 걷기");
r = await call("PUT", `/api/trips/${tripId}/vote-until`, { token: A, body: { date: "" } });
T("비우면 마감 없음", r.status === 200 && r.data.voteUntil == null, r.data);
r = await call("PUT", `/api/trips/${tripId}/vote-until`, { token: A });
T("몸통 없어도 비움", r.status === 200 && r.data.voteUntil == null, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
