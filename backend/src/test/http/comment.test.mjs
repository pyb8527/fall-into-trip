/* 피드백을 받겠다고 연 글에만 댓글이 달리고, 신고가 쌓이면 감춰진다 */
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

console.log("\n[1] 운영자와 사람들");
let r = await call("POST", "/api/auth/setup",
  { body: { email: `admin-${stamp}@test.com`, name: "운영자", password: "pw-12345678", token: "devtoken" } });
const admin = r.data.accessToken;
T("운영자 생성", r.status === 200, r.data);
r = await reg("author", "글쓴이");
const author = r.data.accessToken;
r = await reg("guru", "고수");
const guru = r.data.accessToken;
r = await reg("other", "남");
const other = r.data.accessToken;

/** 장소가 있는 여행을 만들어 글로 올립니다. */
async function publish(feedback) {
  let x = await call("POST", "/api/trips", { token: author, body: { title: "교토 " + (feedback ? "열림" : "닫힘"), startIso: "2027-04-01", nights: 1 } });
  const tripId = x.data.trip.id;
  x = await call("GET", "/api/trip?trip=" + tripId, { token: author });
  const dayId = x.data.days[0].id;
  await call("POST", "/api/places", { token: author, body: { dayId, name: "기요미즈데라", lat: 34.9949, lng: 135.785 } });
  x = await call("POST", `/api/trips/${tripId}/publish`, { token: author, body: { feedback } });
  return x.data.postId;
}

const open = await publish(true);
const shut = await publish(false);
T("두 글 올림", !!open && !!shut);

console.log("\n[2] 열어 둔 글에만 달린다");
r = await call("POST", `/api/posts/${shut}/comments`, { token: guru, body: { text: "여기 말고 옆집" } });
T("안 연 글에는 못 담", r.status === 400, r.data);
r = await call("POST", `/api/posts/${open}/comments`, { token: guru, body: { text: "첫날은 좀 빡셉니다" } });
T("열어 둔 글에는 달림", r.status === 200 && !!r.data.comment.id, r.data);
const c1 = r.data.comment.id;
r = await call("POST", `/api/posts/${open}/comments`, { body: { text: "로그인 없이" } });
T("로그인 없이는 못 담", r.status === 401 || r.status === 403, r.data);
r = await call("POST", `/api/posts/${open}/comments`, { token: guru, body: { text: "  " } });
T("빈 글은 거절", r.status === 400, r.data);

console.log("\n[3] 특정 장소를 가리킨다");
r = await call("POST", `/api/posts/${open}/comments`, { token: guru,
  body: { text: "여기는 아침 일찍이 낫습니다", dayIndex: 0, placeIndex: 0 } });
T("장소에 달림", r.data.comment.dayIndex === 0 && r.data.comment.placeIndex === 0, r.data.comment);
const c2 = r.data.comment.id;
r = await call("POST", `/api/posts/${open}/comments`, { token: guru,
  body: { text: "한쪽만 보내면", dayIndex: 0 } });
T("한쪽만 오면 일정 전체로 봄", r.data.comment.dayIndex == null && r.data.comment.placeIndex == null, r.data.comment);

console.log("\n[4] 읽기는 로그인 없이도");
r = await call("GET", `/api/posts/${open}/comments`);
T("목록이 열림", r.status === 200 && r.data.comments.length === 3, r.data.comments?.length);
T("먼저 쓴 것이 위", r.data.comments[0].id === c1, r.data.comments?.[0]);
T("쓴 사람 이름", r.data.comments[0].authorName === "고수", r.data.comments?.[0]);
r = await call("GET", "/api/posts/" + open);
T("글에 개수와 열림 표시", r.data.commentCount === 3 && r.data.feedback === true, {
  n: r.data.commentCount, f: r.data.feedback });
r = await call("GET", "/api/posts/" + shut);
T("안 연 글은 닫힘으로", r.data.feedback === false, r.data.feedback);

console.log("\n[5] 지우기");
r = await call("DELETE", `/api/comments/${c1}`, { token: other });
T("남의 것은 못 지움", r.status === 403, r.data);
r = await call("DELETE", `/api/comments/${c1}`, { token: author });
T("글쓴이는 자기 글의 댓글을 지움", r.status === 200, r.data);
r = await call("GET", `/api/posts/${open}/comments`);
T("둘 남음", r.data.comments.length === 2, r.data.comments?.length);

console.log("\n[6] 신고와 되돌리기");
r = await call("POST", `/api/comments/${c2}/report`, { token: guru, body: {} });
T("내가 쓴 것은 신고 못 함", r.status === 400, r.data);
r = await call("POST", `/api/comments/${c2}/report`, { token: other, body: {} });
T("신고", r.status === 200, r.data);
r = await call("POST", `/api/comments/${c2}/report`, { token: other, body: {} });
T("두 번은 못 함", r.status === 400, r.data);
await call("POST", `/api/comments/${c2}/report`, { token: author, body: {} });
await call("POST", `/api/comments/${c2}/report`, { token: admin, body: {} });
r = await call("GET", `/api/posts/${open}/comments`);
T("셋 쌓이면 감춰짐", !r.data.comments.some(c => c.id === c2), r.data.comments);

r = await call("GET", "/api/admin/comments", { token: admin });
T("운영자 목록에 보임", r.status === 200 && r.data.items.some(i => i.id === c2), r.data.items);
r = await call("GET", "/api/admin/comments", { token: guru });
T("운영자만 볼 수 있음", r.status === 403, r.data);
r = await call("PATCH", `/api/admin/comments/${c2}/hidden`, { token: admin, body: { hidden: false } });
T("다시 올림", r.status === 200, r.data);
r = await call("GET", `/api/posts/${open}/comments`);
T("되살아남", r.data.comments.some(c => c.id === c2), r.data.comments);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
