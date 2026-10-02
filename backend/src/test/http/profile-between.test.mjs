/* 남의 페이지 — 함께 속한 모임 안의 숫자 · 우리 사이 · 남의 피드 */
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
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678" } });
  return r.data.accessToken;
};

const A = await reg("pba", "가"), B = await reg("pbb", "나"), C = await reg("pbc", "다"), X = await reg("pbx", "남");
const g1 = await makeGroup(A, "같이 든 모임", [B]);
const g2 = await makeGroup(B, "가가 안 든 모임", [C]);
const bId = (await call("GET", "/api/auth/me", { token: B })).data.user.id;
const xId = (await call("GET", "/api/auth/me", { token: X })).data.user.id;

await call("POST", "/api/trips", { token: B, body: { title: "같이 가는 여행", startIso: "2027-05-01", nights: 1, groupId: g1 } });
await call("POST", "/api/trips", { token: B, body: { title: "다른 모임 여행", startIso: "2027-06-01", nights: 1, groupId: g2 } });
await call("POST", "/api/trips", { token: B, body: { title: "혼자 여행", startIso: "2027-07-01", nights: 1 } });
await call("POST", "/api/feed", { token: B, body: { groupId: g1, text: "같이 든 모임 글" } });
await call("POST", "/api/feed", { token: B, body: { groupId: g2, text: "안 든 모임 글" } });
await call("POST", "/api/feed", { token: B, body: { text: "혼자 쓴 글" } });

console.log("\n[1] 숫자는 함께 속한 모임 안에서만");
let r = await call("GET", `/api/users/${bId}/profile`, { token: A });
T("모임 1(전체 2 가 안 샘)", r.data.counts.groups === 1, r.data.counts);
T("여행 1", r.data.counts.trips === 1, r.data.counts);
T("글 1", r.data.counts.posts === 1, r.data.counts);
T("함께한 사람은 같이 든 모임 안에서(가 하나)", r.data.companions === 1, r.data.companions);

console.log("\n[2] 우리 사이");
T("함께 속한 모임 하나", r.data.between?.groups.length === 1 && r.data.between.groups[0].id === g1, r.data.between);
T("함께한 여행은 같이 든 모임 것만", r.data.between?.trips.map((t) => t.title).join() === "같이 가는 여행", r.data.between?.trips);
r = await call("GET", "/api/me/profile", { token: B });
T("내 것에는 우리 사이가 없고 전체를 셈", !r.data.between && r.data.counts.groups === 2 && r.data.counts.trips === 3, r.data);

console.log("\n[3] 남의 피드");
r = await call("GET", `/api/feed?author=${bId}`, { token: A });
T("같이 든 모임 글만", r.data.posts.length === 1 && r.data.posts[0].text === "같이 든 모임 글", r.data.posts.map((p) => p.text));
r = await call("GET", `/api/feed?author=${bId}`, { token: X });
T("모르는 사람에게는 빈 목록", r.status === 200 && r.data.posts.length === 0, r.data);
r = await call("GET", `/api/users/${bId}/profile`, { token: X });
T("모르는 사람의 프로필은 404", r.status === 404, r.status);
r = await call("GET", `/api/feed?author=${xId}`, { token: X });
T("내 이름으로 부르면 내 피드", r.status === 200, r.status);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
