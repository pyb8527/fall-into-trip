/* 소식함 — 내가 없는 동안 무엇이 바뀌었나.

   셋이 "남의 것이 새지 않는가" 입니다. 이 자리는 여러 사람의 표를 한 질의로
   긁으므로, 조건 하나가 빠지면 남의 여행이 그대로 보입니다. 눈으로 지키기
   어려운 자리입니다. */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,300) : ""));
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

const find = (items, fn) => (items || []).filter(fn);
const news = async (token) => (await call("GET", "/api/news", { token })).data;
const has = (got, text) => find(got.items, (i) => (i.text || "").includes(text)).length;

console.log("\n[1] 사람 다섯");
let r = await reg("a", "가");
const a = r.data.accessToken;
r = await reg("b", "나");
const b = r.data.accessToken;
r = await reg("c", "다");
const c = r.data.accessToken;
r = await reg("d", "라");
const d = r.data.accessToken;
r = await reg("e", "마");
const e = r.data.accessToken;
T("다섯 가입", !!a && !!b && !!c && !!d && !!e, { a: !!a, b: !!b, c: !!c, d: !!d, e: !!e });

r = await call("GET", "/api/news");
T("로그인 없이는 401", r.status === 401 || r.status === 403, r.status);

console.log("\n[2] 가의 여행에 나를 부릅니다");
r = await call("POST", "/api/trips", { token: a, body: { title: "오사카 3박 4일", startIso: "2026-11-02", nights: 3 } });
const trip = r.data.trip.id;
T("여행 생김", r.status === 200 && !!trip, r.data);

r = await call("POST", `/api/trips/${trip}/invites`, { token: a, body: { role: "EDITOR" } });
r = await call("POST", `/api/invites/${r.data.invite.token}/accept`, { token: b });
T("나가 들어옴", r.status === 200, r.data);

r = await call("GET", "/api/trip?trip=" + trip, { token: a });
const day = r.data.days[0].id;
const dayLabel = r.data.days[0].label;
T("첫날이 있음", !!day && !!dayLabel, r.data.days?.length);

console.log("\n[3] 남이 넣은 장소가 실립니다");
r = await call("POST", "/api/places", { token: b, body: { dayId: day, name: "이치란", lat: 34.7, lng: 135.5 } });
const place = r.data.place ? r.data.place.id : r.data.id;
T("나가 장소를 넣음", r.status === 200 && !!place, r.data);

let got = await news(a);
let added = find(got.items, (i) => i.kind === "place.add");
T("가의 소식에 실림", added.length === 1, got.items);
T("넣은 사람 이름이 붙음", added[0]?.actorName === "나", added[0]);
T("넣었다고 적힘", added[0]?.text === `${dayLabel}에 「이치란」 를 넣었습니다.`, added[0]);
T("그 여행으로 가는 길", added[0]?.url === `/trip/${trip}` && added[0]?.tripTitle === "오사카 3박 4일", added[0]);

console.log("\n[4] 넣은 것과 고친 것이 갈립니다");
r = await call("PATCH", `/api/places/${place}`, { token: b, body: { name: "이치란 도톤보리" } });
T("나가 고침", r.status === 200, r.data);

got = await news(a);
T("이제 고쳤다고 적힘",
  find(got.items, (i) => i.kind === "place.edit" && i.text === "「이치란 도톤보리」 를 고쳤습니다.").length === 1,
  got.items);
T("넣었다는 줄은 사라짐", find(got.items, (i) => i.kind === "place.add").length === 0, got.items);

console.log("\n[5] 내가 한 일은 안 실립니다");
r = await call("POST", "/api/places", { token: a, body: { dayId: day, name: "내가 넣은 곳", lat: 34.7, lng: 135.5 } });
T("가가 직접 넣음", r.status === 200, r.data);
got = await news(a);
T("가의 소식에는 없음", has(got, "내가 넣은 곳") === 0, got.items);
got = await news(b);
T("나의 소식에는 있음", has(got, "내가 넣은 곳") === 1, got.items);

console.log("\n[6] 남의 여행 것은 안 실립니다");
r = await call("POST", "/api/trips", { token: c, body: { title: "다의 비밀 여행", startIso: "2026-12-01", nights: 1 } });
const other = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + other, { token: c });
const otherDay = r.data.days[0].id;
r = await call("POST", "/api/places", { token: c, body: { dayId: otherDay, name: "남의 가게", lat: 1, lng: 1 } });
T("다가 제 여행에 넣음", r.status === 200, r.data);

got = await news(a);
T("가에게 안 보임", has(got, "남의 가게") === 0, got.items);
T("여행 제목도 안 샘", find(got.items, (i) => i.tripTitle === "다의 비밀 여행").length === 0, got.items);

console.log("\n[7] 후보와 표");
r = await call("POST", `/api/trips/${trip}/candidates`, { token: b, body: { name: "우메다 공중정원", lat: 34.7, lng: 135.4 } });
const cand = r.data.id ?? r.data.candidate?.id;
T("나가 후보를 올림", r.status === 200 && !!cand, r.data);
got = await news(a);
T("후보가 실림",
  find(got.items, (i) => i.kind === "candidate.add" && i.text === "「우메다 공중정원」 를 후보로 올렸습니다.").length === 1,
  got.items);

