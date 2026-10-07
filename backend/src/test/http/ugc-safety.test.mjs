/*
  신고 · 차단 · 걸러내기 — 스토어가 묻는 「사람이 올린 것을 어떻게 다루나」.

  다섯 가지를 봅니다.
    1. 피드 글 신고 — 세 건이면 감춰지고, 운영자가 되돌린다
    2. 프로필 신고 — 세 사람이면 소개와 사진이 감춰지고(이름은 남고), 운영자가 거둔다
    3. 걸러내기 — 욕은 올릴 때 막고, 닮은 멀쩡한 말은 통과한다
    4. 차단 — 서로의 피드 · 여행기 · 댓글 · 한 줄이 양쪽 다 안 보이고, 풀면 돌아온다
    5. 차단한 사람이 만든 초대 링크로는 못 들어온다

  가장 조심할 자리는 「양쪽」입니다. 막은 쪽만 거르면 막힌 사람이 막은 사람의
  글에 계속 댓글을 달 수 있고, 그 댓글은 막은 사람 글 아래에서 남들이 봅니다.
*/
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

const TAG = Date.now().toString(36);
const reg = async (who, name) => (await call("POST", "/api/auth/register",
  { body: { email: `${who}-${TAG}@local.test`, name, password: "ugc-test-1234", over14: true, terms: true, privacy: true } })).data;

async function makeGroup(ownerToken, name, mates = []) {
  const g = await call("POST", "/api/groups", { token: ownerToken, body: { name } });
  const gid = g.data.group.id;
  for (const who of mates) {
    const inv = await call("POST", `/api/groups/${gid}/invites`, { token: ownerToken, body: {} });
    await call("POST", `/api/group-invites/${inv.data.invite.token}/accept`, { token: who });
  }
  return gid;
}

/* 장소 하나짜리 여행을 만들어 둘러보기에 내놓습니다. 댓글을 받게 열어 둡니다. */
async function publish(token, title) {
  let r = await call("POST", "/api/trips", { token, body: { title, startIso: "2027-05-01", nights: 0 } });
  const tripId = r.data.trip.id;
  r = await call("GET", "/api/trip?trip=" + tripId, { token });
  const dayId = r.data.days[0].id;
  await call("POST", "/api/places", { token, body: { dayId, name: "센소지", lat: 35.7148, lng: 139.7967 } });
  r = await call("POST", `/api/trips/${tripId}/publish`, { token, body: { feedback: true } });
  return r.data.postId;
}

let r;

console.log("\n[0] 운영자와 사람들");
const ADMIN = { email: "admin@local.test", name: "관리자", password: "trip-test-1234" };
r = await call("POST", "/api/auth/setup", { body: { ...ADMIN, token: SETUP_TOKEN } });
if (r.status !== 200) {
  r = await call("POST", "/api/auth/login", { body: { email: ADMIN.email, password: ADMIN.password } });
}
const admin = r.data?.accessToken;
T("운영자 확보", r.status === 200 && r.data?.user?.role === "ADMIN", r.data);

const A = await reg("a", "가람");
const B = await reg("b", "보라");
const C = await reg("c", "초롱");
const D = await reg("d", "다솜");
const a = A.accessToken, b = B.accessToken, c = C.accessToken, d = D.accessToken;
const aId = A.user.id, bId = B.user.id;
T("넷 가입", !!a && !!b && !!c && !!d, A);

const groupId = await makeGroup(a, "주말 여행", [b, c, d]);
T("모임 생김", !!groupId);

console.log("\n[1] 피드 글 신고");
r = await call("POST", "/api/feed", { token: a, body: { groupId, text: "온천 다녀옴" } });
const feedId = r.data.post.id;
T("가람이 올림", r.status === 200 && !!feedId, r.data);

