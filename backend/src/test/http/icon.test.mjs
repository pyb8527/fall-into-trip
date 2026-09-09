/* 핀 그림과 사이사이 이동 비교 */
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

console.log("\n[1] 준비");
let r = await reg("owner", "주인");
const me = r.data.accessToken;
r = await reg("other", "남");
const stranger = r.data.accessToken;
T("가입", !!me && !!stranger);

r = await call("POST", "/api/trips", { token: me, body: { title: "오사카", startIso: "2027-04-01", nights: 1 } });
const tripId = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
const dayId = r.data.days[0].id;
T("날짜가 생김", !!dayId, r.data.days?.length);

console.log("\n[2] 그림을 달고 넣기");
r = await call("POST", "/api/places", { token: me,
  body: { dayId, name: "이치란", lat: 34.6687, lng: 135.5013, icon: "ramen" } });
T("넣힘", r.status === 200, r.data);
T("그림이 그대로", r.data.place.icon === "ramen", r.data.place);
const ramenId = r.data.place.id;

r = await call("POST", "/api/places", { token: me,
  body: { dayId, name: "수상한 곳", lat: 34.6, lng: 135.5, icon: "'; DROP TABLE places; --" } });
T("모르는 이름은 비움", r.data.place.icon == null, r.data.place);
const oddId = r.data.place.id;

r = await call("POST", "/api/places", { token: me,
  body: { dayId, name: "그림 없음", lat: 34.7, lng: 135.6 } });
T("안 주면 비어 있음", r.data.place.icon == null, r.data.place);

console.log("\n[3] 그림 바꾸기와 빼기");
r = await call("PATCH", `/api/places/${ramenId}`, { token: me, body: { icon: "sushi" } });
T("바뀜", r.data.place.icon === "sushi", r.data.place);
r = await call("PATCH", `/api/places/${ramenId}`, { token: me, body: { icon: "" } });
T("빈 문자열이면 빠짐", r.data.place.icon == null, r.data.place);
r = await call("PATCH", `/api/places/${ramenId}`, { token: me, body: { icon: "onsen" } });
r = await call("PATCH", `/api/places/${ramenId}`, { token: me, body: { note: "메모만" } });
T("안 보내면 손대지 않음", r.data.place.icon === "onsen", r.data.place);

console.log("\n[4] 일정에 그대로 실려 옴");
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
const found = r.data.days[0].places.find(p => p.id === ramenId);
T("조회에도 나옴", found?.icon === "onsen", found);

console.log("\n[5] 보관함을 거쳐도 따라감");
r = await call("POST", "/api/saved", { token: me,
  body: { name: "구라시키 목욕탕", lat: 34.59, lng: 133.77, icon: "onsen" } });
T("담을 때 붙음", r.data.place.icon === "onsen", r.data.place);
const savedId = r.data.place.id;
r = await call("GET", "/api/saved", { token: me });
T("보관함 목록에도 나옴", r.data.places[0].icon === "onsen", r.data.places?.[0]);

r = await call("POST", `/api/days/${dayId}/places/from-saved`, { token: me, body: { savedIds: [savedId] } });
T("일정에 넣힘", r.status === 200, r.data);
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
const poured = r.data.days[0].places.find(p => p.name === "구라시키 목욕탕");
T("그림이 딸려 옴", poured?.icon === "onsen", poured);

console.log("\n[6] 가고 싶은 곳을 거쳐도 따라감");
r = await call("POST", `/api/trips/${tripId}/candidates`, { token: me,
  body: { name: "야키니쿠", lat: 34.7, lng: 135.5, icon: "meat" } });
T("후보에 붙음", r.status === 200, r.data);
r = await call("GET", `/api/trips/${tripId}/candidates`, { token: me });
const cand = r.data.candidates.find(c => c.name === "야키니쿠");
T("후보 목록에 나옴", cand?.icon === "meat", cand);

console.log("\n[7] 게시판 사본에도 담김");
r = await call("POST", `/api/trips/${tripId}/publish`, { token: me,
  body: { title: "오사카 1박", summary: "", region: "일본", feedback: false } });
const postId = r.data.postId;
T("올림", r.status === 200, r.data);
r = await call("GET", `/api/posts/${postId}`);
const snapPlace = r.data.itinerary.days[0].places.find(p => p.name === "구라시키 목욕탕");
T("사본에 그림이 있음", snapPlace?.icon === "onsen", snapPlace);

r = await call("POST", `/api/posts/${postId}/copy`, { token: stranger, body: { startIso: "2027-06-01" } });
const copied = r.data.tripId;
T("남이 가져감", r.status === 200, r.data);
r = await call("GET", `/api/trip?trip=${copied}`, { token: stranger });
const copiedPlace = r.data.days[0].places.find(p => p.name === "구라시키 목욕탕");
T("가져간 것에도 그림이 있음", copiedPlace?.icon === "onsen", copiedPlace);

