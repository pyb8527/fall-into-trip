/* 여행 복제와 하루 동선 정리, 알림 켜고 끄기 */
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

console.log("\n[0] 준비");
r = await call("POST", "/api/auth/setup", { body: { email: `admin@local.test`, name: "관리자", password: "trip-test-1234", token: SETUP_TOKEN } });
const host = r.data.accessToken;
T("운영자 준비", !!host, r.data);

r = await call("POST", "/api/auth/register", { body: { email: `mate-${TAG}@local.test`, name: "동행자", password: "mate-test-1234" } });
const mate = r.data.accessToken;
r = await call("POST", "/api/auth/register", { body: { email: `x-${TAG}@local.test`, name: "남", password: "other-test-1234" } });
const stranger = r.data.accessToken;

r = await call("POST", "/api/trips", { token: host, body: { title: "오사카 세 밤", startIso: "2026-11-02", nights: 2 } });
const tripId = r.data.trip.id;
T("여행 준비", !!tripId, r.data);

r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
const days = r.data.days;
T("사흘", days.length === 3, days?.length);

/* 첫날에 갈지자로 넣는다. 북 → 남 → 북 → 남 */
const NORTH_A = { name: "기타 절", lat: 34.7100, lng: 135.5000 };
const SOUTH_A = { name: "미나미 시장", lat: 34.6500, lng: 135.5030 };
const NORTH_B = { name: "기타 카페", lat: 34.7090, lng: 135.5010 };
const SOUTH_B = { name: "미나미 식당", lat: 34.6510, lng: 135.5040 };
for (const p of [NORTH_A, SOUTH_A, NORTH_B, SOUTH_B]) {
  r = await call("POST", "/api/places", { token: host, body: { dayId: days[0].id, ...p } });
}
T("첫날에 네 곳", r.status === 200, r.data);
await call("POST", "/api/places", { token: host, body: { dayId: days[1].id, name: "둘째 날 한 곳", lat: 34.68, lng: 135.50 } });

console.log("\n[1] 동선 정리 — 갈지자를 편다");
r = await call("GET", `/api/places/tidy?dayId=${days[0].id}`, { token: host });
T("제안이 온다", r.status === 200 && r.data.placeIds.length === 4, r.data);
T("짧아진다", r.data.afterMeters < r.data.beforeMeters, { before: r.data.beforeMeters, after: r.data.afterMeters });
T("바꿀 만하다고 한다", r.data.worthIt === true, r.data);

/* 북쪽 둘이 붙고 남쪽 둘이 붙어야 한다. 첫 곳은 그대로 둔다 */
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
const first = r.data.days[0].places;
const idOf = (name) => first.find((p) => p.name === name).id;
r = await call("GET", `/api/places/tidy?dayId=${days[0].id}`, { token: host });
const order = r.data.placeIds;
T("첫 곳은 그대로", order[0] === idOf("기타 절"), order);
T("북쪽끼리 붙는다", order[1] === idOf("기타 카페"), order);

console.log("\n[2] 정리는 저장하지 않는다 — 사람이 정한다");
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
T("순서는 그대로", r.data.days[0].places[1].name === "미나미 시장", r.data.days[0].places.map((p) => p.name));

/* 받아들이면 화면이 reorder 로 저장한다 */
r = await call("POST", "/api/places/reorder", { token: host, body: { dayId: days[0].id, placeIds: order } });
T("받아들이면 저장된다", r.status === 200, r.data);
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
T("바뀐 순서로 온다", r.data.days[0].places[1].name === "기타 카페", r.data.days[0].places.map((p) => p.name));

console.log("\n[3] 시간을 적어 둔 곳은 움직이지 않는다");
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
const pinned = r.data.days[0].places;
/* 남쪽 식당에 저녁 예약을 걸어 둔다. 동선으로는 앞에 와야 하지만 예약이 우선이다 */
await call("PATCH", `/api/places/${pinned[3].id}`, { token: host, body: { time: "19:00", version: pinned[3].version } });
await call("PATCH", `/api/places/${pinned[0].id}`, { token: host, body: { time: "09:00", version: pinned[0].version } });
r = await call("GET", `/api/places/tidy?dayId=${days[0].id}`, { token: host });
const withTime = r.data.placeIds;
T("아침 것이 맨 앞", withTime[0] === pinned[0].id, withTime);
T("저녁 것이 맨 뒤", withTime[withTime.length - 1] === pinned[3].id, withTime);

console.log("\n[4] 남의 여행은 정리해 볼 수 없다");
r = await call("GET", `/api/places/tidy?dayId=${days[0].id}`, { token: stranger });
T("막힌다", r.status === 403 || r.status === 404, r.data);

console.log("\n[5] 여행 복제");
r = await call("POST", `/api/trips/${tripId}/copy`, { token: host, body: { startIso: "2027-03-05" } });
T("만들어진다", r.status === 200 && !!r.data.trip.id, r.data);
const copyId = r.data.trip.id;
T("이름에 사본이 붙는다", r.data.trip.title === "오사카 세 밤 (사본)", r.data.trip.title);

