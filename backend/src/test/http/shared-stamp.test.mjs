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

console.log("\n[3] 남긴 것은 사람마다, 서로 보인다");
const hostShot = await upload(host);
r = await call("PUT", `/api/visits/${placeId}`, {
  token: host, body: { photoId: hostShot, stars: 5, note: "국물이 진해요" },
});
T("지영이 남김", r.status === 200, r.data);

const mateShot = await upload(mate);
r = await call("PUT", `/api/visits/${placeId}`, {
  token: mate, body: { photoId: mateShot, stars: 3, note: "줄이 길었어요" },
});
T("유정도 남김", r.status === 200, r.data);

r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
const marks = (r.data.marks ?? []).filter((m) => m.placeId === placeId);
T("한 곳에 둘이 붙는다", marks.length === 2, marks);
T("서로 덮어쓰지 않는다",
  marks.some((m) => m.note === "국물이 진해요") && marks.some((m) => m.note === "줄이 길었어요"),
  marks.map((m) => m.note));
T("누가 남겼는지 온다",
  marks.some((m) => m.authorName === "지영") && marks.some((m) => m.authorName === "유정"),
  marks.map((m) => m.authorName));
T("내 것이 무엇인지 안다",
  marks.find((m) => m.authorName === "지영")?.mine === true
  && marks.find((m) => m.authorName === "유정")?.mine === false,
  marks.map((m) => [m.authorName, m.mine]));

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
T("지영이 남긴 것이 남아 있다", left.some((m) => m.note === "국물이 진해요"), left);
T("유정이 남긴 것도 남아 있다", left.some((m) => m.note === "줄이 길었어요"), left);

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

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
