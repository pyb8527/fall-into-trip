/* 둘러보기 — 혼자·모임 조건, 가져간 수, 이번 주 많이 가져간 순 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,240) : ""));
async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
async function makeGroup(ownerToken, name, mates = []) {
  const g = await call("POST", "/api/groups", { token: ownerToken, body: { name } });
  const gid = g.data.group.id;
  for (const who of mates) {
    const inv = await call("POST", `/api/groups/${gid}/invites`, { token: ownerToken, body: {} });
    await call("POST", `/api/group-invites/${inv.data.invite.token}/accept`, { token: who });
  }
  return gid;
}
const stamp = Date.now();
const reg = async (who, name) => {
  const r = await call("POST", "/api/auth/register",
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678", over14: true, terms: true, privacy: true } });
  return r.data.accessToken;
};

const A = await reg("cpa", "가"), B = await reg("cpb", "나"), C = await reg("cpc", "다");
const g = await makeGroup(A, "가져가기 시험", [B]);
const S = Date.now().toString(36);
async function trip(token, title, groupId) {
  let r = await call("POST", "/api/trips", { token, body: { title, startIso: "2026-03-01", nights: 0, groupId } });
  const id = r.data.trip.id;
  r = await call("GET", "/api/trip?trip=" + id, { token });
  await call("POST", "/api/places", { token, body: { dayId: r.data.days[0].id, name: "어딘가", lat: 35, lng: 135 } });
  r = await call("POST", `/api/trips/${id}/publish`, { token, body: { title: `${title}-${S}` } });
  return r.data.postId ?? r.data.id;
}
const groupPost = await trip(A, "모임에서 간 길", g);
const soloPost = await trip(A, "혼자 간 길", null);
T("둘 다 올라감", !!groupPost && !!soloPost, [groupPost, soloPost]);

console.log("\n[1] 혼자 · 모임 조건");
let r = await call("GET", `/api/posts?sort=new&q=${S}&who=group`);
T("모임 것만", r.data.posts.length === 1 && r.data.posts[0].id === groupPost && r.data.posts[0].fromGroup === true, r.data.posts.map((p) => p.title));
r = await call("GET", `/api/posts?sort=new&q=${S}&who=solo`);
T("혼자 것만", r.data.posts.length === 1 && r.data.posts[0].id === soloPost, r.data.posts.map((p) => p.title));
r = await call("GET", `/api/posts?sort=hot&q=${S}&who=solo`);
T("인기 순에서도 거름", r.data.posts.length === 1, r.data.posts.length);
r = await call("GET", `/api/posts?sort=new&q=${S}&size=1`);
T("size 로 몇 장만", r.data.posts.length === 1, r.data.posts.length);

console.log("\n[2] 가져간 수");
await call("POST", `/api/posts/${soloPost}/copy`, { token: B, body: { startIso: "2027-01-01" } });
await call("POST", `/api/posts/${soloPost}/copy`, { token: B, body: { startIso: "2027-02-01" } });
await call("POST", `/api/posts/${soloPost}/copy`, { token: C, body: { startIso: "2027-01-01" } });
await call("POST", `/api/posts/${soloPost}/copy`, { token: A, body: { startIso: "2027-01-01" } });
r = await call("GET", `/api/posts?sort=new&q=${S}`);
const solo = r.data.posts.find((p) => p.id === soloPost);
T("같은 사람 두 번 · 글쓴이 제 것은 안 셈 → 2", solo.copyCount === 2, solo);
r = await call("GET", `/api/posts?sort=copied&q=${S}`);
T("이번 주 많이 가져간 순에서 먼저", r.data.posts[0].id === soloPost, r.data.posts.map((p) => [p.title, p.copyCount]));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