r = await call("GET", `/api/trip?trip=${copyId}`, { token: host });
T("날짜 수가 같다", r.data.days.length === 3, r.data.days?.length);
T("새 날짜로 온다", r.data.days[0].iso === "2027-03-05", r.data.days[0]);
T("간격이 그대로", r.data.days[2].iso === "2027-03-07", r.data.days[2]);
T("장소가 따라온다", r.data.days[0].places.length === 4, r.data.days[0].places?.length);
T("둘째 날도 따라온다", r.data.days[1].places.length === 1, r.data.days[1].places?.length);
T("시간도 따라온다", r.data.days[0].places.some((p) => p.time === "19:00"), r.data.days[0].places);

/* 원본과 사본은 따로 논다 */
r = await call("GET", `/api/trip?trip=${copyId}`, { token: host });
const copyPlace = r.data.days[0].places[0];
await call("PATCH", `/api/places/${copyPlace.id}`, { token: host, body: { name: "사본에서 고침", version: copyPlace.version } });
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
T("원본은 그대로", !r.data.days[0].places.some((p) => p.name === "사본에서 고침"), r.data.days[0].places.map((p) => p.name));

console.log("\n[6] 복제해도 동행자는 따라오지 않는다");
r = await call("POST", `/api/trips/${tripId}/invites`, { token: host, body: { role: "EDITOR" } });
await call("POST", `/api/invites/${r.data.invite.token}/accept`, { token: mate });
r = await call("GET", `/api/trips/${tripId}/members`, { token: host });
T("원본에는 둘", r.data.members.length === 2, r.data.members?.length);

r = await call("POST", `/api/trips/${tripId}/copy`, { token: host, body: { title: "둘이 갔던 길 다시", startIso: "2027-05-01" } });
const secondCopy = r.data.trip.id;
r = await call("GET", `/api/trips/${secondCopy}/members`, { token: host });
T("사본에는 나 혼자", r.data.members.length === 1, r.data.members);
T("이름을 준 대로", (await call("GET", `/api/trip?trip=${secondCopy}`, { token: host })).data.trip.title === "둘이 갔던 길 다시");

console.log("\n[7] 동행자도 자기 것으로 떠 갈 수 있다");
r = await call("POST", `/api/trips/${tripId}/copy`, { token: mate, body: { startIso: "2027-06-01" } });
T("된다", r.status === 200, r.data);
r = await call("GET", `/api/trip?trip=${r.data.trip.id}`, { token: mate });
T("동행자 것이 된다", r.data.myRole === "EDITOR", r.data.myRole);

r = await call("POST", `/api/trips/${tripId}/copy`, { token: stranger, body: { startIso: "2027-06-01" } });
T("남은 못 떠 간다", r.status === 403 || r.status === 404, r.data);

console.log("\n[8] 복제에는 날짜가 있어야 한다");
r = await call("POST", `/api/trips/${tripId}/copy`, { token: host, body: {} });
T("날짜 없으면 거절", r.status === 400, r.data);
r = await call("POST", `/api/trips/${tripId}/copy`, { token: host, body: { startIso: "언젠가" } });
T("이상한 날짜도 거절", r.status === 400, r.data);

console.log("\n[9] 알림");
r = await call("GET", "/api/push/key");
T("공개키는 로그인 없이도", r.status === 200 && typeof r.data.publicKey === "string", r.data);
T("길이가 맞다", r.data.publicKey.length > 80, r.data.publicKey?.length);
const key1 = r.data.publicKey;
r = await call("GET", "/api/push/key");
T("두 번 불러도 같은 열쇠", r.data.publicKey === key1);

r = await call("GET", "/api/push/state", { token: host });
T("처음에는 꺼져 있다", r.data.on === false, r.data);

/* 브라우저가 주는 모양을 흉내 낸다. 실제로 보내 보지는 않는다 —
   중계 서버가 있어야 하는 일이다 */
const FAKE = {
  endpoint: "https://fcm.googleapis.com/fcm/send/" + TAG,
  p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
};
r = await call("POST", "/api/push/subscribe", { token: host, body: FAKE });
T("켜진다", r.status === 200, r.data);
r = await call("GET", "/api/push/state", { token: host });
T("켜진 것으로 보인다", r.data.on === true, r.data);

/* 같은 기기가 다시 와도 쌓이지 않는다 */
await call("POST", "/api/push/subscribe", { token: host, body: FAKE });
r = await call("GET", "/api/push/state", { token: host });
T("두 번 켜도 하나", r.data.on === true, r.data);

r = await call("POST", "/api/push/subscribe", { token: host, body: { endpoint: "", p256dh: "x", auth: "y" } });
T("빈 주소는 거절", r.status === 400, r.data);

r = await call("POST", "/api/push/unsubscribe", { token: mate, body: { endpoint: FAKE.endpoint } });
r = await call("GET", "/api/push/state", { token: host });
T("남이 못 끈다", r.data.on === true, r.data);

r = await call("POST", "/api/push/unsubscribe", { token: host, body: { endpoint: FAKE.endpoint } });
T("꺼진다", r.status === 200, r.data);
r = await call("GET", "/api/push/state", { token: host });
T("꺼진 것으로 보인다", r.data.on === false, r.data);

r = await call("GET", "/api/push/state");
T("로그인 없이는 상태를 못 본다", r.status === 401, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
