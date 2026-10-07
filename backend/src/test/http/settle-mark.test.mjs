/* 정산 「보냈어요 / 받았어요」 — 제 쪽만, 금액이 같은 줄에만 */
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
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678", over14: true, terms: true, privacy: true } });
  return r.data.accessToken;
};

const regId = async (who, name) => {
  const token = await reg(who, name);
  const me = await call("GET", "/api/auth/me", { token });
  return { token, id: me.data.user.id };
};
const A = await regId("sga", "가"), B = await regId("sna", "나"), C = await regId("sda", "다");
const groupId = await makeGroup(A.token, "정산 시험", [B.token, C.token]);
let r = await call("POST", "/api/trips", { token: A.token, body: { title: "강릉", startIso: "2027-06-01", nights: 1, groupId } });
const tripId = r.data.trip.id;
await call("POST", `/api/trips/${tripId}/expenses`, { token: A.token, body: { name: "숙소", amount: 30000, currency: "KRW", payerId: A.id } });

const lineOf = async (from) => {
  const got = await call("GET", `/api/trips/${tripId}/settlement`, { token: A.token });
  return got.data.books[0].transfers.find((t) => t.fromUserId === from);
};
const mark = (token, t, extra) => call("PUT", `/api/trips/${tripId}/settlement/mark`, { token,
  body: { fromId: t.fromUserId, toId: t.toUserId, currency: "KRW", amount: t.amount, ...extra } });

console.log("\n[1] 처음에는 표시 없음");
let t = await lineOf(B.id);
T("나 → 가 10000", t?.amount === 10000 && t.toUserId === A.id, t);
T("표시 없음", !t.sentAt && !t.receivedAt, t);

console.log("\n[2] 제 쪽만 누름");
r = await mark(C.token, t, { sent: true });
T("남이 보냈어요 못 누름", r.status === 403, r.data);
r = await mark(B.token, t, { received: true });
T("보낸 사람이 받았어요 못 누름", r.status === 403, r.data);
r = await mark(B.token, t, { sent: true });
T("보낸 사람이 보냈어요", r.status === 200, r.data);
t = await lineOf(B.id);
T("보냈어요 찍힘", !!t.sentAt && !t.receivedAt, t);
r = await mark(A.token, t, { received: true });
t = await lineOf(B.id);
T("받은 사람이 받았어요", !!t.sentAt && !!t.receivedAt, t);

console.log("\n[3] 금액이 바뀌면 표시가 사라짐");
await call("POST", `/api/trips/${tripId}/expenses`, { token: A.token, body: { name: "저녁", amount: 3000, currency: "KRW", payerId: A.id } });
t = await lineOf(B.id);
T("나 → 가 11000", t.amount === 11000, t);
T("옛 표시 안 보임", !t.sentAt && !t.receivedAt, t);
r = await mark(B.token, { ...t, amount: 10000 }, { sent: true });
T("옛 금액으로 누르면 409", r.status === 409, r.data);
r = await mark(B.token, t, { sent: true });
t = await lineOf(B.id);
T("새 금액에 다시 찍힘", !!t.sentAt && !t.receivedAt, t);

console.log("\n[4] 거두기");
r = await mark(B.token, t, { sent: false });
t = await lineOf(B.id);
T("보냈어요 거둠", !t.sentAt, t);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