r = await call("POST", `/api/feed/${feedId}/report`, { token: a, body: { reason: "내 것" } });
T("내 글은 신고 못 함", r.status === 400, r.data);
r = await call("POST", `/api/feed/${feedId}/report`, { token: b, body: { reason: "확인용" } });
T("신고", r.status === 200, r.data);
r = await call("POST", `/api/feed/${feedId}/report`, { token: b, body: {} });
T("두 번은 못 함", r.status === 400, r.data);
await call("POST", `/api/feed/${feedId}/report`, { token: c, body: {} });
r = await call("GET", `/api/feed/${feedId}`, { token: d });
T("두 건으로는 안 감춰짐", r.status === 200, r.data);
await call("POST", `/api/feed/${feedId}/report`, { token: d, body: {} });
r = await call("GET", `/api/feed/${feedId}`, { token: d });
T("세 건이면 감춰짐", r.status === 404, r.data);
r = await call("GET", `/api/feed?group=${groupId}`, { token: b });
T("모임 피드에서도 빠짐", !r.data.posts.some(p => p.id === feedId), r.data.posts);

r = await call("GET", "/api/admin/feed", { token: admin });
const row = r.data?.items?.find(i => i.id === feedId);
T("운영 화면에 섬", r.status === 200 && row?.hidden === true && row?.reportCount === 3, row);
r = await call("GET", "/api/admin/feed", { token: b });
T("운영 화면은 운영자만", r.status === 403, r.data);
r = await call("PATCH", `/api/admin/feed/${feedId}/hidden`, { token: admin, body: { hidden: false } });
T("운영자가 되돌림", r.status === 200, r.data);
r = await call("GET", `/api/feed/${feedId}`, { token: d });
T("다시 보임", r.status === 200, r.data);

r = await call("POST", "/api/feed", { token: c, body: { groupId, text: "지울 글" } });
const doomedFeed = r.data.post.id;
await call("PATCH", `/api/admin/feed/${doomedFeed}/hidden`, { token: admin, body: { hidden: true } });
r = await call("DELETE", `/api/feed/${doomedFeed}`, { token: admin });
T("감춰진 글도 운영자가 지움", r.status === 200, r.data);

console.log("\n[2] 프로필 신고");
r = await call("PATCH", "/api/me/profile", { token: a, body: { bio: "온천을 좋아해요" } });
T("소개 적음", r.status === 200 && r.data.bio === "온천을 좋아해요", r.data);
r = await call("POST", `/api/users/${aId}/report`, { token: a, body: {} });
T("나는 신고 못 함", r.status === 400, r.data);
await call("POST", `/api/users/${aId}/report`, { token: b, body: { reason: "사진" } });
r = await call("POST", `/api/users/${aId}/report`, { token: b, body: {} });
T("한 사람이 두 번은 못 함", r.status === 400, r.data);
await call("POST", `/api/users/${aId}/report`, { token: c, body: {} });
r = await call("GET", `/api/users/${aId}/profile`, { token: d });
T("두 사람으로는 그대로", r.data.bio === "온천을 좋아해요", r.data);
await call("POST", `/api/users/${aId}/report`, { token: d, body: {} });
r = await call("GET", `/api/users/${aId}/profile`, { token: d });
T("세 사람이면 소개가 감춰짐", r.status === 200 && r.data.bio == null, r.data);
T("이름은 남음", r.data.name === "가람", r.data);
r = await call("GET", "/api/me/profile", { token: a });
T("나에게는 그대로 보임", r.data.bio === "온천을 좋아해요", r.data);

r = await call("GET", "/api/admin/profiles", { token: admin });
const prow = r.data?.items?.find(i => i.userId === aId);
T("운영 화면에 섬", r.status === 200 && prow?.held === true && prow?.reportCount === 3, prow);
T("적은 까닭이 실림", prow?.reasons?.includes("사진"), prow);
r = await call("DELETE", `/api/admin/profiles/${aId}/reports`, { token: admin });
T("운영자가 신고를 거둠", r.status === 200, r.data);
r = await call("GET", `/api/users/${aId}/profile`, { token: d });
T("소개가 돌아옴", r.data.bio === "온천을 좋아해요", r.data);

