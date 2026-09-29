/* 도장에 사진·별점·한 줄을 남기는 것. 여행기의 재료가 여기서 쌓입니다. */
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

/** 가장 작은 JPEG 하나. 그림이면 되고 무엇이 찍혔는지는 상관없습니다. */
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
  const data = await r.json();
  return data.id;
}

const stamp = Date.now();

console.log("\n[1] 여행 하나와 장소 하나");
let r = await call("POST", "/api/auth/register", {
  body: { email: `mark-${stamp}@test.com`, name: "다니는 사람", password: "pw-12345678" },
});
const me = r.data.accessToken;
T("가입", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token: me, body: { title: "오사카", startIso: "2026-05-01" } });
const tripId = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
const dayId = r.data.days[0].id;
r = await call("POST", "/api/places", {
  token: me, body: { dayId, name: "이치란", lat: 34.66, lng: 135.5 },
});
const placeId = r.data.place.id;
T("장소", r.status === 200, r.data);

console.log("\n[2] 그냥 찍기 — 지금까지 하던 대로");
r = await call("PUT", `/api/visits/${placeId}`, { token: me });
T("본문 없이도 찍힌다", r.status === 200 && r.data.visited === true, r.data);
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
T("다녀온 곳에 든다", r.data.visited.includes(placeId), r.data.visited);
T("남긴 것이 없으면 안 실린다", (r.data.marks ?? []).length === 0, r.data.marks);

console.log("\n[3] 사진과 한 줄을 보탠다");
const photoId = await upload(me);
T("사진 올림", !!photoId, photoId);

r = await call("PUT", `/api/visits/${placeId}`, {
  token: me, body: { photoId, stars: 5, note: "국물이 진해요" },
});
T("보태짐", r.status === 200 && r.data.photoId === photoId, r.data);
T("별점", r.data.stars === 5, r.data);
T("한 줄", r.data.note === "국물이 진해요", r.data);

r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
const mark = (r.data.marks ?? []).find((m) => m.placeId === placeId);
T("여행 상세에 실린다", !!mark, r.data.marks);
T("사진이 실린다", mark?.photoId === photoId, mark);
T("한 줄도 실린다", mark?.note === "국물이 진해요", mark);

console.log("\n[4] 안 보낸 칸은 그대로");
r = await call("PUT", `/api/visits/${placeId}`, { token: me, body: { note: "줄이 길어요" } });
T("한 줄만 바뀐다", r.data.note === "줄이 길어요", r.data);
T("사진은 그대로", r.data.photoId === photoId, r.data);
T("별점도 그대로", r.data.stars === 5, r.data);

console.log("\n[5] 빈 값은 지우기");
r = await call("PUT", `/api/visits/${placeId}`, { token: me, body: { stars: 0, photoId: "" } });
T("별점 지워짐", (r.data.stars ?? null) === null, r.data);
T("사진 떨어짐", (r.data.photoId ?? null) === null, r.data);
T("한 줄은 남음", r.data.note === "줄이 길어요", r.data);

console.log("\n[6] 남의 사진은 못 붙인다");
r = await call("POST", "/api/auth/register", {
  body: { email: `other-${stamp}@test.com`, name: "남", password: "pw-12345678" },
});
const other = r.data.accessToken;
const hers = await upload(other);
r = await call("PUT", `/api/visits/${placeId}`, { token: me, body: { photoId: hers } });
T("거절", r.status === 400, r.data);

console.log("\n[7] 너무 긴 한 줄은 거절");
r = await call("PUT", `/api/visits/${placeId}`, { token: me, body: { note: "가".repeat(201) } });
T("거절", r.status === 400, r.data);

console.log("\n[8] 도장을 빼도 남긴 것은 그대로다");
r = await call("DELETE", `/api/visits/${placeId}`, { token: me });
T("뺐다", r.status === 200, r.data);
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
T("다녀온 곳에서 빠짐", !r.data.visited.includes(placeId), r.data.visited);
/* 도장은 다시 누르면 그만이고 사진은 다시 찍을 수 없습니다. */
T("남긴 것은 남아 있음", (r.data.marks ?? []).some((m) => m.placeId === placeId), r.data.marks);
r = await call("PUT", `/api/visits/${placeId}`, { token: me });
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
T("다시 찍으면 제자리로", r.data.visited.includes(placeId), r.data.visited);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
