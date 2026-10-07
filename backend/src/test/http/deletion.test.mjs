/* 회원 탈퇴 — 주인인 여행 · 모임은 넘기거나 지우고, 가계부는 「탈퇴한 사람」으로,
   사진 파일 · 다른 기기의 로그인까지 지워지는지 */
import { Buffer } from "node:buffer";
import { execSync } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:8080";
const GONE = "withdrawn0000000";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : ""));

async function call(method, path, { body, token, cookie } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  if (cookie) headers.cookie = cookie;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data, res: r };
}

/* 응답이 심은 리프레시 쿠키. 「다른 기기」 하나를 이것 하나로 흉내 냅니다. */
function refreshCookieOf(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
  const line = all.find((c) => c.startsWith("fit_refresh="));
  return line ? line.split(";")[0] : null;
}

async function upload(token) {
  /* 가장 작은 JPEG 하나(1x1, 흰 점). photo.test.mjs 와 같은 것입니다. */
  const tiny = Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEB" +
    "AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh" +
    "ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ" +
    "WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG" +
    "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z",
    "base64",
  );
  const form = new FormData();
  form.append("file", new Blob([tiny], { type: "image/jpeg" }), "a.jpg");
  const r = await fetch(BASE + "/api/photos", { method: "POST", headers: { authorization: "Bearer " + token }, body: form });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

/* 시험용 DB 를 바로 볼 수 있을 때만 씁니다(vote-until.test.mjs 와 같은 길). */
function sql(query) {
  return execSync(`docker exec fit-scratch-db psql -U fit -d ${process.env.PSQL_DB} -tAc "${query}"`).toString().trim();
}

const stamp = Date.now();
const PW = "pw-12345678";
async function reg(who, name) {
  const email = `${who}-${stamp}@test.com`;
  const r = await call("POST", "/api/auth/register", { body: { email, name, password: PW } });
  return { email, token: r.data?.accessToken, id: r.data?.user?.id, cookie: refreshCookieOf(r.res) };
}

console.log("\n[0] 준비 — 떠날 사람(가), 먼저 들어온 동행(나), 나중에 들어온 동행(다)");
const A = await reg("dela", "가");
const B = await reg("delb", "나");
const C = await reg("delc", "다");
T("셋 가입", !!A.token && !!B.token && !!C.token);

let r = await call("POST", "/api/groups", { token: A.token, body: { name: "탈퇴 시험" } });
const groupId = r.data?.group?.id;
for (const who of [B, C]) {
  const inv = await call("POST", `/api/groups/${groupId}/invites`, { token: A.token, body: {} });
  await call("POST", `/api/group-invites/${inv.data.invite.token}/accept`, { token: who.token });
}
r = await call("GET", `/api/groups/${groupId}`, { token: A.token });
T("모임에 셋", r.data?.members?.length === 3, r.data);

r = await call("POST", "/api/trips", { token: A.token, body: { title: "같이 가는 강릉", startIso: "2027-06-01", nights: 1, groupId } });
const shared = r.data?.trip?.id;
r = await call("POST", "/api/trips", { token: A.token, body: { title: "혼자 가는 부산", startIso: "2027-07-01", nights: 1 } });
const solo = r.data?.trip?.id;
T("여행 둘(모임 · 혼자)", !!shared && !!solo);

/* 가가 30000 을 냈고 셋이 나눕니다. 나가 6000 을 냈고 가 · 나 둘이 나눕니다. */
r = await call("POST", `/api/trips/${shared}/expenses`, { token: A.token, body: { name: "숙소", amount: 30000, currency: "KRW", payerId: A.id } });
T("가가 낸 지출", r.status === 200, r.data);
r = await call("POST", `/api/trips/${shared}/expenses`, { token: B.token, body: { name: "커피", amount: 6000, currency: "KRW", payerId: B.id, share: [A.id, B.id] } });
T("나가 낸 지출(가 · 나만)", r.status === 200, r.data);

r = await upload(A.token);
const photoId = r.data?.id;
T("가의 사진", r.status === 200 && !!photoId, r.data);
r = await fetch(`${BASE}/api/photos/${photoId}`);
T("사진 파일이 있음", r.status === 200, r.status);

/* 다른 기기 하나 더. */
r = await call("POST", "/api/auth/login", { body: { email: A.email, password: PW } });
const otherDevice = refreshCookieOf(r.res);
T("다른 기기 로그인", r.status === 200 && !!otherDevice, r.data);

console.log("\n[1] 미리 보기 — 누구에게 넘어가는지");
r = await call("GET", "/api/auth/me/deletion-preview", { token: A.token });
T("200", r.status === 200, r.data);
T("비밀번호로 확인", r.data?.confirm === "password", r.data);
const sharedRow = r.data?.trips?.find((t) => t.id === shared);
const soloRow = r.data?.trips?.find((t) => t.id === solo);
T("같이 가는 여행 → 먼저 들어온 나", sharedRow?.heirId === B.id && sharedRow?.heirName === "나", sharedRow);
T("혼자 여행 → 지움", !!soloRow && soloRow.heirId == null, soloRow);
const groupRow = r.data?.groups?.find((g) => g.id === groupId);
T("모임 → 먼저 들어온 나", groupRow?.heirId === B.id, groupRow);

