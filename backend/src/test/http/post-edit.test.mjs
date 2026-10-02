/* 올린 글을 고치고, 가운데 장소를 빼는 것 — 그리고 댓글이 따라 움직이는지 */
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

console.log("\n[1] 사흘짜리 여행, 날마다 곳 둘씩");
let r = await call("POST", "/api/auth/register", {
  body: { email: `edit-${stamp}@test.com`, name: "짜는 사람", password: "pw-12345678" },
});
const author = r.data.accessToken;
T("가입", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token: author, body: { title: "고쳐 볼 여행", startIso: "2026-05-01" } });
const tripId = r.data.trip.id;
for (let i = 0; i < 2; i++) await call("POST", "/api/days", { token: author, body: { tripId } });
r = await call("GET", `/api/trip?trip=${tripId}`, { token: author });
const dayIds = r.data.days.map((d) => d.id);
T("사흘", dayIds.length === 3, r.data.days.length);

for (let i = 0; i < 3; i++) {
  for (const which of ["앞", "뒤"]) {
    await call("POST", "/api/places", {
      token: author,
      body: { dayId: dayIds[i], name: `${i + 1}일차${which}`, lat: 34.7 + i / 100, lng: 135.5 },
    });
  }
}

console.log("\n[2] 3일차만 올리면 보는 사람에게는 1일차");
r = await call("POST", `/api/trips/${tripId}/publish`, {
  token: author, body: { title: "셋째 날만", days: [dayIds[2]] },
});
const lone = r.data.postId;
T("올라감", r.status === 200 && !!lone, r.data);
r = await call("GET", `/api/posts/${lone}`);
T("1일차로 보인다", r.data.itinerary.days[0].label === "1일차", r.data.itinerary.days[0].label);
T("색도 첫째 날 색", r.data.itinerary.days[0].color === "#3b82f6", r.data.itinerary.days[0].color);
T("곳은 3일차 것", r.data.itinerary.days[0].places[0].name === "3일차앞",
  r.data.itinerary.days[0].places.map((p) => p.name));

console.log("\n[3] 골라 가져와도 번호와 색이 맞는다");
r = await call("POST", "/api/auth/register", {
  body: { email: `taker-e-${stamp}@test.com`, name: "가져가는 사람", password: "pw-12345678" },
});
const taker = r.data.accessToken;
r = await call("POST", `/api/trips/${tripId}/publish`, { token: author, body: { title: "사흘 전부" } });
const whole = r.data.postId;
r = await call("POST", `/api/posts/${whole}/copy`, { token: taker, body: { startIso: "2026-07-01", days: [2] } });
r = await call("GET", `/api/trip?trip=${r.data.tripId}`, { token: taker });
T("가져온 것은 1일차", r.data.days[0].label === "1일차", r.data.days[0].label);
T("가져온 것의 색도 첫째", r.data.days[0].color === "#3b82f6", r.data.days[0].color);

console.log("\n[4] 겉을 고친다");
r = await call("PATCH", `/api/posts/${whole}`, {
  token: author,
  /* 조언 받기를 켜는 것도 고치기로 합니다 — 올릴 때 안 받겠다고 했다가
     마음이 바뀌는 일이 있습니다. 아래 [8] 의 댓글이 이것에 걸립니다. */
  body: { title: "이름 바꿈", summary: "소개도 붙임", tags: ["온천", "#온천", "아이랑"], feedback: true },
});
T("고쳐짐", r.status === 200, r.data);
r = await call("GET", `/api/posts/${whole}`);
T("새 제목", r.data.title === "이름 바꿈", r.data.title);
T("조언 받기가 켜졌다", r.data.feedback === true, r.data.feedback);
T("새 소개", r.data.summary === "소개도 붙임", r.data.summary);
T("태그는 겹친 것을 하나로", r.data.tags.length === 2 && r.data.tags.includes("온천"), r.data.tags);

r = await call("POST", `/api/posts/${whole}/copy`, { token: taker, body: { startIso: "2026-09-01" } });
r = await call("GET", `/api/trip?trip=${r.data.tripId}`, { token: taker });
T("가져간 여행 이름도 새 제목", r.data.trip.title === "이름 바꿈", r.data.trip.title);

console.log("\n[5] 안 보낸 칸은 그대로");
r = await call("PATCH", `/api/posts/${whole}`, { token: author, body: { summary: "소개만 고침" } });
r = await call("GET", `/api/posts/${whole}`);
T("제목은 그대로", r.data.title === "이름 바꿈", r.data.title);
T("태그도 그대로", r.data.tags.length === 2, r.data.tags);

console.log("\n[6] 찾기 칸으로 태그를 찾는다");
r = await call("GET", `/api/posts?q=${encodeURIComponent("아이랑")}`);
T("태그로 찾힌다", r.data.posts.some((p) => p.id === whole), r.data.posts.map((p) => p.title));

