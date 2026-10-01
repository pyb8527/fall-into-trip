/*
  여행기에 피드 글을 같이 싣습니다.

  0단계에서 장소마다 남기던 기록을 걷어 냈고, 그때부터 새로 올린 여행기에는
  사진이 한 장도 안 실렸습니다. 그 자리를 피드 글이 메웁니다.

  두 가지를 봅니다.

  · 내가 쓴, 이 여행의 글만 실립니다 — 모임에서 남이 올린 사진을 공개로
    돌리는 결정은 찍은 사람이 합니다
  · 사본입니다 — 실은 뒤에 그 글을 고치거나 지워도 여행기는 그대로입니다
*/
import { Buffer } from "node:buffer";

const BASE = process.env.BASE || "http://127.0.0.1:8080";
const SETUP_TOKEN = process.env.SETUP_TOKEN || "devtoken";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0, 220) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
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

async function photo(token) {
  const form = new FormData();
  form.append("file", new Blob([TINY], { type: "image/jpeg" }), "a.jpg");
  const r = await fetch(BASE + "/api/photos", {
    method: "POST", headers: { authorization: "Bearer " + token }, body: form,
  });
  return (await r.json()).id;
}

const TAG = Date.now().toString(36);
const reg = (who, name) => call("POST", "/api/auth/register",
  { body: { email: `${who}-${TAG}@local.test`, name, password: "story-test-1234" } });

/** 오늘부터 며칠 뒤. 여행 날짜를 오늘에 걸쳐 두려고 씁니다. */
function isoAfter(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let r;

console.log("\n[1] 준비 — 모임 하나, 그 모임의 여행 하나");
r = await call("POST", "/api/auth/setup",
  { body: { email: "admin@local.test", name: "미나", password: "story-test-1234", token: SETUP_TOKEN } });
const mina = r.data.accessToken;
T("운영자 준비", r.status === 200, r.data);

r = await reg("jun", "준");
const jun = r.data.accessToken;

r = await call("POST", "/api/groups", { token: mina, body: { name: "등산 모임" } });
const groupId = r.data.group.id;
r = await call("POST", `/api/groups/${groupId}/invites`, { token: mina, body: {} });
await call("POST", `/api/group-invites/${r.data.invite.token}/accept`, { token: jun });

/* 오늘이 첫날인 2박 3일. 오늘 올린 글이 1일차에 걸려야 합니다. */
r = await call("POST", "/api/trips", {
  token: mina,
  body: { title: "관악산 종주", startIso: isoAfter(0), nights: 2, groupId },
});
const tripId = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: mina });
const days = r.data.days;
T("사흘짜리", days.length === 3, days.length);
await call("POST", "/api/places", { token: mina, body: { dayId: days[0].id, name: "입구", lat: 37.44, lng: 126.96, time: "09:00" } });
await call("POST", "/api/places", { token: mina, body: { dayId: days[1].id, name: "정상", lat: 37.45, lng: 126.95, time: "11:00" } });
await call("POST", "/api/places", { token: mina, body: { dayId: days[2].id, name: "하산", lat: 37.43, lng: 126.97, time: "15:00" } });

console.log("\n[2] 피드에 몇 편");
const pic1 = await photo(mina);
const pic2 = await photo(mina);
r = await call("POST", "/api/feed", {
  token: mina,
  body: { groupId, tripId, text: "오늘 날씨가 좋았다", tags: ["등산"], photoIds: [pic1, pic2] },
});
const mine1 = r.data.post.id;
T("내 글", r.status === 200, r.data);

r = await call("POST", "/api/feed", { token: mina, body: { groupId, tripId, text: "정상에서" } });
const mine2 = r.data.post.id;

r = await call("POST", "/api/feed", { token: jun, body: { groupId, tripId, text: "준이 찍은 것" } });
const his = r.data.post.id;
T("남의 글", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token: mina, body: { title: "딴 여행", startIso: "2027-05-01", nights: 0 } });
const otherTrip = r.data.trip.id;
r = await call("POST", "/api/feed", { token: mina, body: { tripId: otherTrip, text: "딴 여행 이야기" } });
const elsewhere = r.data.post.id;

console.log("\n[3] 아무 글이나 실을 수는 없다");
const publish = (body) => call("POST", `/api/trips/${tripId}/publish`, { token: mina, body });

r = await publish({ summary: "남의 것", storyIds: [his] });
T("남이 쓴 글은 거부", r.status === 400 && /내가 쓴/.test(r.data.error), r.data);
r = await publish({ summary: "딴 여행", storyIds: [elsewhere] });
T("다른 여행의 글은 거부", r.status === 400 && /이 여행/.test(r.data.error), r.data);
r = await publish({ summary: "없는 글", storyIds: ["없는글번호"] });
T("없는 글은 거부", r.status === 400, r.data);