console.log("\n[2] 다시 확인");
r = await call("DELETE", "/api/auth/me", { token: A.token, body: { password: "틀린-비밀번호" } });
T("틀린 비밀번호 400", r.status === 400, r.data);
r = await call("DELETE", "/api/auth/me", { token: A.token });
T("비밀번호 없이 400", r.status === 400, r.data);
r = await call("GET", "/api/auth/me", { token: A.token });
T("아직 계정이 있음", r.status === 200, r.data);
r = await call("DELETE", "/api/auth/me", { body: { password: PW } });
T("로그인 없이 401", r.status === 401, r.data);

console.log("\n[3] 탈퇴");
r = await call("DELETE", "/api/auth/me", { token: A.token, body: { password: PW } });
T("200", r.status === 200 && r.data?.ok === true, r.data);
const cleared = (r.res.headers.getSetCookie ? r.res.headers.getSetCookie() : [r.res.headers.get("set-cookie") ?? ""])
  .find((c) => c.startsWith("fit_refresh="));
T("이 기기의 쿠키를 걷음", !!cleared && /Max-Age=0/i.test(cleared), cleared);

console.log("\n[4] 주인 넘기기");
r = await call("GET", `/api/trips/${shared}/people`, { token: B.token });
T("같이 가는 여행의 주인이 나", r.data?.people?.find((p) => p.owner)?.id === B.id, r.data);
T("가는 더 없음", !r.data?.people?.some((p) => p.id === A.id), r.data);
r = await call("GET", `/api/groups/${groupId}`, { token: B.token });
const owner = r.data?.members?.find((m) => m.owner);
T("모임 주인이 나", owner?.id === B.id && r.data?.members?.length === 2, r.data?.members);
r = await call("PATCH", `/api/groups/${groupId}`, { token: B.token, body: { name: "넘겨받은 모임" } });
T("나가 모임을 고칠 수 있음", r.status === 200, r.data);

console.log("\n[5] 가계부 — 「탈퇴한 사람」으로, 정산은 그대로");
r = await call("GET", `/api/trips/${shared}/expenses`, { token: B.token });
const list = r.data?.expenses ?? r.data?.items ?? [];
const stay = list.find((e) => e.name === "숙소");
T("지출이 남음", r.status === 200 && list.length === 2, r.data);
T("낸 사람이 「탈퇴한 사람」", stay?.payerId === GONE && stay?.payerName === "탈퇴한 사람", stay);
const coffee = list.find((e) => e.name === "커피");
T("나눌 사람 목록도 바뀜", Array.isArray(coffee?.share) && coffee.share.includes(GONE) && !coffee.share.includes(A.id), coffee);

r = await call("GET", `/api/trips/${shared}/settlement`, { token: B.token });
T("정산 200", r.status === 200, r.data);
const books = r.data?.books?.[0];
const bal = Object.fromEntries((books?.balances ?? []).map((b) => [b.userId, b]));
/* 30000 ÷ 3 = 10000, 6000 ÷ 2 = 3000.
   탈퇴한 사람 +30000 −10000 −3000 = +17000, 나 +6000 −10000 −3000 = −7000, 다 −10000 */
T("탈퇴한 사람 +17000", bal[GONE]?.balance === 17000 && bal[GONE]?.name === "탈퇴한 사람", books?.balances);
T("나 −7000", bal[B.id]?.balance === -7000, books?.balances);
T("다 −10000", bal[C.id]?.balance === -10000, books?.balances);
T("합이 0", (books?.balances ?? []).reduce((s, b) => s + b.balance, 0) === 0, books?.balances);
T("보낼 곳 이름이 「탈퇴한 사람」", books?.transfers?.every((t) => t.toUserId !== GONE || t.toName === "탈퇴한 사람"), books?.transfers);

console.log("\n[6] 사진 파일 · 다른 기기 · 다시 로그인");
r = await fetch(`${BASE}/api/photos/${photoId}`);
T("사진 파일도 지워짐", r.status === 404, r.status);
r = await call("POST", "/api/auth/refresh", { cookie: otherDevice });
T("다른 기기의 토큰도 끊김", r.status === 401, r.data);
r = await call("POST", "/api/auth/refresh", { cookie: A.cookie });
T("가입할 때 받은 토큰도 끊김", r.status === 401, r.data);
r = await call("POST", "/api/auth/login", { body: { email: A.email, password: PW } });
T("같은 계정으로 다시 로그인 안 됨", r.status === 401, r.data);

