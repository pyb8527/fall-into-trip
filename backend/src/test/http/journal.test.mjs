/* 여행기 — 글에 표지·공개 범위·도장의 자취가 붙는지, 그리고 안 새는지. */
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

console.log("\n[1] 다녀온 여행 하나");
let r = await call("POST", "/api/auth/register", {
  body: { email: `j-${stamp}@test.com`, name: "쓰는 사람", password: "pw-12345678" },
});
const me = r.data.accessToken;
T("가입", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token: me, body: { title: "히로시마", startIso: "2026-04-01" } });
const tripId = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
const dayId = r.data.days[0].id;
r = await call("POST", "/api/places", {
  token: me, body: { dayId, name: "오노미치 라멘", lat: 34.4, lng: 132.4 },
});
const placeId = r.data.place.id;

console.log("\n[2] 다니면서 볼 사진을 챙겨 둔다");
const shot = await upload(me);
r = await call("PUT", `/api/visits/${placeId}/refs`, { token: me, body: { photoIds: [shot] } });
T("챙겨 뒀다", r.status === 200 && r.data.photoIds?.[0] === shot, r.data);

console.log("\n[3] 올리면 일정이 따라간다");
const cover = await upload(me);
r = await call("POST", `/api/trips/${tripId}/publish`, {
  token: me, body: { title: "히로시마 이틀", coverPhotoId: cover },
});
const postId = r.data.postId;
T("올라감", r.status === 200 && !!postId, r.data);

r = await call("GET", `/api/posts/${postId}`);
T("표지가 실린다", r.data.coverPhotoId === cover, r.data.coverPhotoId);
T("안 정하면 둘러보기", r.data.visibility === "LISTED", r.data.visibility);
let place = r.data.itinerary.days[0].places[0];
T("장소 이름이 따라갔다", place.name === "오노미치 라멘", place);
/*
  챙겨 둔 사진은 사본에 안 담깁니다.

  <p>메뉴판과 예매 화면은 다니려고 넣어 둔 것이지 남에게 보이려고 넣은 것이
  아닙니다. 담으면 남의 여행기에 내 예매 QR 이 실립니다.
*/
T("챙겨 둔 사진은 안 따라간다", (place.photos ?? []).length === 0, place);

console.log("\n[4] 남의 사진은 표지로 못 쓴다");
r = await call("POST", "/api/auth/register", {
  body: { email: `other-${stamp}@test.com`, name: "남", password: "pw-12345678" },
});
const other = r.data.accessToken;
const hers = await upload(other);
r = await call("PATCH", `/api/posts/${postId}`, { token: me, body: { coverPhotoId: hers } });
T("거절", r.status === 400, r.data);

console.log("\n[5] 모르는 공개 범위는 거절한다");
/* 조용히 기본값으로 두면 "나만 보기" 로 올리려던 글이 둘러보기에 뜹니다. */
r = await call("PATCH", `/api/posts/${postId}`, { token: me, body: { visibility: "EVERYONE" } });
T("거절", r.status === 400, r.data);

console.log("\n[6] 주소를 아는 사람만");
r = await call("PATCH", `/api/posts/${postId}`, { token: me, body: { visibility: "LINK" } });
T("바뀜", r.status === 200, r.data);
r = await call("GET", `/api/posts/${postId}`);
T("주소로는 열린다", r.status === 200 && r.data.visibility === "LINK", r.data.visibility);
r = await call("GET", "/api/posts");
T("목록에는 없다", !r.data.posts.some((p) => p.id === postId), r.data.posts.map((p) => p.id));
r = await call("GET", `/api/posts?q=${encodeURIComponent("히로시마")}`);
T("찾아도 없다", !r.data.posts.some((p) => p.id === postId), r.data.posts.length);

console.log("\n[7] 나만");
r = await call("PATCH", `/api/posts/${postId}`, { token: me, body: { visibility: "PRIVATE" } });
T("바뀜", r.status === 200, r.data);
r = await call("GET", `/api/posts/${postId}`, { token: me });
T("나는 열린다", r.status === 200, r.status);
r = await call("GET", `/api/posts/${postId}`, { token: other });
T("남에게는 없다고 한다", r.status === 404, r.status);
r = await call("GET", `/api/posts/${postId}`);
T("로그인 없이도 없다", r.status === 404, r.status);

console.log("\n[8] 나만 보는 글은 가져갈 수도 없다");
r = await call("POST", `/api/posts/${postId}/copy`, { token: other, body: { startIso: "2026-08-01" } });
T("복제 거절", r.status === 404, r.status);
r = await call("POST", `/api/posts/${postId}/like?on=true`, { token: other });
T("추천 거절", r.status === 404, r.status);
const card = await fetch(`${BASE}/api/posts/${postId}/card`);
T("카드도 없다", card.status === 404, card.status);

console.log("\n[9] 다시 열면 그대로 돌아온다");
r = await call("PATCH", `/api/posts/${postId}`, { token: me, body: { visibility: "LISTED" } });
r = await call("GET", "/api/posts");
T("목록에 다시 뜬다", r.data.posts.some((p) => p.id === postId), r.data.posts.map((p) => p.id));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
