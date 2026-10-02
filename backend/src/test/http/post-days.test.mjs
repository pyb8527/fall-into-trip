/* 날짜를 골라 올리고, 날짜를 골라 가져오는지 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
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
console.log("\n[1] 사흘짜리 여행 하나");
let r = await call("POST", "/api/auth/register", {
  body: { email: `days-${stamp}@test.com`, name: "짜는 사람", password: "pw-12345678" },
});
const author = r.data.accessToken;
T("가입", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token: author, body: { title: "오사카 사흘", startIso: "2026-05-01" } });
const tripId = r.data.trip.id;

/* 날을 셋으로 늘립니다. */
for (let i = 0; i < 2; i++) {
  await call("POST", "/api/days", { token: author, body: { tripId } });
}
r = await call("GET", `/api/trip?trip=${tripId}`, { token: author });
const dayIds = r.data.days.map((d) => d.id);
T("사흘이 됨", dayIds.length === 3, r.data.days.length);

/* 날마다 이름이 다른 장소 하나씩. 어느 날이 왔는지 이름으로 봅니다. */
const mark = ["첫날곳", "둘째날곳", "셋째날곳"];
for (let i = 0; i < 3; i++) {
  await call("POST", "/api/places", {
    token: author, body: { dayId: dayIds[i], name: mark[i], lat: 34.7 + i / 100, lng: 135.5 },
  });
}

console.log("\n[2] 둘째 날만 올린다");
r = await call("POST", `/api/trips/${tripId}/publish`, {
  token: author, body: { title: "둘째 날만", days: [dayIds[1]] },
});
T("올라감", r.status === 200 && !!r.data.postId, r.data);
const onlyOne = r.data.postId;

r = await call("GET", `/api/posts/${onlyOne}`);
T("하루짜리로 실림", r.data.dayCount === 1, { dayCount: r.data.dayCount });
let names = r.data.itinerary.days.flatMap((d) => d.places.map((p) => p.name));
T("고른 날의 곳만", names.join(",") === "둘째날곳", names);

console.log("\n[3] 안 고르면 전부");
r = await call("POST", `/api/trips/${tripId}/publish`, { token: author, body: { title: "사흘 전부" } });
const whole = r.data.postId;
r = await call("GET", `/api/posts/${whole}`);
T("사흘 그대로", r.data.dayCount === 3, { dayCount: r.data.dayCount });

console.log("\n[4] 모르는 날을 고르면 거절한다");
r = await call("POST", `/api/trips/${tripId}/publish`, {
  token: author, body: { title: "없는 날", days: ["없는아이디"] },
});
T("못 올림", r.status === 400, r.data);

console.log("\n[5] 남의 글에서 하루만 가져온다");
r = await call("POST", "/api/auth/register", {
  body: { email: `taker-${stamp}@test.com`, name: "가져가는 사람", password: "pw-12345678" },
});
const taker = r.data.accessToken;

r = await call("POST", `/api/posts/${whole}/copy`, {
  token: taker, body: { startIso: "2026-07-01", days: [0, 2] },
});
T("가져옴", r.status === 200 && !!r.data.tripId, r.data);
const mineTrip = r.data.tripId;

r = await call("GET", `/api/trip?trip=${mineTrip}`, { token: taker });
T("이틀만 왔다", r.data.days.length === 2, r.data.days.length);
names = r.data.days.flatMap((d) => d.places.map((p) => p.name));
T("고른 날들의 곳만", names.join(",") === "첫날곳,셋째날곳", names);
T("번호는 다시 첫날부터", r.data.days.map((d) => d.label).join(",") === "1일차,2일차",
  r.data.days.map((d) => d.label));

r = await call("POST", `/api/posts/${whole}/copy`, { token: taker, body: { startIso: "2026-08-01" } });
r = await call("GET", `/api/trip?trip=${r.data.tripId}`, { token: taker });
T("안 고르면 전부 온다", r.data.days.length === 3, r.data.days.length);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
