/* 일정을 올리고, 남이 복제하고, 추천·조회·신고가 어떻게 세어지는지 */
const BASE = "http://127.0.0.1:8080";
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

console.log("\n[1] 올릴 사람과 볼 사람");
let r = await reg("author", "글쓴이");
const author = r.data.accessToken;
T("작성자 가입", r.status === 200, r.data);
r = await reg("reader", "구경꾼");
const reader = r.data.accessToken;
T("독자 가입", r.status === 200, r.data);

console.log("\n[2] 장소 없는 일정은 못 올린다");
r = await call("POST", "/api/trips", { token: author, body: { title: "빈 여행", startIso: "2026-11-02", nights: 1 } });
const emptyTrip = r.data.trip.id;
r = await call("POST", `/api/trips/${emptyTrip}/publish`, { token: author, body: {} });
T("장소가 없으면 거절", r.status === 400, r.data);

console.log("\n[3] 일정을 올린다");
r = await call("POST", "/api/trips", { token: author, body: { title: "오사카 2박 3일", startIso: "2026-11-02", nights: 2 } });
const tripId = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: author });
const dayId = r.data.days[0].id;
r = await call("POST", "/api/places", { token: author, body: { dayId, name: "도톤보리", lat: 34.6687, lng: 135.5013, time: "18:00", cat: "관광" } });
T("장소 넣기", r.status === 200, r.data);
r = await call("POST", "/api/places", { token: author, body: { dayId, name: "구로몬 시장", lat: 34.6656, lng: 135.5061, time: "11:00" } });

r = await call("POST", `/api/trips/${tripId}/publish`, { token: author, body: { summary: "먹으러만 다닌 일정" } });
T("올라감", r.status === 200 && !!r.data.postId, r.data);
const postId = r.data.postId;

r = await call("POST", `/api/trips/${tripId}/publish`, { token: reader, body: {} });
T("남의 여행은 못 올림", r.status === 403 || r.status === 404, r.data);

console.log("\n[4] 로그인 없이도 구경된다");
r = await call("GET", "/api/posts");
T("목록이 열림", r.status === 200 && Array.isArray(r.data.posts), r.data);
T("올린 글이 보임", r.data.posts.some(p => p.id === postId), r.data.posts?.[0]);
r = await call("GET", "/api/posts/" + postId);
T("글이 열림", r.status === 200 && r.data.title === "오사카 2박 3일", r.data);
T("일정이 함께 옴", r.data.itinerary?.days?.[0]?.places?.length === 2, r.data.itinerary?.days?.[0]);
T("남의 방문 기록은 안 실림", JSON.stringify(r.data.itinerary).includes("visited") === false, null);

console.log("\n[4-2] 골라 보기");
r = await call("GET", "/api/posts/regions");
T("지역 목록이 열림", r.status === 200 && r.data.regions.includes("일본"), r.data);
r = await call("GET", "/api/posts?region=" + encodeURIComponent("일본"));
T("지역을 안 골랐으면 안 걸림", !r.data.posts.some(p => p.id === postId), r.data.posts?.[0]);
r = await call("GET", "/api/posts?q=" + encodeURIComponent("오사카"));
T("제목으로 찾음", r.data.posts.some(p => p.id === postId), r.data.posts?.[0]);
r = await call("GET", "/api/posts?q=" + encodeURIComponent("없는말없는말"));
T("없는 말은 안 걸림", r.data.posts.length === 0, r.data);
r = await call("GET", "/api/posts?days=1");
T("당일치기로 거르면 사흘짜리는 빠짐", !r.data.posts.some(p => p.id === postId), r.data);
r = await call("GET", "/api/posts?days=2-4&sort=new");
T("기간이 맞으면 걸림", r.data.posts.some(p => p.id === postId), r.data);
r = await call("GET", "/api/posts?sort=top&q=" + encodeURIComponent("오사카"));
T("정렬을 바꿔도 보는 범위는 같음", r.data.posts.some(p => p.id === postId), r.data);