console.log("\n[7] 남의 글은 못 고친다");
r = await call("PATCH", `/api/posts/${whole}`, { token: taker, body: { title: "가로채기" } });
T("거절", r.status === 403, r.data);
r = await call("DELETE", `/api/posts/${whole}/days/0/places/0`, { token: taker });
T("빼기도 거절", r.status === 403, r.data);

console.log("\n[8] 가운데 곳을 빼면 댓글이 따라 움직인다");
r = await call("POST", `/api/posts/${whole}/comments`, {
  token: taker, body: { text: "앞집에 달린 말", dayIndex: 0, placeIndex: 0 },
});
T("댓글 하나", r.status === 200, r.data);
await call("POST", `/api/posts/${whole}/comments`, {
  token: taker, body: { text: "뒷집에 달린 말", dayIndex: 0, placeIndex: 1 },
});
await call("POST", `/api/posts/${whole}/comments`, {
  token: taker, body: { text: "2일차 앞집", dayIndex: 1, placeIndex: 0 },
});
r = await call("GET", `/api/posts/${whole}/comments`);
T("셋 달렸다", r.data.comments.length === 3, r.data.comments.length);

r = await call("DELETE", `/api/posts/${whole}/days/0/places/0`, { token: author });
T("뺐다", r.status === 200, r.data);
T("곳이 하나 줄었다", r.data.placeCount === 5, r.data);
T("날은 그대로", r.data.dayCount === 3, r.data);

r = await call("GET", `/api/posts/${whole}`);
T("1일차에 뒷집만", r.data.itinerary.days[0].places.map((p) => p.name).join(",") === "1일차뒤",
  r.data.itinerary.days[0].places.map((p) => p.name));

r = await call("GET", `/api/posts/${whole}/comments`);
let texts = r.data.comments.map((c) => `${c.text}@${c.dayIndex}:${c.placeIndex}`);
T("빠진 곳의 댓글은 사라졌다", !texts.some((t) => t.startsWith("앞집에 달린 말")), texts);
T("뒷집 댓글이 0번으로 당겨졌다", texts.includes("뒷집에 달린 말@0:0"), texts);
T("2일차 댓글은 그대로", texts.includes("2일차 앞집@1:0"), texts);

console.log("\n[9] 마지막 곳을 빼면 그 날이 없어지고 뒤가 당겨진다");
r = await call("DELETE", `/api/posts/${whole}/days/0/places/0`, { token: author });
T("뺐다", r.status === 200, r.data);
T("날이 둘로", r.data.dayCount === 2, r.data);
r = await call("GET", `/api/posts/${whole}`);
T("첫날이 옛 2일차", r.data.itinerary.days[0].places[0].name === "2일차앞",
  r.data.itinerary.days[0].places.map((p) => p.name));
T("번호를 다시 셌다", r.data.itinerary.days.map((d) => d.label).join(",") === "1일차,2일차",
  r.data.itinerary.days.map((d) => d.label));
T("색도 다시 셌다", r.data.itinerary.days[0].color === "#3b82f6", r.data.itinerary.days[0].color);

r = await call("GET", `/api/posts/${whole}/comments`);
texts = r.data.comments.map((c) => `${c.text}@${c.dayIndex}:${c.placeIndex}`);
T("없어진 날의 댓글은 사라졌다", !texts.some((t) => t.startsWith("뒷집에 달린 말")), texts);
T("뒤에 있던 댓글이 한 날 당겨졌다", texts.includes("2일차 앞집@0:0"), texts);

console.log("\n[10] 없는 자리는 못 뺀다");
r = await call("DELETE", `/api/posts/${whole}/days/9/places/0`, { token: author });
T("없는 날", r.status === 404, r.data);
r = await call("DELETE", `/api/posts/${whole}/days/0/places/9`, { token: author });
T("없는 곳", r.status === 404, r.data);

console.log("\n[11] 마지막 장소는 못 뺀다");
r = await call("POST", "/api/trips", { token: author, body: { title: "한 곳뿐", startIso: "2026-06-01" } });
const tiny = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${tiny}`, { token: author });
await call("POST", "/api/places", {
  token: author, body: { dayId: r.data.days[0].id, name: "하나", lat: 35.6, lng: 139.7 },
});
r = await call("POST", `/api/trips/${tiny}/publish`, { token: author, body: { title: "곳 하나" } });
const onePlace = r.data.postId;
r = await call("DELETE", `/api/posts/${onePlace}/days/0/places/0`, { token: author });
T("거절", r.status === 400, r.data);
r = await call("GET", `/api/posts/${onePlace}`);
T("그대로 남아 있다", r.data.placeCount === 1, r.data.placeCount);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
