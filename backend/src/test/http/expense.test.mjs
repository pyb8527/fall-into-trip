/* 가계부와 정산 — 누가 얼마 냈고 누가 누구에게 주면 되는지 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
const SETUP_TOKEN = process.env.SETUP_TOKEN || "devtoken";
const J = { "content-type": "application/json" };

let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { ...J };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

const TAG = Date.now().toString(36);
let r;

console.log("\n[0] 준비 — 셋이 가는 여행");
r = await call("POST", "/api/auth/setup", { body: { email: "admin@local.test", name: "가", password: "trip-test-1234", token: SETUP_TOKEN } });
const A = r.data.accessToken;
const aId = r.data.user.id;
T("첫 사람", !!A, r.data);

r = await call("POST", "/api/auth/register", { body: { email: `b-${TAG}@local.test`, name: "나", password: "mate-test-1234" } });
const B = r.data.accessToken;
const bId = r.data.user.id;
r = await call("POST", "/api/auth/register", { body: { email: `c-${TAG}@local.test`, name: "다", password: "mate-test-1234" } });
const C = r.data.accessToken;
const cId = r.data.user.id;
r = await call("POST", "/api/auth/register", { body: { email: `x-${TAG}@local.test`, name: "남", password: "other-test-1234" } });
const X = r.data.accessToken;

r = await call("POST", "/api/trips", { token: A, body: { title: "셋이 오사카", startIso: "2026-11-02", nights: 1 } });
const tripId = r.data.trip.id;
for (const who of [B, C]) {
  r = await call("POST", `/api/trips/${tripId}/invites`, { token: A, body: { role: "EDITOR" } });
  await call("POST", `/api/invites/${r.data.invite.token}/accept`, { token: who });
}
r = await call("GET", `/api/trips/${tripId}/members`, { token: A });
T("셋이 됨", r.data.members.length === 3, r.data.members?.length);

r = await call("GET", `/api/trip?trip=${tripId}`, { token: A });
const days = r.data.days;

console.log("\n[1] 적기");
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A,
  body: { name: "첫날 저녁", amount: 9000, currency: "JPY", dayId: days[0].id, cat: "밥" } });
T("적힌다", r.status === 200 && !!r.data.id, r.data);
const dinner = r.data.id;

r = await call("GET", `/api/trips/${tripId}/expenses`, { token: B });
T("동행자도 본다", r.data.expenses.length === 1, r.data.expenses);
T("낸 사람이 적은 사람으로", r.data.expenses[0].payerId === aId, r.data.expenses[0]);
T("이름도 함께 온다", r.data.expenses[0].payerName === "가", r.data.expenses[0]);
T("엔은 소수 자리가 없다", r.data.expenses[0].decimals === 0, r.data.expenses[0]);
T("고를 통화 목록도 온다", Array.isArray(r.data.currencies) && r.data.currencies.includes("KRW"), r.data.currencies);

r = await call("POST", `/api/trips/${tripId}/expenses`, { token: X, body: { name: "남의 것", amount: 100 } });
T("남은 못 적는다", r.status === 403 || r.status === 404, r.data);

console.log("\n[2] 안 적으면 거절");
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A, body: { name: "", amount: 100 } });
T("이름이 없으면 거절", r.status === 400 && /무엇에/.test(r.data.error), r.data);
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A, body: { name: "뭔가" } });
T("금액이 없으면 거절", r.status === 400 && /금액/.test(r.data.error), r.data);
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A, body: { name: "뭔가", amount: -5 } });
T("음수는 거절", r.status === 400, r.data);
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A, body: { name: "뭔가", amount: 100, currency: "달러" } });
T("모르는 통화는 거절", r.status === 400 && /통화/.test(r.data.error), r.data);
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A, body: { name: "뭔가", amount: 100, payerId: "없는사람" } });
T("동행자가 아니면 거절", r.status === 400 && /동행자/.test(r.data.error), r.data);

console.log("\n[3] 셋이 9000엔을 나누면");
/* 가가 9000 을 냈고 셋이 나눈다. 각자 3000. 가는 6000 을 받아야 하고
   나와 다는 3000 씩 낸다 */
r = await call("GET", `/api/trips/${tripId}/settlement`, { token: C });
T("통화 하나", r.data.books.length === 1 && r.data.books[0].currency === "JPY", r.data.books);
const jpy = r.data.books[0];
T("총액이 맞다", jpy.total === 9000, jpy);

