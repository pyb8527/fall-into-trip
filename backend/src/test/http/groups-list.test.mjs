/* 모임 목록 카드 — 얼굴 · 최근 활동 · 사진, 안 든 모임 것은 안 섞임 */
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
  const data = await r.json();
  return data.id;
}

const A = await reg("gca", "가"), B = await reg("gcb", "나"), X = await reg("gcx", "남");
const g1 = await makeGroup(A, "우리 모임", [B]);
const g2 = await makeGroup(X, "남의 모임", []);

console.log("\n[1] 얼굴과 들어옴");
let r = await call("GET", "/api/groups", { token: A });
let mine = r.data.groups.find((g) => g.id === g1);
T("얼굴 둘(주인이 앞)", mine.faces?.length === 2 && mine.faces[0].name === "가", mine.faces);
T("최근 활동은 나가 들어옴", mine.activity?.kind === "group.join" && mine.activity.actorName === "나", mine.activity);
T("새 소식 점", mine.fresh === true, mine.fresh);

console.log("\n[2] 글과 사진");
const pic = await photo(B);
await call("POST", "/api/feed", { token: B, body: { groupId: g1, text: "오늘 좋았다", photoIds: [pic] } });
await call("POST", "/api/feed", { token: X, body: { groupId: g2, text: "남의 글" } });
r = await call("GET", "/api/groups", { token: A });
mine = r.data.groups.find((g) => g.id === g1);
T("최근 활동은 나의 글", mine.activity?.kind === "feed.post" && mine.activity.actorName === "나", mine.activity);
T("사진 번호", mine.photoIds?.length === 1 && mine.photoIds[0] === pic, mine.photoIds);
T("안 든 모임은 목록에 없음", !r.data.groups.some((g) => g.id === g2), r.data.groups.map((g) => g.name));

console.log("\n[3] 내가 한 일은 안 뜸");
r = await call("GET", "/api/groups", { token: B });
mine = r.data.groups.find((g) => g.id === g1);
T("내 글은 최근 활동이 아님", mine.activity?.actorName !== "나", mine.activity);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