console.log("\n[5] 추천은 한 사람이 한 번");
r = await call("POST", `/api/posts/${postId}/like`, { token: reader });
T("추천", r.status === 200 && r.data.liked === true, r.data);
await call("POST", `/api/posts/${postId}/like`, { token: reader });
r = await call("GET", "/api/posts/" + postId, { token: reader });
T("두 번 눌러도 하나", r.data.likeCount === 1, r.data);
T("내가 눌렀다고 표시", r.data.liked === true, r.data);
r = await call("POST", `/api/posts/${postId}/like?on=false`, { token: reader });
r = await call("GET", "/api/posts/" + postId, { token: reader });
T("취소하면 줄어듦", r.data.likeCount === 0 && r.data.liked === false, r.data);
r = await call("POST", `/api/posts/${postId}/like`, {});
T("로그인 없이는 추천 불가", r.status === 401 || r.status === 403, r.data);

console.log("\n[6] 조회수는 하루 한 번");
r = await call("GET", "/api/posts/" + postId, { token: reader });
const seen = r.data.viewCount;
await call("GET", "/api/posts/" + postId, { token: reader });
r = await call("GET", "/api/posts/" + postId, { token: reader });
T("새로고침해도 안 늘어남", r.data.viewCount === seen, { seen, now: r.data.viewCount });

console.log("\n[6-2] 내가 쓴 글");
r = await call("GET", "/api/posts/mine", { token: author });
T("내 글이 보임", r.status === 200 && r.data.posts.some(p => p.id === postId), r.data);
r = await call("GET", "/api/posts/mine", { token: reader });
T("남의 글은 안 보임", r.data.posts.length === 0, r.data);
r = await call("GET", "/api/posts/mine");
T("로그인 없이는 못 봄", r.status === 401 || r.status === 403, r.data);

console.log("\n[7] 남의 일정을 내 것으로 가져온다");
r = await call("POST", `/api/posts/${postId}/copy`, { token: reader, body: {} });
T("날짜 없이는 거절", r.status === 400, r.data);
r = await call("POST", `/api/posts/${postId}/copy`, { token: reader, body: { startIso: "2027-03-05" } });
T("복제", r.status === 200 && !!r.data.tripId, r.data);
const copied = r.data.tripId;
r = await call("GET", "/api/trip?trip=" + copied, { token: reader });
T("내 여행이 됨", r.status === 200 && r.data.trip.title === "오사카 2박 3일", r.data.trip);
T("날짜는 내가 정한 날부터", r.data.days[0].iso === "2027-03-05", r.data.days[0]);
T("장소가 따라옴", r.data.days[0].places.length === 2, r.data.days[0].places);
T("다녀온 표시는 안 따라옴", r.data.visited.length === 0, r.data.visited);
r = await call("GET", "/api/trip?trip=" + copied, { token: author });
T("원본 작성자는 못 봄", r.status === 404 || r.status === 403, r.data);

console.log("\n[8] 원본을 지워도 글은 남는다");
r = await call("DELETE", "/api/trips/" + tripId, { token: author });
T("원본 삭제", r.status === 200, r.data);
r = await call("GET", "/api/posts/" + postId);
T("글은 그대로", r.status === 200 && r.data.itinerary?.days?.[0]?.places?.length === 2, r.data);

console.log("\n[9] 신고와 내리기");
r = await call("POST", `/api/posts/${postId}/report`, { token: author, body: { reason: "테스트" } });
T("내 글은 신고 못 함", r.status === 400, r.data);
r = await call("POST", `/api/posts/${postId}/report`, { token: reader, body: { reason: "테스트" } });
T("신고", r.status === 200, r.data);
r = await call("POST", `/api/posts/${postId}/report`, { token: reader, body: {} });
T("두 번은 못 함", r.status === 400, r.data);
r = await call("DELETE", "/api/posts/" + postId, { token: reader });
T("남의 글은 못 내림", r.status === 403, r.data);
r = await call("DELETE", "/api/posts/" + postId, { token: author });
T("내 글은 내림", r.status === 200, r.data);
r = await call("GET", "/api/posts/" + postId);
T("내린 글은 안 보임", r.status === 404, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