const owed = Object.fromEntries(jpy.balances.map((b) => [b.userId, b.balance]));
T("가는 6000 받는다", owed[aId] === 6000, owed);
T("나는 3000 낸다", owed[bId] === -3000, owed);
T("다도 3000 낸다", owed[cId] === -3000, owed);
T("잔액의 합은 0", jpy.balances.reduce((s, b) => s + b.balance, 0) === 0, owed);

T("보낼 곳은 둘", jpy.transfers.length === 2, jpy.transfers);
T("둘 다 가에게로", jpy.transfers.every((t) => t.toUserId === aId), jpy.transfers);
T("보내는 금액의 합이 6000", jpy.transfers.reduce((s, t) => s + t.amount, 0) === 6000, jpy.transfers);
T("이름이 함께 온다", jpy.transfers[0].toName === "가", jpy.transfers[0]);

console.log("\n[4] 나눠 낼 사람을 고르면");
/* 다가 기념품 3000 을 샀는데 그건 다 혼자 것이다 */
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: C,
  body: { name: "혼자 산 기념품", amount: 3000, currency: "JPY", payerId: cId, share: [cId] } });
T("적힌다", r.status === 200, r.data);

r = await call("GET", `/api/trips/${tripId}/settlement`, { token: A });
const after = Object.fromEntries(r.data.books[0].balances.map((b) => [b.userId, b.balance]));
/* 다는 3000 을 내고 3000 을 썼으니 그 건으로는 0. 저녁 몫 -3000 만 남는다 */
T("혼자 쓴 것은 남에게 안 넘어간다", after[cId] === -3000, after);
T("가는 그대로 6000", after[aId] === 6000, after);
T("총액에는 들어간다", r.data.books[0].total === 12000, r.data.books[0].total);

console.log("\n[5] 나누어떨어지지 않을 때");
/* 100엔을 셋이 나누면 34·33·33. 버리지 않고 총액을 지켜야 한다 */
r = await call("POST", `/api/trips/${tripId}/trips`, { token: A });
r = await call("POST", "/api/trips", { token: A, body: { title: "나누기 시험", startIso: "2026-12-01", nights: 0 } });
const oddTrip = r.data.trip.id;
for (const who of [B, C]) {
  r = await call("POST", `/api/trips/${oddTrip}/invites`, { token: A, body: { role: "EDITOR" } });
  await call("POST", `/api/invites/${r.data.invite.token}/accept`, { token: who });
}
await call("POST", `/api/trips/${oddTrip}/expenses`, { token: A,
  body: { name: "100엔", amount: 100, currency: "JPY" } });
r = await call("GET", `/api/trips/${oddTrip}/settlement`, { token: A });
const odd = r.data.books[0];
T("잔액의 합은 여전히 0", odd.balances.reduce((s, b) => s + b.balance, 0) === 0, odd.balances);
/* 34·33·33 으로 쪼개고 남는 1엔은 앞사람이 진다. 여기서 앞사람은 낸
   사람이라, 가는 100 을 내고 34 를 쓴 셈이 되어 66 을 받는다 */
const oddOwed = Object.fromEntries(odd.balances.map((b) => [b.userId, b.balance]));
T("남는 1엔은 앞사람이 진다", oddOwed[aId] === 66, oddOwed);
T("나머지 둘은 33씩", oddOwed[bId] === -33 && oddOwed[cId] === -33, oddOwed);
/* 받을 돈의 합과 보내는 돈의 합이 같아야 1엔도 사라지지 않는다 */
const oddIn = odd.balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
T("1엔도 사라지지 않는다", odd.transfers.reduce((s, t) => s + t.amount, 0) === oddIn, {
  transfers: odd.transfers, oddIn,
});

console.log("\n[6] 통화가 다르면 따로 센다");
await call("POST", `/api/trips/${oddTrip}/expenses`, { token: B,
  body: { name: "공항 환전 수수료", amount: 9000, currency: "KRW", payerId: bId } });
r = await call("GET", `/api/trips/${oddTrip}/settlement`, { token: A });
T("장부가 둘", r.data.books.length === 2, r.data.books.map((b) => b.currency));
const krw = r.data.books.find((b) => b.currency === "KRW");
T("원화 총액", krw.total === 9000, krw);
T("원화도 소수 자리가 없다", krw.decimals === 0, krw);
/* 엔으로 받을 돈과 원으로 낼 돈은 더해지지 않는다 */
const krwOwed = Object.fromEntries(krw.balances.map((b) => [b.userId, b.balance]));
T("원화는 나가 받는다", krwOwed[bId] === 6000, krwOwed);
T("엔화 장부는 그대로", r.data.books.find((b) => b.currency === "JPY").total === 100, r.data.books);