r = await call("PUT", `/api/candidates/${cand}/vote`, { token: b, body: { yes: true } });
T("나가 표를 던짐", r.status === 200, r.data);
got = await news(a);
T("표가 실림",
  find(got.items, (i) => i.kind === "candidate.vote" && i.text === "「우메다 공중정원」 에 좋다고 했습니다.").length === 1,
  got.items);

console.log("\n[8] 내 글의 추천과 댓글");
r = await call("POST", `/api/trips/${trip}/publish`, { token: a, body: { summary: "먹으러만 다닌 일정", feedback: true } });
const post = r.data.postId;
T("가가 글을 올림", r.status === 200 && !!post, r.data);

r = await call("POST", `/api/posts/${post}/like`, { token: c });
T("다가 추천함", r.status === 200, r.data);
r = await call("POST", `/api/posts/${post}/comments`, { token: c, body: { text: "잘 봤습니다" } });
T("다가 댓글을 남김", r.status === 200, r.data);

got = await news(a);
T("추천이 실림",
  find(got.items, (i) => i.kind === "post.like" && i.text === "「오사카 3박 4일」 를 추천했습니다.").length === 1,
  got.items);
T("댓글이 실림",
  find(got.items, (i) => i.kind === "post.comment" && i.text === "「오사카 3박 4일」 에 댓글을 남겼습니다.").length === 1,
  got.items);
T("글로 가는 길", find(got.items, (i) => i.kind === "post.like")[0]?.url === `/community/${post}`, got.items);
/* 글에서 벌어진 일에는 여행 번호가 안 붙습니다. 둘 중 하나만 찹니다. */
T("여행 번호는 안 붙음", !find(got.items, (i) => i.kind === "post.like")[0]?.tripId, got.items);

console.log("\n[9] 남의 글에 붙은 것은 안 실립니다");
r = await call("POST", "/api/places", { token: c, body: { dayId: otherDay, name: "또 한 곳", lat: 1, lng: 1 } });
r = await call("POST", `/api/trips/${other}/publish`, { token: c, body: { summary: "다의 글" } });
const otherPost = r.data.postId;
T("다가 글을 올림", r.status === 200 && !!otherPost, r.data);
r = await call("POST", `/api/posts/${otherPost}/like`, { token: d });
T("라가 다의 글을 추천함", r.status === 200, r.data);
got = await news(a);
T("가에게 안 보임", find(got.items, (i) => i.postId === otherPost).length === 0, got.items);

console.log("\n[10] 내려간 글에 붙은 것은 안 실립니다");
/* 신고가 셋 쌓이면 사람이 볼 때까지 자동으로 감춥니다. 그 길로 내립니다 —
   운영자 계정은 저장소에 하나뿐이라(`/api/auth/setup`), 이 시험이 그것을
   차지하면 두 번째 실행부터 제 발에 걸립니다. */
for (const who of [b, c, d]) {
  r = await call("POST", `/api/posts/${post}/report`, { token: who, body: { reason: "spam" } });
}
T("신고가 셋 쌓임", r.status === 200, r.data);
got = await news(a);
T("내려간 글의 댓글은 안 실림", find(got.items, (i) => i.kind === "post.comment").length === 0, got.items);
T("내려간 글의 추천도 안 실림", find(got.items, (i) => i.kind === "post.like").length === 0, got.items);

console.log("\n[11] 시각 내림차순");
got = await news(a);
const times = (got.items || []).map((i) => i.at);
/* 남은 셋은 장소·후보·표, 질의가 셋 다 다릅니다. 하나의 질의가 이미
   정렬해서 준 것을 보는 것이 아니라 섞은 결과를 봅니다. */
T("최근 것이 먼저", times.length >= 3 && times.every((t, k) => k === 0 || times[k - 1] >= t), times);
T("서로 다른 갈래가 섞임", new Set((got.items || []).map((i) => i.kind)).size >= 3,
  (got.items || []).map((i) => i.kind));

console.log("\n[12] 봤다고 표시하기");
T("표시 전에는 새것이 있음", got.unseen > 0, got.unseen);
T("줄마다 새것 표시", (got.items || []).every((i) => i.fresh === true), got.items?.[0]);
const before = (got.items || []).length;

r = await call("PUT", "/api/news/seen", { token: a });
T("표시됨", r.status === 200 && !!r.data.seenAt, r.data);

got = await news(a);
T("새것이 0", got.unseen === 0, got.unseen);
T("fresh 도 전부 내려감", (got.items || []).every((i) => i.fresh === false), got.items?.[0]);
T("목록은 그대로 남음", (got.items || []).length === before, { before, after: got.items?.length });

r = await call("PUT", "/api/news/seen");
T("로그인 없이는 표시 못 함", r.status === 401 || r.status === 403, r.status);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
