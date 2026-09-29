/* 도장은 여행의 것, 남긴 것은 사람의 것. */
import { Buffer } from "node:buffer";

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

const TINY = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEB" +
  "AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh" +
  "ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ" +
  "WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG" +
  "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z",
  "base64",
);
async function upload(token) {
  const form = new FormData();
  form.append("file", new Blob([TINY], { type: "image/jpeg" }), "a.jpg");
  const r = await fetch(BASE + "/api/photos", {
    method: "POST", headers: { authorization: "Bearer " + token }, body: form,
  });
  return (await r.json()).id;
}

const stamp = Date.now();

console.log("\n[1] 둘이 같이 가는 여행");
let r = await call("POST", "/api/auth/register", {
  body: { email: `host-${stamp}@test.com`, name: "지영", password: "pw-12345678" },
});
const host = r.data.accessToken;
r = await call("POST", "/api/auth/register", {
  body: { email: `mate-${stamp}@test.com`, name: "유정", password: "pw-12345678" },
});
const mate = r.data.accessToken;
T("둘 다 가입", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token: host, body: { title: "같이 가는 여행", startIso: "2026-05-01" } });
const tripId = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
const dayId = r.data.days[0].id;
r = await call("POST", "/api/places", {
  token: host, body: { dayId, name: "이치란", lat: 34.66, lng: 135.5 },
});
const placeId = r.data.place.id;

/* 동행자로 들입니다. */
r = await call("POST", `/api/trips/${tripId}/invites`, { token: host });
const token = r.data.invite?.token ?? r.data.token;
T("초대장", !!token, r.data);
r = await call("POST", `/api/invites/${token}/accept`, { token: mate });
T("동행자로 들어옴", r.status === 200, r.data);

console.log("\n[2] 한 사람이 찍으면 다 같이 찍힌다");
r = await call("PUT", `/api/visits/${placeId}`, { token: host });
T("지영이 찍음", r.status === 200 && r.data.visited === true, r.data);

r = await call("GET", `/api/trip?trip=${tripId}`, { token: mate });
T("유정에게도 찍혀 있다", r.data.visited.includes(placeId), r.data.visited);
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
T("지영에게도 그대로", r.data.visited.includes(placeId), r.data.visited);

console.log("\n[3] 기록도 여행의 것이다 — 한 곳에 하나");
const hostShot = await upload(host);
r = await call("PUT", `/api/visits/${placeId}`, {
  token: host, body: { photoIds: [hostShot], stars: 5, note: "국물이 진해요" },
});
T("지영이 남김", r.status === 200, r.data);

r = await call("GET", `/api/trip?trip=${tripId}`, { token: mate });
T("유정에게도 보인다",
  (r.data.marks ?? []).filter((m) => m.placeId === placeId)[0]?.note === "국물이 진해요",
  r.data.marks);

/*
  동행자가 남의 사진을 그대로 두고 글만 고칩니다.

  이것이 되어야 기록이 여행의 것입니다. 붙일 수 있는 사진을 "내가 올린 것"
  으로만 보면, 이 한 번에 지영이 올린 사진이 통째로 떨어집니다.
*/
r = await call("PUT", `/api/visits/${placeId}`, {
  token: mate, body: { photoIds: [hostShot], note: "줄이 길었어요" },
});
T("유정이 고침", r.status === 200, r.data);
T("남의 사진이 안 떨어진다", r.data.photoIds?.[0] === hostShot, r.data);
T("안 보낸 별점은 그대로", r.data.stars === 5, r.data);

/* 동행자가 제 사진을 보탭니다. */
const mateShot = await upload(mate);
r = await call("PUT", `/api/visits/${placeId}`, {
  token: mate, body: { photoIds: [hostShot, mateShot] },
});
T("둘의 사진이 한 자리에 선다",
  JSON.stringify(r.data.photoIds) === JSON.stringify([hostShot, mateShot]),
  r.data.photoIds);