console.log("\n[7] 달러는 센트로 센다");
await call("POST", `/api/trips/${oddTrip}/expenses`, { token: A,
  body: { name: "면세점", amount: 1250, currency: "USD" } });
r = await call("GET", `/api/trips/${oddTrip}/settlement`, { token: A });
const usd = r.data.books.find((b) => b.currency === "USD");
T("달러는 소수 두 자리", usd.decimals === 2, usd);
T("1250 센트 그대로", usd.total === 1250, usd);

console.log("\n[8] 고치고 지우기");
r = await call("GET", `/api/trips/${tripId}/expenses`, { token: A });
const one = r.data.expenses.find((e) => e.id === dinner);
r = await call("PATCH", `/api/expenses/${dinner}`, { token: B,
  body: { amount: 12000, version: one.version } });
T("동행자가 고칠 수 있다", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/settlement`, { token: A });
T("정산이 따라 바뀐다", r.data.books[0].total === 15000, r.data.books[0].total);

r = await call("PATCH", `/api/expenses/${dinner}`, { token: B, body: { amount: 1, version: one.version } });
T("옛 판으로 고치면 막힌다", r.status === 409, r.data);

r = await call("PATCH", `/api/expenses/${dinner}`, { token: X, body: { amount: 1 } });
T("남은 못 고친다", r.status === 403 || r.status === 404, r.data);
r = await call("DELETE", `/api/expenses/${dinner}`, { token: X });
T("남은 못 지운다", r.status === 403 || r.status === 404, r.data);

r = await call("DELETE", `/api/expenses/${dinner}`, { token: C });
T("동행자가 지울 수 있다", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/expenses`, { token: A });
T("사라진다", !r.data.expenses.some((e) => e.id === dinner), r.data.expenses);

console.log("\n[9] 남의 가계부는 안 보인다");
r = await call("GET", `/api/trips/${tripId}/expenses`, { token: X });
T("목록이 막힌다", r.status === 403 || r.status === 404, r.data);
r = await call("GET", `/api/trips/${tripId}/settlement`, { token: X });
T("정산도 막힌다", r.status === 403 || r.status === 404, r.data);
r = await call("GET", `/api/trips/${tripId}/expenses`);
T("로그인 없이는 못 본다", r.status === 401, r.data);

console.log("\n[10] 챙길 것");
r = await call("GET", `/api/trips/${tripId}/items`, { token: A });
T("처음에는 비어 있다", r.data.items.length === 0, r.data.items);

r = await call("POST", `/api/trips/${tripId}/items`, { token: A, body: { name: "여권" } });
T("적힌다", r.status === 200 && !!r.data.id, r.data);
const passport = r.data.id;
await call("POST", `/api/trips/${tripId}/items`, { token: B, body: { name: "어댑터", ownerId: bId } });

r = await call("GET", `/api/trips/${tripId}/items`, { token: C });
T("동행자도 본다", r.data.items.length === 2, r.data.items);
T("맡은 사람 이름이 온다", r.data.items[1].ownerName === "나", r.data.items[1]);
T("안 맡은 것은 비어 있다", !r.data.items[0].ownerId, r.data.items[0]);

r = await call("POST", `/api/trips/${tripId}/items`, { token: A, body: { name: "  " } });
T("빈 이름은 거절", r.status === 400 && /무엇을/.test(r.data.error), r.data);
r = await call("POST", `/api/trips/${tripId}/items`, { token: A, body: { name: "약", ownerId: "없는사람" } });
T("동행자가 아니면 거절", r.status === 400 && /동행자/.test(r.data.error), r.data);
r = await call("POST", `/api/trips/${tripId}/items`, { token: X, body: { name: "남의 것" } });
T("남은 못 적는다", r.status === 403 || r.status === 404, r.data);

/* 체크는 동행자 누구나 한다. 맡은 사람만 체크하게 하면 "내 것 체크 좀 해 줘"
   를 부탁하게 된다 */
