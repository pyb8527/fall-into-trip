/* 정산 「보냈어요 / 받았어요」 — 제 쪽만, 금액이 같은 줄에만, 둘 다 누르면 주고받은 돈(V62) */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
/* 시험용 DB 를 바로 볼 수 있을 때만 씁니다(deletion.test.mjs 와 같은 길). */
function sql(query) {
  return execSync(`docker exec fit-scratch-db psql -U fit -d ${process.env.PSQL_DB} -tAc "${query}"`).toString().trim();
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

const booksOf = async (trip, currency) => {
  const got = await call("GET", `/api/trips/${trip}/settlement`, { token: A.token });
  return got.data.books.find((b) => b.currency === currency);
};
const lineOf = async (from) => (await booksOf(tripId, "KRW")).transfers.find((t) => t.fromUserId === from);
const markOn = (trip, currency) => (token, t, extra) => call("PUT", `/api/trips/${trip}/settlement/mark`, { token,
  body: { fromId: t.fromUserId, toId: t.toUserId, currency, amount: t.amount, ...extra } });
const mark = markOn(tripId, "KRW");
const balanceOf = (books, id) => books.balances.find((b) => b.userId === id)?.balance ?? 0;

console.log("\n[1] 처음에는 표시 없음");
let t = await lineOf(B.id);
T("나 → 가 10000", t?.amount === 10000 && t.toUserId === A.id, t);
T("표시 없음", !t.sentAt && !t.receivedAt, t);
T("주고받은 기록 없음", (await booksOf(tripId, "KRW")).paid.length === 0);

console.log("\n[2] 제 쪽만 누름");
r = await mark(C.token, t, { sent: true });
T("남이 보냈어요 못 누름", r.status === 403, r.data);
r = await mark(B.token, t, { received: true });
T("보낸 사람이 받았어요 못 누름", r.status === 403, r.data);
r = await mark(B.token, t, { sent: true });
T("보낸 사람이 보냈어요", r.status === 200, r.data);
t = await lineOf(B.id);
T("보냈어요 찍힘", !!t.sentAt && !t.receivedAt, t);

console.log("\n[3] 둘 다 누르면 주고받은 돈 — 줄이 사라지고 잔액이 0");
r = await mark(A.token, t, { received: true });
T("받은 사람이 받았어요", r.status === 200, r.data);
let books = await booksOf(tripId, "KRW");
T("나의 줄이 사라짐", !books.transfers.some((x) => x.fromUserId === B.id), books.transfers);
T("나의 잔액 0", balanceOf(books, B.id) === 0, books.balances);
T("가는 다에게서만 10000 남음", balanceOf(books, A.id) === 10000, books.balances);
const paidB = books.paid[0];
T("주고받은 기록 한 건", books.paid.length === 1 && paidB.fromUserId === B.id && paidB.toUserId === A.id
  && paidB.amount === 10000 && paidB.fromName === "나" && paidB.toName === "가" && !!paidB.at && !!paidB.id, books.paid);
r = await mark(B.token, { fromUserId: B.id, toUserId: A.id, amount: 10000 }, { sent: true });
T("사라진 줄에 다시 누르면 409", r.status === 409, r.data);

console.log("\n[4] 주고받은 뒤 지출이 늘면 새 몫만");
await call("POST", `/api/trips/${tripId}/expenses`, { token: A.token, body: { name: "저녁", amount: 3000, currency: "KRW", payerId: A.id } });
t = await lineOf(B.id);
T("나 → 가 1000 (11000 이 아님)", t?.amount === 1000, t);
T("옛 표시 안 붙음", !t.sentAt && !t.receivedAt, t);
r = await mark(B.token, { ...t, amount: 11000 }, { sent: true });
T("옛 셈의 금액으로 누르면 409", r.status === 409, r.data);
r = await mark(B.token, t, { sent: true });
t = await lineOf(B.id);
T("새 금액에 찍힘", !!t.sentAt && !t.receivedAt, t);

console.log("\n[5] 한쪽만 누른 것은 거둘 수 있음");
r = await mark(B.token, t, { sent: false });
t = await lineOf(B.id);
T("보냈어요 거둠", !t.sentAt, t);

console.log("\n[6] 둘이 가는 엔 — 1,900엔 주고받은 뒤");
const D = await regId("sgd", "라"), E = await regId("sge", "마");
const pair = await makeGroup(D.token, "둘 정산", [E.token]);
r = await call("POST", "/api/trips", { token: D.token, body: { title: "오사카", startIso: "2027-09-01", nights: 2, groupId: pair } });
const yenTrip = r.data.trip.id;
const yen = markOn(yenTrip, "JPY");
const yenBooks = async () => (await call("GET", `/api/trips/${yenTrip}/settlement`, { token: D.token })).data.books.find((b) => b.currency === "JPY");
await call("POST", `/api/trips/${yenTrip}/expenses`, { token: D.token, body: { name: "숙소", amount: 3800, currency: "JPY", payerId: D.id } });
books = await yenBooks();
let y = books.transfers[0];
T("마 → 라 ¥1,900", books.transfers.length === 1 && y.fromUserId === E.id && y.amount === 1900, books.transfers);
await yen(E.token, y, { sent: true });
await yen(D.token, y, { received: true });
books = await yenBooks();
T("다 주고받음 — 줄 없음", books.transfers.length === 0, books.transfers);
T("잔액 모두 0", books.balances.every((b) => b.balance === 0), books.balances);

await call("POST", `/api/trips/${yenTrip}/expenses`, { token: D.token, body: { name: "기념품", amount: 500, currency: "JPY", payerId: D.id, share: [D.id] } });
books = await yenBooks();
T("낸 사람 혼자의 ¥500 — 새 줄 없음", books.transfers.length === 0, books.transfers);
T("「주고받았어요」 붙은 옛 줄이 다시 서지 않음", !books.transfers.some((x) => x.sentAt || x.receivedAt), books.transfers);

await call("POST", `/api/trips/${yenTrip}/expenses`, { token: E.token, body: { name: "점심", amount: 500, currency: "JPY", payerId: E.id } });
books = await yenBooks();
y = books.transfers[0];
T("마가 낸 ¥500 둘이 나눔 → 라 → 마 ¥250", books.transfers.length === 1 && y.fromUserId === D.id
  && y.toUserId === E.id && y.amount === 250, books.transfers);
T("잔액도 남은 것 — 라 −250, 마 +250", balanceOf(books, D.id) === -250 && balanceOf(books, E.id) === 250, books.balances);
T("주고받은 기록은 그대로 ¥1,900", books.paid.length === 1 && books.paid[0].amount === 1900, books.paid);

console.log("\n[7] 주고받은 기록 거두기");
const payment = books.paid[0];
const undo = (token, trip, id) => call("DELETE", `/api/trips/${trip}/settlement/payments/${id}`, { token });
r = await undo(D.token, yenTrip, "nothing-here");
T("없는 기록 404", r.status === 404, r.data);
r = await undo(A.token, tripId, payment.id);
T("다른 여행 번호로 부르면 404", r.status === 404, r.data);
r = await undo(A.token, yenTrip, payment.id);
T("그 여행을 못 보는 사람은 거둘 수 없음", r.status === 403 || r.status === 404, r.data);
r = await undo(C.token, tripId, paidB.id);
T("같은 여행의 다른 사람은 403", r.status === 403, r.data);
r = await undo(E.token, yenTrip, payment.id);
T("주고받은 사람이 거둠", r.status === 200, r.data);
books = r.data.books.find((b) => b.currency === "JPY");
y = books.transfers[0];
T("기록이 사라짐", books.paid.length === 0, books.paid);
T("줄이 돌아옴 — 마 → 라 ¥1,650", books.transfers.length === 1 && y.fromUserId === E.id && y.amount === 1650, books.transfers);
r = await undo(D.token, yenTrip, payment.id);
T("이미 거둔 기록 404", r.status === 404, r.data);

/*
  옛 표시 옮기기(V62).

  <p>이주는 서버가 뜰 때 이미 돌았으므로, 양쪽이 다 눌린 옛 표시를 DB 에 직접
  넣고 V62 의 옮기는 두 문장을 그대로 떼어 다시 돌립니다. 문장을 여기 옮겨 적지
  않습니다 — 그러면 이주 파일이 바뀌어도 시험은 옛 문장을 봅니다.
*/
if (process.env.PSQL_DB) {
  console.log("\n[8] 다 눌린 옛 표시 → 주고받은 돈");
  const c = (await booksOf(tripId, "KRW")).transfers.find((x) => x.fromUserId === C.id);
  T("다 → 가 11000", c?.amount === 11000, c);
  sql(`INSERT INTO settle_marks (trip_id, from_id, to_id, currency, amount, sent_at, received_at) `
    + `VALUES ('${tripId}', '${C.id}', '${A.id}', 'KRW', 11000, now() - interval '2 hours', now() - interval '1 hour')`);
  const migration = readFileSync(new URL("../../main/resources/db/migration/V62__settle_payments.sql", import.meta.url), "utf8");
  const between = migration.split("-- [옮기기 시작]")[1].split("-- [옮기기 끝]")[0];
  const moving = between.slice(between.indexOf("\n"))
    .split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
  execSync(`docker exec -i fit-scratch-db psql -U fit -d ${process.env.PSQL_DB} -v ON_ERROR_STOP=1 -q`, { input: moving });
  T("표시 줄은 지워짐", sql(`SELECT count(*) FROM settle_marks WHERE trip_id = '${tripId}' AND from_id = '${C.id}'`) === "0");
  books = await booksOf(tripId, "KRW");
  const moved = books.paid.find((p) => p.fromUserId === C.id);
  T("주고받은 기록으로 옮겨짐", moved?.amount === 11000 && moved.toUserId === A.id, books.paid);
  T("다의 줄이 사라짐", !books.transfers.some((x) => x.fromUserId === C.id), books.transfers);
  T("때는 둘째로 누른 때", Math.abs(new Date(moved.at).getTime() - (Date.now() - 3600_000)) < 600_000, moved);
} else {
  console.log("\n[8] 옛 표시 옮기기는 건너뜀 (PSQL_DB 를 주면 봅니다)");
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
