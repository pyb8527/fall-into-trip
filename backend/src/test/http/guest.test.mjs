/* 계정 없이 어디까지 되고 어디서 막히는지 — 문을 열어 둔 만큼만 열려 있는가 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,200) : ""));
async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const stamp = Date.now();
const reg = (who, name) => call("POST", "/api/auth/register",
  { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678" } });

const PLACE = "gplace-guest-" + stamp;

console.log("\n[1] 볼거리를 하나 만들어 둔다");
let r = await reg("host", "길잡이");
const host = r.data.accessToken;
T("글쓴이 가입", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token: host, body: { title: "교토 2박 3일", startIso: "2026-12-01", nights: 2 } });
const tripId = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: host });
const dayId = r.data.days[0].id;
await call("POST", "/api/places", { token: host, body: { dayId, name: "기요미즈데라", lat: 34.9949, lng: 135.7850, placeId: PLACE } });
await call("POST", "/api/places", { token: host, body: { dayId, name: "니시키 시장", lat: 35.0050, lng: 135.7649 } });

r = await call("POST", `/api/trips/${tripId}/publish`, { token: host, body: { summary: "걸어 다닌 사흘", feedback: true } });
T("올라감", r.status === 200 && !!r.data.postId, r.data);
const postId = r.data.postId;

await call("POST", `/api/posts/${postId}/comments`, { token: host, body: { text: "둘째 날은 좀 여유롭게" } });
await call("POST", `/api/places/${PLACE}/tips`, { token: host, body: { text: "아침 일찍 가야 한산합니다" } });

r = await call("POST", "/api/trips/" + tripId + "/invites", { token: host, body: { role: "EDITOR", days: 7 } });
const inviteToken = r.data.invite.token;
T("초대 링크", typeof inviteToken === "string", r.data);

console.log("\n[2] 계정 없이 열리는 것들");
r = await call("GET", "/api/health");
T("살아 있는지", r.status === 200, r.data);
r = await call("GET", "/api/auth/state");
T("설치가 끝난 서버인지", r.status === 200, r.data);
r = await call("GET", "/api/posts");
T("둘러보기 목록", r.status === 200 && r.data.posts.some(p => p.id === postId), r.data.posts?.length);
r = await call("GET", "/api/posts?sort=new&page=0");
T("정렬해서도", r.status === 200, r.data);
r = await call("GET", "/api/posts?q=" + encodeURIComponent("교토"));
T("찾기도", r.status === 200 && r.data.posts.some(p => p.id === postId), r.data.posts?.length);
r = await call("GET", "/api/posts/regions");
T("지역 목록", r.status === 200 && Array.isArray(r.data.regions), r.data);
r = await call("GET", "/api/posts/" + postId);
T("글 하나", r.status === 200 && r.data.title === "교토 2박 3일", r.data);
T("일정이 함께", r.data.itinerary?.days?.[0]?.places?.length === 2, r.data.itinerary?.days?.[0]);
r = await call("GET", `/api/posts/${postId}/comments`);
T("댓글 읽기", r.status === 200 && r.data.comments.length === 1, r.data);
r = await call("GET", `/api/places/${PLACE}/tips`);
T("장소 팁 읽기", r.status === 200 && r.data.tips.length === 1, r.data);
r = await call("GET", "/api/invites/" + inviteToken + "/preview");
T("초대 미리보기", r.status === 200 && r.data.invite.tripTitle === "교토 2박 3일", r.data);
r = await call("GET", "/api/push/key");
T("알림 공개키", r.status === 200, r.data);

/* 동선 그림은 구글에서 받아 옵니다. 키가 없는 판에서는 400 이 맞습니다.
   여기서 보는 것은 "그려지는가" 가 아니라 "로그인 때문에 막히지는
   않는가" 입니다. */
r = await call("GET", `/api/posts/${postId}/map`);
T("동선 그림이 로그인에 막히지 않음", r.status !== 401 && r.status !== 403, r.status);

console.log("\n[3] 계정이 있어야 하는 것들");
for (const [name, method, path, body] of [
  ["추천",        "POST",   `/api/posts/${postId}/like?on=true`, undefined],
  ["가져오기",    "POST",   `/api/posts/${postId}/copy`, { startIso: "2027-01-05" }],
  ["신고",        "POST",   `/api/posts/${postId}/report`, { reason: "" }],
  ["댓글 남기기", "POST",   `/api/posts/${postId}/comments`, { text: "익명으로" }],
  ["팁 남기기",   "POST",   `/api/places/${PLACE}/tips`, { text: "익명으로" }],
  ["초대 수락",   "POST",   `/api/invites/${inviteToken}/accept`, undefined],
  ["내 여행",     "GET",    "/api/trips", undefined],
  ["보석함",      "GET",    "/api/saved", undefined],
  ["폴더",        "GET",    "/api/folders", undefined],
  ["알림 켜기",   "POST",   "/api/push/subscribe", { endpoint: "https://x/y", p256dh: "a", auth: "b" }],
]) {
  r = await call(method, path, { body });
  T(name + " — 막힘", r.status === 401, r.status);
}

/*
  이 둘은 넓은 공개 규칙(/api/posts/*)보다 먼저 걸려 있어야 합니다.
  순서가 뒤바뀌면 누구나 남의 목록을 부를 수 있게 됩니다. 눈으로만
  지키기 어려운 자리라 여기에 못 박아 둡니다.
*/
console.log("\n[4] 공개 규칙에 휩쓸리면 안 되는 자리");
r = await call("GET", "/api/posts/mine");
T("내 글은 막힘", r.status === 401, r.status);
r = await call("GET", "/api/posts/liked");
T("내가 누른 글도 막힘", r.status === 401, r.status);

console.log("\n[5] 게스트에게는 남의 표시가 실리지 않는다");
r = await call("GET", "/api/posts/" + postId);
T("추천 표시가 꺼져 있음", r.data.liked === false, r.data.liked);
T("내 글 표시가 꺼져 있음", r.data.mine === false, r.data.mine);
r = await call("GET", "/api/posts/" + postId, { token: host });
T("글쓴이에게는 내 글로 보임", r.data.mine === true, r.data.mine);

console.log("\n[6] 내려간 글은 게스트에게도 없다");
r = await call("DELETE", "/api/posts/" + postId, { token: host });
T("내림", r.status === 200, r.data);
r = await call("GET", "/api/posts/" + postId);
T("게스트에게 404", r.status === 404, r.status);
r = await call("GET", "/api/posts");
T("목록에서도 사라짐", !r.data.posts.some(p => p.id === postId), r.data.posts?.length);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