console.log("\n[8] 사이사이 이동 비교");
r = await call("GET", `/api/days/${dayId}/route/compare`, { token: stranger });
T("남은 못 봄", r.status === 403 || r.status === 404, r.data);
r = await call("GET", `/api/days/${dayId}/route/compare`, { token: me });
/* 이 확인용 서버에는 구글 키가 없습니다. 키가 없으면 400 으로 잘라 내고,
   있으면 구간 목록을 돌려줘야 합니다. 어느 쪽이든 500 이면 안 됩니다. */
T("키가 없으면 꺼져 있다고 알림", r.status === 400 || (r.status === 200 && Array.isArray(r.data.gaps)), { status: r.status, data: r.data });
r = await call("GET", "/api/days/없는날/route/compare", { token: me });
T("없는 날짜는 404", r.status === 404, r.data);

console.log("\n[9] 지운 뒤에도 나머지는 멀쩡");
r = await call("DELETE", `/api/places/${oddId}`, { token: me });
T("지움", r.status === 200, r.data);
r = await call("GET", `/api/trip?trip=${tripId}`, { token: me });
T("나머지 그림 유지", r.data.days[0].places.some(p => p.icon === "onsen"), r.data.days?.[0]?.places);


console.log("\n[10] 담아 둔 곳의 그림 바꾸기");
r = await call("POST", "/api/saved", { token: me, body: { name: "이름표 시험", lat: 34.1, lng: 135.1 } });
const tagId = r.data.place.id;
T("그림 없이 담김", r.data.place.icon == null, r.data.place);
r = await call("PATCH", `/api/saved/${tagId}`, { token: me, body: { icon: "cafe" } });
T("바꿈", r.data.place.icon === "cafe", r.data.place);
r = await call("PATCH", `/api/saved/${tagId}`, { token: me, body: { icon: "없는것" } });
T("모르는 이름은 비움", r.data.place.icon == null, r.data.place);
r = await call("PATCH", `/api/saved/${tagId}`, { token: stranger, body: { icon: "cafe" } });
T("남의 것은 못 바꿈", r.status === 404, r.data);

console.log("\n[11] 내가 누른 글");
r = await call("GET", "/api/posts/liked", { token: stranger });
T("처음에는 비어 있음", r.status === 200 && r.data.posts.length === 0, r.data);
r = await call("POST", `/api/posts/${postId}/like?on=true`, { token: stranger });
T("누름", r.status === 200, r.data);
r = await call("GET", "/api/posts/liked", { token: stranger });
T("눌러 둔 것이 나옴", r.data.posts.length === 1 && r.data.posts[0].id === postId, r.data.posts);
T("누른 것으로 표시됨", r.data.posts[0].liked === true, r.data.posts?.[0]);
r = await call("POST", `/api/posts/${postId}/like?on=false`, { token: stranger });
r = await call("GET", "/api/posts/liked", { token: stranger });
T("떼면 사라짐", r.data.posts.length === 0, r.data.posts);
r = await call("GET", "/api/posts/liked");
T("로그인 없이는 못 봄", r.status === 401, r.data);


console.log("\n[12] 지도에서 나를 가리키는 그림");
r = await call("GET", "/api/auth/me", { token: me });
T("처음에는 안 골라 둠", r.data.user.mark == null, r.data.user);
r = await call("PATCH", "/api/auth/mark", { token: me, body: { mark: "rabbit" } });
T("고름", r.data.user.mark === "rabbit", r.data.user);
r = await call("GET", "/api/auth/me", { token: me });
T("다시 물어도 그대로", r.data.user.mark === "rabbit", r.data.user);
r = await call("PATCH", "/api/auth/mark", { token: me, body: { mark: "없는동물" } });
T("모르는 이름은 비움", r.data.user.mark == null, r.data.user);
r = await call("PATCH", "/api/auth/mark", { token: me, body: { mark: "bear" } });
r = await call("PATCH", "/api/auth/mark", { token: me, body: { mark: "" } });
T("빈 문자열이면 뺌", r.data.user.mark == null, r.data.user);
r = await call("PATCH", "/api/auth/mark", { body: { mark: "cat" } });
T("로그인 없이는 못 바꿈", r.status === 401, r.data);

await call("PATCH", "/api/auth/mark", { token: me, body: { mark: "fox" } });
r = await call("GET", `/api/trips/${tripId}/members`, { token: me });
T("동행자 목록에 그림이 옴", r.data.members.some(m => m.mark === "fox"), r.data.members);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);