console.log("\n[3] 걸러내기");
const BAD = "쓸 수 없는 말이 들어 있어요. 고쳐서 다시 올려 주세요.";
r = await call("POST", "/api/feed", { token: a, body: { groupId, text: "아 씨.발 늦었다" } });
T("피드 글 — 막힘", r.status === 400 && r.data?.error === BAD, r.data);
r = await call("POST", "/api/feed", { token: a, body: { groupId, text: "여기가 이번 여행의 시발점" } });
T("피드 글 — 시발점은 통과", r.status === 200, r.data);
r = await call("PATCH", "/api/me/profile", { token: a, body: { name: "개 새 끼" } });
T("이름 — 띄워 써도 막힘", r.status === 400, r.data);
r = await call("PATCH", "/api/me/profile", { token: a, body: { bio: "FUUUCK" } });
T("소개 — 막힘", r.status === 400, r.data);
r = await call("POST", "/api/groups", { token: a, body: { name: "병신 모임" } });
T("모임 이름 — 막힘", r.status === 400, r.data);
const PLACE = "gplace-ugc-" + TAG;
r = await call("POST", `/api/places/${PLACE}/tips`, { token: a, body: { text: "ㅅㅂ 줄 길다" } });
T("한 줄 — 막힘", r.status === 400, r.data);
r = await call("POST", `/api/places/${PLACE}/tips`, { token: a, body: { text: "Niigata 사케가 좋아요" } });
T("한 줄 — 니가타는 통과", r.status === 200, r.data);

const cPost = await publish(c, "도쿄 하루");
T("초롱이 여행기를 올림", !!cPost);
r = await call("POST", `/api/posts/${cPost}/comments`, { token: a, body: { text: "지랄 맞네" } });
T("댓글 — 막힘", r.status === 400, r.data);
r = await call("POST", `/api/trips/${(await call("POST", "/api/trips", { token: a, body: { title: "x", startIso: "2027-05-01", nights: 0 } })).data.trip.id}/publish`,
  { token: a, body: { title: "씨발 여행" } });
T("여행기 제목 — 막힘", r.status === 400, r.data);

console.log("\n[4] 차단");
r = await call("POST", `/api/users/${aId}/block`, { token: a });
T("나는 차단 못 함", r.status === 400, r.data);

/* 막기 전에 보라가 남긴 것들. */
r = await call("POST", "/api/feed", { token: b, body: { groupId, text: "보라의 피드" } });
const bFeed = r.data.post.id;
await call("POST", `/api/places/${PLACE}/tips`, { token: b, body: { text: "보라의 한 줄" } });
await call("POST", `/api/posts/${cPost}/comments`, { token: a, body: { text: "가람의 댓글" } });
await call("POST", `/api/posts/${cPost}/comments`, { token: b, body: { text: "보라의 댓글" } });
const bPost = await publish(b, "보라의 여행기");
const aPost = await publish(a, "가람의 여행기");
T("보라 · 가람이 여행기를 올림", !!bPost && !!aPost);

r = await call("POST", `/api/users/${bId}/block`, { token: a });
T("가람이 보라를 차단", r.status === 200, r.data);
r = await call("POST", `/api/users/${bId}/block`, { token: a });
T("두 번 눌러도 괜찮음", r.status === 200, r.data);
r = await call("GET", "/api/me/blocks", { token: a });
T("차단 목록에 보라", r.data.blocks.length === 1 && r.data.blocks[0].id === bId && r.data.blocks[0].name === "보라", r.data);
r = await call("GET", "/api/me/blocks", { token: b });
T("보라에게는 목록이 없음(알리지 않음)", r.data.blocks.length === 0, r.data);

/* 막은 쪽에서. */
r = await call("GET", `/api/feed?group=${groupId}`, { token: a });
T("가람 — 모임 피드에 보라 글 없음", !r.data.posts.some(p => p.authorId === bId), r.data.posts);
r = await call("GET", `/api/feed/${bFeed}`, { token: a });
T("가람 — 보라 글 하나도 없음", r.status === 404, r.data);
r = await call("GET", `/api/places/${PLACE}/tips`, { token: a });
T("가람 — 보라 한 줄 없음", !r.data.tips.some(t => t.authorId === bId), r.data.tips);
r = await call("GET", `/api/posts/${cPost}/comments`, { token: a });
T("가람 — 보라 댓글 없음", !r.data.comments.some(x => x.authorId === bId), r.data.comments);
r = await call("GET", "/api/posts?sort=new&size=20", { token: a });
T("가람 — 둘러보기에 보라 여행기 없음", !r.data.posts.some(p => p.id === bPost), r.data.posts?.map(p => p.id));
r = await call("GET", `/api/posts/${bPost}`, { token: a });
T("가람 — 보라 여행기 열리지 않음", r.status === 404, r.data);
r = await call("GET", `/api/users/${bId}/profile`, { token: a });
T("가람 — 보라 프로필은 이름만, 차단 표시", r.status === 200 && r.data.name === "보라" && r.data.blocked === true && r.data.bio == null, r.data);