r = await call("PATCH", `/api/items/${passport}`, { token: C, body: { done: true } });
T("남이 아닌 동행자는 체크한다", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/items`, { token: A });
T("체크가 남는다", r.data.items[0].done === true, r.data.items[0]);

r = await call("PATCH", `/api/items/${passport}`, { token: B, body: { ownerId: cId } });
r = await call("GET", `/api/trips/${tripId}/items`, { token: A });
T("맡은 사람을 바꾼다", r.data.items[0].ownerName === "다", r.data.items[0]);
r = await call("PATCH", `/api/items/${passport}`, { token: B, body: { ownerId: "" } });
r = await call("GET", `/api/trips/${tripId}/items`, { token: A });
T("빈 값이면 아무도 안 맡은 것으로", !r.data.items[0].ownerId, r.data.items[0]);

r = await call("PATCH", `/api/items/${passport}`, { token: X, body: { done: false } });
T("남은 못 고친다", r.status === 403 || r.status === 404, r.data);
r = await call("DELETE", `/api/items/${passport}`, { token: X });
T("남은 못 지운다", r.status === 403 || r.status === 404, r.data);
r = await call("DELETE", `/api/items/${passport}`, { token: C });
T("동행자가 지운다", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/items`, { token: A });
T("사라진다", r.data.items.length === 1, r.data.items);

r = await call("GET", `/api/trips/${tripId}/items`, { token: X });
T("남은 못 본다", r.status === 403 || r.status === 404, r.data);
r = await call("GET", `/api/trips/${tripId}/items`);
T("로그인 없이는 못 본다", r.status === 401, r.data);


console.log("\n[9] 지출을 장소에 묶는다");
/*
  이 칸은 엔티티부터 응답까지 서버에 다 깔려 있었는데 화면이 한 번도
  안 보냈습니다. 보내기 시작하는 김에 울타리를 세웁니다 — 아무도 안
  보내서 한 번도 확인된 적 없는 자리입니다.
*/
r = await call("POST", "/api/places", { token: A,
  body: { dayId: days[0].id, name: "이치란", lat: 34.6687, lng: 135.5013 } });
const ichiran = r.data.place?.id;
T("장소 준비", !!ichiran, r.data);

r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A,
  body: { name: "라멘", amount: 1200, currency: "JPY", dayId: days[0].id, placeId: ichiran } });
T("장소를 달아 적는다", r.status === 200, r.data);
const ramen = r.data.id;
r = await call("GET", `/api/trips/${tripId}/expenses`, { token: A });
T("응답에 실려 온다", r.data.expenses.find((e) => e.id === ramen)?.placeId === ichiran,
  r.data.expenses.find((e) => e.id === ramen));

/* 남의 여행 장소 번호를 넣어 보내는 자리 */
r = await call("POST", "/api/trips", { token: X, body: { title: "남의 여행", startIso: "2026-12-01", nights: 1 } });
const otherTrip = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${otherTrip}`, { token: X });
r = await call("POST", "/api/places", { token: X,
  body: { dayId: r.data.days[0].id, name: "남의 장소", lat: 35, lng: 139 } });
const otherPlace = r.data.place.id;

r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A,
  body: { name: "엉뚱", amount: 100, currency: "JPY", placeId: otherPlace } });
T("남의 여행 장소는 거절", r.status === 400, r.data);
r = await call("PATCH", `/api/expenses/${ramen}`, { token: A, body: { placeId: otherPlace } });
T("고칠 때도 거절", r.status === 400, r.data);

/* 판 번호를 안 보내면 검사하지 않습니다 — 장소·날짜 쪽과 같은 규칙입니다.
   여기만 인자가 뒤집혀 있어서 안 보내면 500 이 났습니다. */
r = await call("PATCH", `/api/expenses/${ramen}`, { token: A, body: { cat: "먹기" } });
T("판 번호를 생략해도 저장된다", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/expenses`, { token: A });
const edited = r.data.expenses.find((e) => e.id === ramen);
T("고친 것이 남는다", edited?.cat === "먹기", edited);
r = await call("PATCH", `/api/expenses/${ramen}`, { token: A, body: { cat: "밥", version: 999 } });
T("옛 판으로 저장하면 409", r.status === 409, r.data);
r = await call("POST", `/api/trips/${tripId}/expenses`, { token: A,
  body: { name: "없는 장소", amount: 100, currency: "JPY", placeId: "ZZZZZZZZZZZZ" } });
T("없는 장소는 404", r.status === 404, r.data);

/* 장소를 지워도 돈은 남습니다. 지출까지 지우면 정산이 틀리고, 장소를 못
   지우게 막으면 짜는 일이 막힙니다. 화면이 이름을 못 찾으면 그 줄만
   안 적습니다. */
r = await call("DELETE", `/api/places/${ichiran}`, { token: A });
T("장소 삭제", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/expenses`, { token: A });
T("지출은 남는다", !!r.data.expenses.find((e) => e.id === ramen), r.data.expenses);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