console.log("\n[4] 내 글만 싣는다");
r = await publish({ summary: "사흘 걸은 기록", feedback: true, storyIds: [mine1, mine2] });
T("올라감", r.status === 200, r.data);
const postId = r.data.postId;

r = await call("GET", "/api/posts/" + postId);
T("여행기가 열림", r.status === 200, r.data);
const stories = r.data.itinerary?.stories ?? [];
T("두 편이 실림", stories.length === 2, stories);
T("글이 그대로", stories.some((s) => s.text === "오늘 날씨가 좋았다"), stories);
T("사진도 함께", stories.find((s) => s.text === "오늘 날씨가 좋았다")?.photos.length === 2, stories);
T("태그도 함께", stories.find((s) => s.text === "오늘 날씨가 좋았다")?.tags[0] === "등산", stories);
T("누가 썼는지", stories[0].author === "미나", stories[0]);
T("오늘 올렸으니 1일차에 걸림", stories.every((s) => s.dayIndex === 0), stories.map((s) => s.dayIndex));
T("올린 차례대로", stories[0].text === "오늘 날씨가 좋았다", stories.map((s) => s.text));

console.log("\n[5] 사본이다 — 글을 고쳐도 여행기는 그대로");
r = await call("PATCH", `/api/feed/${mine1}`, { token: mina, body: { text: "나중에 고친 말" } });
T("피드 글을 고침", r.status === 200, r.data);
r = await call("GET", "/api/posts/" + postId);
T("여행기는 그때 그대로", r.data.itinerary.stories.some((s) => s.text === "오늘 날씨가 좋았다"), r.data.itinerary.stories);

r = await call("DELETE", `/api/feed/${mine2}`, { token: mina });
T("피드 글을 지움", r.status === 200, r.data);
r = await call("GET", "/api/posts/" + postId);
T("지워도 여행기에는 남음", r.data.itinerary.stories.length === 2, r.data.itinerary.stories);

console.log("\n[6] 안 고르면 안 실린다 — 지금까지의 동작");
r = await publish({ summary: "일정만" });
T("글 없이 올라감", r.status === 200, r.data);
r = await call("GET", "/api/posts/" + r.data.postId);
T("stories 가 비어 있음", (r.data.itinerary.stories ?? []).length === 0, r.data.itinerary.stories);

console.log("\n[7] 날을 빼면 끼워 둔 글이 따라 움직인다");
r = await publish({ summary: "날 옮기기 시험", storyIds: [mine1] });
const shifting = r.data.postId;
r = await call("GET", "/api/posts/" + shifting);
T("1일차에 걸려 있음", r.data.itinerary.stories[0].dayIndex === 0, r.data.itinerary.stories);

/* 2일차의 마지막 장소를 빼면 그 날이 통째로 없어집니다. 1일차 뒤의 글은
   그대로 1일차여야 합니다. */
r = await call("DELETE", `/api/posts/${shifting}/days/1/places/0`, { token: mina });
T("2일차를 뺌", r.status === 200, r.data);
r = await call("GET", "/api/posts/" + shifting);
T("1일차 글은 그대로 1일차", r.data.itinerary.stories[0].dayIndex === 0, r.data.itinerary.stories);
T("날은 둘이 됨", r.data.itinerary.days.length === 2, r.data.itinerary.days.length);

/* 이번에는 그 글이 붙어 있던 1일차를 뺍니다. 글은 안 지우고 일정 뒤로
   내립니다 — 장소 하나 빼는 일에 올린 사진이 통째로 사라지면 안 됩니다. */
r = await call("DELETE", `/api/posts/${shifting}/days/0/places/0`, { token: mina });
T("1일차를 뺌", r.status === 200, r.data);
r = await call("GET", "/api/posts/" + shifting);
T("글은 남고 일정 뒤로 내려감", r.data.itinerary.stories.length === 1
  && r.data.itinerary.stories[0].dayIndex == null, r.data.itinerary.stories);

console.log("\n[8] 한도");
r = await publish({ summary: "너무 많이", storyIds: Array.from({ length: 21 }, (_, i) => "x" + i) });
T("스무 편까지", r.status === 400 && /20편/.test(r.data.error), r.data);

console.log("\n[9] 가져가기는 일정만 가져간다");
r = await call("POST", `/api/posts/${postId}/copy`, { token: jun, body: { startIso: "2027-07-01" } });
T("남이 가져감", r.status === 200, r.data);
const copied = r.data.tripId;
r = await call("GET", "/api/trip?trip=" + copied, { token: jun });
T("일정은 따라옴", r.data.days.length === 3, r.data.days?.length);
r = await call("GET", `/api/feed?trip=${copied}`, { token: jun });
T("남의 이야기는 안 따라옴", r.data.posts.length === 0, r.data.posts);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