/* 막힌 쪽에서 — 양쪽입니다. */
r = await call("GET", `/api/feed?group=${groupId}`, { token: b });
T("보라 — 모임 피드에 가람 글 없음", !r.data.posts.some(p => p.authorId === aId), r.data.posts);
r = await call("GET", `/api/places/${PLACE}/tips`, { token: b });
T("보라 — 가람 한 줄 없음", !r.data.tips.some(t => t.authorId === aId), r.data.tips);
r = await call("GET", `/api/posts/${cPost}/comments`, { token: b });
T("보라 — 가람 댓글 없음", !r.data.comments.some(x => x.authorId === aId), r.data.comments);
r = await call("GET", "/api/posts?sort=new&size=20", { token: b });
T("보라 — 둘러보기에 가람 여행기 없음", !r.data.posts.some(p => p.id === aPost), r.data.posts?.map(p => p.id));
r = await call("POST", `/api/posts/${aPost}/comments`, { token: b, body: { text: "몰래 댓글" } });
T("보라 — 가람 여행기에 댓글 못 담", r.status === 404, r.data);
r = await call("GET", `/api/users/${aId}/profile`, { token: b });
T("보라 — 가람 프로필은 비어 있고 막혔다는 표시 없음", r.status === 200 && r.data.blocked === false && r.data.bio == null, r.data);

/* 남들에게는 그대로입니다. */
r = await call("GET", `/api/places/${PLACE}/tips`, { token: c });
T("초롱에게는 둘 다 보임",
  r.data.tips.some(t => t.authorId === aId) && r.data.tips.some(t => t.authorId === bId), r.data.tips);
r = await call("GET", "/api/places/" + PLACE + "/tips");
T("손님에게도 둘 다 보임", r.data.tips.length >= 2, r.data.tips);

console.log("\n[5] 차단한 사람의 초대 링크");
/* 이미 함께 든 모임은 그대로입니다 — 보라는 「주말 여행」에 남아 있습니다. */
r = await call("GET", `/api/groups/${groupId}`, { token: b });
T("함께 쓰던 모임은 그대로", r.status === 200, r.data);
const aGroup = await makeGroup(a, "가람의 새 모임");
r = await call("POST", `/api/groups/${aGroup}/invites`, { token: a, body: { maxUses: 5 } });
const aInvite = r.data.invite.token;
r = await call("POST", `/api/group-invites/${aInvite}/accept`, { token: b });
T("막힌 사람은 못 들어옴", r.status === 403 && /들어갈 수 없어요/.test(r.data?.error ?? ""), r.data);
r = await call("GET", `/api/groups/${aGroup}`, { token: b });
T("모임에 안 들어가 있음", r.status === 404, r.data);
r = await call("POST", `/api/group-invites/${aInvite}/accept`, { token: c });
T("다른 사람은 들어옴", r.status === 200, r.data);

console.log("\n[6] 풀기");
r = await call("DELETE", `/api/users/${bId}/block`, { token: a });
T("풂", r.status === 200, r.data);
r = await call("GET", `/api/feed/${bFeed}`, { token: a });
T("보라 글이 다시 보임", r.status === 200, r.data);
r = await call("GET", `/api/posts/${cPost}/comments`, { token: b });
T("보라에게 가람 댓글이 다시 보임", r.data.comments.some(x => x.authorId === aId), r.data.comments);
r = await call("GET", "/api/me/blocks", { token: a });
T("차단 목록이 빔", r.data.blocks.length === 0, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
