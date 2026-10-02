/* 참석 응답 — 「못 가요」 한 사람만 셈에서 빠진다. 합의·정산·날짜 투표가 그 셈을 쓴다 */
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
async function makeGroup(ownerToken, name, mates = []) {
  const g = await call("POST", "/api/groups", { token: ownerToken, body: { name } });
  const gid = g.data.group.id;
  for (const who of mates) {
    const inv = await call("POST", `/api/groups/${gid}/invites`, { token: ownerToken, body: {} });
    await call("POST", `/api/group-invites/${inv.data.invite.token}/accept`, { token: who });
  }
  return gid;
}
const stamp = Date.now();
const reg = async (who, name) => {
  const r = await call("POST", "/api/auth/register",
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678" } });
  const me = await call("GET", "/api/auth/me", { token: r.data.accessToken });
  return { token: r.data.accessToken, id: me.data?.user?.id ?? me.data?.id };
};

console.log("\n[1] 셋이 든 모임, 하나는 못 간다");
const A = await reg("ga", "가"), B = await reg("na", "나"), C = await reg("da", "다");
const X = await reg("x", "남");
T("넷 가입", !!A.id && !!B.id && !!C.id && !!X.id, [A.id, B.id, C.id]);
const groupId = await makeGroup(A.token, "참석 시험", [B.token, C.token]);
let r = await call("POST", "/api/trips", { token: A.token, body: { title: "부산", startIso: "2027-03-01", nights: 1, groupId } });
const tripId = r.data.trip.id;

r = await call("GET", `/api/trips/${tripId}/going`, { token: B.token });
T("답 안 한 사람은 아직 몰라요", r.data.going.length === 3 && r.data.going.every((g) => g.answer === "MAYBE"), r.data);

r = await call("PUT", `/api/trips/${tripId}/going`, { token: C.token, body: { answer: "NOT_GOING", note: "그 주는 출장" } });
T("다가 못 간다고 함", r.status === 200, r.data);
r = await call("PUT", `/api/trips/${tripId}/going`, { token: X.token, body: { answer: "GOING" } });
T("남은 답 못 함", r.status === 404, r.data);

r = await call("GET", `/api/trips/${tripId}/going`, { token: A.token });
const c = r.data.going.find((g) => g.id === C.id);
T("못 간 사람도 목록에 남음", c?.answer === "NOT_GOING" && c?.note === "그 주는 출장", r.data.going);
r = await call("GET", `/api/trips/${tripId}/people`, { token: A.token });
T("가는 사람에서는 빠짐", r.data.people.length === 2 && !r.data.people.some((p) => p.id === C.id), r.data.people);
r = await call("GET", "/api/trip?trip=" + tripId, { token: C.token });
T("못 가도 여행은 봄", r.status === 200, r.status);

console.log("\n[2] 합의는 가는 사람끼리");
r = await call("POST", `/api/trips/${tripId}/candidates`, { token: A.token, body: { name: "해운대", lat: 35.1587, lng: 129.1604 } });
const cand = r.data.id;
await call("PUT", `/api/candidates/${cand}/vote`, { token: A.token, body: { yes: true } });
await call("PUT", `/api/candidates/${cand}/vote`, { token: B.token, body: { yes: true } });
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: A.token });
const card = r.data.candidates.find((x) => x.id === cand);
T("둘이 좋다면 합의", card?.agreed === true && card?.memberCount === 2, card);

console.log("\n[3] 정산은 가는 사람과 돈이 걸린 사람");
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A.token,
  body: { name: "숙소", amount: 10000, currency: "KRW", payerId: A.id } });
T("지출 적힘", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/settlement`, { token: A.token });
let owed = Object.fromEntries(r.data.books[0].balances.map((b) => [b.userId, b.balance]));
T("둘이 나눔 — 나는 5000 냄", owed[B.id] === -5000, owed);
T("못 가는 다는 셈에 없음", !(C.id in owed) || owed[C.id] === 0, owed);

await call("POST", `/api/trips/${tripId}/expenses`, { token: C.token,
  body: { name: "미리 끊은 표", amount: 6000, currency: "KRW", payerId: C.id } });
r = await call("GET", `/api/trips/${tripId}/settlement`, { token: A.token });
owed = Object.fromEntries(r.data.books[0].balances.map((b) => [b.userId, b.balance]));
T("못 간다고 해도 낸 돈은 남음", owed[C.id] !== undefined && owed[C.id] > 0, owed);
T("이름이 나간 사람이 아님", r.data.books[0].balances.find((b) => b.userId === C.id)?.name === "다", r.data.books[0].balances);
T("잔액 합은 0", Object.values(owed).reduce((s, v) => s + v, 0) === 0, owed);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