r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
const marks = (r.data.marks ?? []).filter((m) => m.placeId === placeId);
T("한 곳에 하나로 남는다", marks.length === 1, marks);
T("덮어쓴 것이 보인다", marks[0]?.note === "줄이 길었어요", marks[0]);

/* 남의 사진을 뺄 수도 있어야 합니다 — 멤버면 누구나 고칩니다. */
r = await call("PUT", `/api/visits/${placeId}`, { token: mate, body: { photoIds: [mateShot] } });
T("남의 사진을 뺄 수도 있다",
  JSON.stringify(r.data.photoIds) === JSON.stringify([mateShot]),
  r.data.photoIds);
r = await call("PUT", `/api/visits/${placeId}`, {
  token: host, body: { photoIds: [hostShot, mateShot] },
});
T("되돌려 놓는 것도 된다", r.data.photoIds?.length === 2, r.data.photoIds);

console.log("\n[4] 동행자도 도장을 뺄 수 있다");
/* 찍은 사람만 뺄 수 있게 두면 그 사람이 앱을 안 열면 영영 찍힌 채로 남습니다. */
r = await call("DELETE", `/api/visits/${placeId}`, { token: mate });
T("유정이 뺐다", r.status === 200, r.data);
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
T("지영에게도 빠졌다", !r.data.visited.includes(placeId), r.data.visited);

console.log("\n[5] 도장을 빼도 남긴 것은 그대로다");
/* 손가락이 스쳐 도장이 풀렸다고 그 자리에서 찍은 사진이 사라지면 되돌릴 수
   없습니다. 도장은 다시 누르면 그만이고 사진은 다시 찍을 수 없습니다. */
const left = (r.data.marks ?? []).filter((m) => m.placeId === placeId);
T("남긴 것이 한 덩어리로 남아 있다", left.length === 1, left);
T("글도 사진도 그대로",
  left[0]?.note === "줄이 길었어요" && left[0]?.photoIds?.length === 2, left[0]);

console.log("\n[6] 다시 찍으면 다시 같이 찍힌다");
r = await call("PUT", `/api/visits/${placeId}`, { token: mate });
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
T("둘 다 찍혀 있다", r.data.visited.includes(placeId), r.data.visited);

console.log("\n[7] 남의 여행에는 못 찍는다");
r = await call("POST", "/api/auth/register", {
  body: { email: `stranger-${stamp}@test.com`, name: "남", password: "pw-12345678" },
});
const stranger = r.data.accessToken;
r = await call("PUT", `/api/visits/${placeId}`, { token: stranger });
T("거절", r.status === 403 || r.status === 404, r.status);

console.log("\n[8] 챙겨 둔 사진은 여행기에 안 실린다");
const menu = await upload(host);
r = await call("PUT", `/api/visits/${placeId}/refs`, { token: host, body: { photoIds: [menu] } });
T("챙겨 뒀다", r.status === 200 && r.data.photoIds?.[0] === menu, r.data);

r = await call("GET", `/api/trip?trip=${tripId}`, { token: mate });
const refs = (r.data.refs ?? []).filter((x) => x.placeId === placeId);
T("동행자에게도 보인다", refs[0]?.photoIds?.[0] === menu, r.data.refs);
/* 기록과 섞이면 여행기에 예매 QR 이 실립니다. */
T("기록에는 안 섞인다",
  !((r.data.marks ?? []).find((m) => m.placeId === placeId)?.photoIds ?? []).includes(menu),
  r.data.marks);

r = await call("POST", `/api/trips/${tripId}/publish`, { token: host, body: { title: "같이 간 여행" } });
T("올렸다", r.status === 200, r.data);
r = await call("GET", `/api/posts/${r.data.postId}`);
const shown = r.data.itinerary.days.flatMap((d) => d.places).flatMap((p) => p.photos ?? []);
T("여행기에는 기록만 실린다", !shown.includes(menu) && shown.includes(hostShot), shown);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
