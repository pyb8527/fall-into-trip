/* 여행 안내판 — 멤버 누구나 고치고, 부딪히면 뒤 사람이 물러나고, 소식함에는 글이 안 실린다 */
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

const A = await reg("nga", "가"), B = await reg("nna", "나"), X = await reg("nx", "남");
const groupId = await makeGroup(A, "안내판 시험", [B]);
let r = await call("POST", "/api/trips", { token: A, body: { title: "교토", startIso: "2027-04-01", nights: 1, groupId } });
const tripId = r.data.trip.id;

console.log("\n[1] 처음에는 비어 있음");
r = await call("GET", "/api/trip?trip=" + tripId, { token: B });
T("판은 옴", typeof r.data.notice?.version === "number" && !r.data.notice.text, r.data.notice);
const v0 = r.data.notice.version;

console.log("\n[2] 멤버가 적음");
r = await call("PUT", `/api/trips/${tripId}/notice`, { token: B, body: { text: "도어락 1234*\n9시 로비", version: v0 } });
T("적힘", r.status === 200 && r.data.notice.text === "도어락 1234*\n9시 로비", r.data);
T("누가 고쳤나", r.data.notice.byName === "나", r.data.notice);
const v1 = r.data.notice.version;
T("판이 오름", v1 > v0, [v0, v1]);

r = await call("PUT", `/api/trips/${tripId}/notice`, { token: B, body: { text: "도어락 5678*", version: v1 } });
T("같은 사람이 이어서 고쳐도 안 부딪힘", r.status === 200, r.data);

console.log("\n[3] 옛 판으로 고치면 물러남");
r = await call("PUT", `/api/trips/${tripId}/notice`, { token: A, body: { text: "덮어쓰기", version: v0 } });
T("409", r.status === 409, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
T("앞 사람 글이 남음", r.data.notice.text === "도어락 5678*", r.data.notice);

console.log("\n[4] 남은 못 봄 · 못 고침");
r = await call("PUT", `/api/trips/${tripId}/notice`, { token: X, body: { text: "몰래" } });
T("404", r.status === 404, r.data);
r = await call("PUT", `/api/trips/${tripId}/notice`, { token: A, body: { text: "가".repeat(4001) } });
T("4000 자 넘으면 거절", r.status === 400, r.data);

console.log("\n[5] 소식함");
r = await call("GET", "/api/news", { token: A });
const line = r.data.items.find((i) => i.kind === "notice.edit");
T("남이 고친 것이 뜸", !!line && line.tripId === tripId, r.data.items.map((i) => i.kind));
T("글은 안 실림", line && !JSON.stringify(line).includes("5678"), line);
r = await call("GET", "/api/news", { token: B });
T("내가 고친 것은 안 뜸", !r.data.items.some((i) => i.kind === "notice.edit"), r.data.items.map((i) => i.kind));

console.log("\n[6] 비우면 걷힘");
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
r = await call("PUT", `/api/trips/${tripId}/notice`, { token: A, body: { text: "  ", version: r.data.notice.version } });
T("빈 글이면 비워짐", r.status === 200 && !r.data.notice.text, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