console.log("\n[7] 남는 사람만 남은 모임 — 혼자면 모임도 지움");
const D = await reg("deld", "라");
r = await call("POST", "/api/groups", { token: D.token, body: { name: "혼자 모임" } });
const lonely = r.data?.group?.id;
r = await call("POST", "/api/trips", { token: D.token, body: { title: "혼자 모임 여행", startIso: "2027-08-01", nights: 0, groupId: lonely } });
const lonelyTrip = r.data?.trip?.id;
r = await call("GET", "/api/auth/me/deletion-preview", { token: D.token });
const lonelyRow = r.data?.groups?.find((g) => g.id === lonely);
const lonelyTripRow = r.data?.trips?.find((t) => t.id === lonelyTrip);
T("혼자 모임 → 지움", !!lonelyRow && lonelyRow.heirId == null, r.data);
T("그 안의 여행 → 지움", !!lonelyTripRow && lonelyTripRow.heirId == null, r.data);
r = await call("DELETE", "/api/auth/me", { token: D.token, body: { password: PW } });
T("탈퇴 200", r.status === 200, r.data);

/* 아무도 못 보는 여행이라 화면으로는 지워졌는지 알 수 없습니다. DB 를 볼 수 있을
   때만 봅니다. */
if (process.env.PSQL_DB) {
  console.log("\n[8] DB 로 확인");
  T("혼자 여행 지워짐", sql(`SELECT count(*) FROM trips WHERE id = '${solo}'`) === "0");
  T("혼자 모임 여행 지워짐", sql(`SELECT count(*) FROM trips WHERE id = '${lonelyTrip}'`) === "0");
  T("혼자 모임 지워짐", sql(`SELECT count(*) FROM groups WHERE id = '${lonely}'`) === "0");
  T("가의 계정 줄 없음", sql(`SELECT count(*) FROM users WHERE id = '${A.id}'`) === "0");
  T("탈퇴 기록에 이메일 없음",
    !sql(`SELECT coalesce(string_agg(detail::text, ' '), '') FROM audit_log WHERE action = 'user.withdraw' AND target = '${A.id}'`).includes("@"));
} else {
  console.log("\n[8] DB 확인은 건너뜀 (PSQL_DB 를 주면 봅니다)");
}

/*
  카카오를 이어 둔 사람은 카카오로 다시 확인해야 합니다.

  <p>진짜 카카오 계정은 시험에서 못 만듭니다. DB 에 연결 줄을 직접 넣고,
  카카오에 닿기 전까지의 문(시작 · 취소 · 틀린 코드)만 봅니다 — 카카오 로그인이
  켜진 서버(KAKAO_REST_KEY)에서만 됩니다.
*/
const state = await (await fetch(BASE + "/api/auth/state")).json();
r = await call("POST", "/api/auth/withdraw/kakao", { token: B.token, body: {} });
T("카카오를 안 이은 사람은 400", r.status === 400, r.data);

if (process.env.PSQL_DB && state.kakao) {
  console.log("\n[9] 카카오로 다시 확인");
  const K = await reg("delk", "카");
  sql(`INSERT INTO user_identities (provider, subject, user_id) VALUES ('kakao', 'test-${stamp}', '${K.id}')`);

  r = await call("GET", "/api/auth/me/deletion-preview", { token: K.token });
  T("카카오로 확인해야 함", r.data?.confirm === "kakao" && r.data?.ready === false, r.data);
  r = await call("DELETE", "/api/auth/me", { token: K.token, body: { password: PW } });
  T("비밀번호로는 안 됨 403", r.status === 403, r.data);

  r = await call("POST", "/api/auth/withdraw/kakao", { token: K.token, body: {} });
  T("시작 — 갈 주소", r.status === 200 && /kauth\.kakao\.com/.test(r.data?.url ?? ""), r.data);
  const kState = new URL(r.data.url).searchParams.get("state");
  const kCookie = (r.res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("fit_kakao_state="));

  let back = await fetch(`${BASE}/api/auth/kakao/callback?state=${kState}&error=access_denied`,
    { redirect: "manual", headers: { cookie: kCookie } });
  T("취소하면 탈퇴 화면으로", back.status === 302 && back.headers.get("location") === "/account/delete",
    back.headers.get("location"));

  r = await call("POST", "/api/auth/withdraw/kakao", { token: K.token, body: {} });
  const kState2 = new URL(r.data.url).searchParams.get("state");
  const kCookie2 = (r.res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("fit_kakao_state="));
  back = await fetch(`${BASE}/api/auth/kakao/callback?state=${kState2}&code=bogus`,
    { redirect: "manual", headers: { cookie: kCookie2 } });
  T("코드가 틀리면 까닭을 싣고 탈퇴 화면으로", back.status === 302
    && (back.headers.get("location") ?? "").startsWith("/account/delete?social_error="), back.headers.get("location"));

  r = await call("GET", "/api/auth/me/deletion-preview", { token: K.token });
  T("확인 안 됐으니 그대로", r.data?.ready === false, r.data);

  r = await call("POST", "/api/auth/withdraw/kakao", { token: K.token, body: { nonce: "short" } });
  T("앱의 값이 너무 짧으면 400", r.status === 400, r.data);
} else {
  console.log("\n[9] 카카오 다시 확인은 건너뜀 (PSQL_DB 와 KAKAO_REST_KEY 가 있는 서버에서 봅니다)");
}

console.log(`\n${fail === 0 ? "모두 통과" : "실패 있음"} — ok ${pass}, fail ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
