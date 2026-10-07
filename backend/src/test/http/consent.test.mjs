/* 약관 · 개인정보 수집 · 이용 동의 — 가입할 때 셋 다 받고, 안 받은 사람(소셜 · V60 전 가입)은
   user.needsConsent 가 켜져 있다가 POST /api/auth/agree 로 꺼지는지 */
import { execSync } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:8080";
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

function refreshCookieOf(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
  const line = all.find((c) => c.startsWith("fit_refresh="));
  return line ? line.split(";")[0] : null;
}

/* 시험용 DB 를 바로 볼 수 있을 때만 씁니다(deletion.test.mjs 와 같은 길). */
function sql(query) {
  return execSync(`docker exec fit-scratch-db psql -U fit -d ${process.env.PSQL_DB} -tAc "${query}"`).toString().trim();
}

const stamp = Date.now();
const PW = "pw-12345678";
const ALL = { over14: true, terms: true, privacy: true };
const MSG = "만 14세 이상이고 약관과 개인정보처리방침에 동의해야 가입할 수 있어요.";

console.log("\n[1] 동의 없이 가입 — 받지 않습니다");
let r = await call("POST", "/api/auth/register", { body: { email: `none-${stamp}@test.com`, name: "가", password: PW } });
T("세 칸 없이 400", r.status === 400, r.data);
T("문구", r.data?.error === MSG, r.data);
r = await call("POST", "/api/auth/register",
  { body: { email: `two-${stamp}@test.com`, name: "가", password: PW, over14: true, terms: true } });
T("둘만 켜도 400", r.status === 400 && r.data?.error === MSG, r.data);
r = await call("POST", "/api/auth/register",
  { body: { email: `false-${stamp}@test.com`, name: "가", password: PW, ...ALL, over14: false } });
T("만 14세를 끄면 400", r.status === 400, r.data);
r = await call("POST", "/api/auth/login", { body: { email: `none-${stamp}@test.com`, password: PW } });
T("거절된 가입은 계정을 안 남김", r.status === 401, r.data);

console.log("\n[2] 셋 다 켜고 가입 — 동의 화면을 안 거칩니다");
const email = `yes-${stamp}@test.com`;
r = await call("POST", "/api/auth/register", { body: { email, name: "나", password: PW, ...ALL } });
T("가입", r.status === 200 && !!r.data?.accessToken, r.data);
T("needsConsent 꺼짐", r.data?.user?.needsConsent === false, r.data?.user);
const token = r.data?.accessToken;
const id = r.data?.user?.id;
const cookie = refreshCookieOf(r.res);
r = await call("GET", "/api/auth/me", { token });
T("/me 도 꺼짐", r.data?.user?.needsConsent === false, r.data);
r = await call("POST", "/api/auth/login", { body: { email, password: PW } });
T("로그인 응답에도 실림", r.status === 200 && r.data?.user?.needsConsent === false, r.data);

console.log("\n[3] 동의 부르기 — 로그인해야 하고, 셋 다 켜야 합니다");
r = await call("POST", "/api/auth/agree", { body: ALL });
T("로그인 없이 401", r.status === 401, r.data);
r = await call("POST", "/api/auth/agree", { token, body: { over14: true, terms: true } });
T("하나 빠지면 400", r.status === 400, r.data);
r = await call("POST", "/api/auth/agree", { token });
T("본문 없으면 400", r.status === 400, r.data);
r = await call("POST", "/api/auth/agree", { token, body: ALL });
T("이미 동의했어도 다시 받음", r.status === 200 && r.data?.user?.needsConsent === false, r.data);

/* 구글 · 카카오로 처음 들어온 사람은 여기서 만들 수 없습니다(그 회사가 서명한 토큰이
   있어야 합니다). 그 사람과 V60 전에 가입한 사람은 둘 다 「agreed_version 이 빈 줄」이라,
   DB 에서 그 칸을 비워 같은 사람을 만듭니다. */
if (process.env.PSQL_DB) {
  console.log("\n[4] 동의한 적 없는 사람(소셜 · V60 전 가입)");
  sql(`UPDATE users SET agreed_at = NULL, agreed_version = NULL WHERE id = '${id}'`);
  r = await call("GET", "/api/auth/me", { token });
  T("/me 에 needsConsent 켜짐", r.data?.user?.needsConsent === true, r.data);
  r = await call("POST", "/api/auth/refresh", { cookie });
  T("재발급 응답에도 켜짐", r.status === 200 && r.data?.user?.needsConsent === true, r.data);
  r = await call("POST", "/api/auth/login", { body: { email, password: PW } });
  T("로그인 응답에도 켜짐", r.data?.user?.needsConsent === true, r.data);

  r = await call("POST", "/api/auth/agree", { token, body: { ...ALL, privacy: false } });
  T("하나 끄면 400", r.status === 400, r.data);
  T("거절하면 그대로 켜짐", (await call("GET", "/api/auth/me", { token })).data?.user?.needsConsent === true);

  r = await call("POST", "/api/auth/agree", { token, body: ALL });
  T("동의", r.status === 200 && r.data?.user?.needsConsent === false, r.data);
  r = await call("GET", "/api/auth/me", { token });
  T("/me 도 꺼짐", r.data?.user?.needsConsent === false, r.data);
  const row = sql(`SELECT agreed_version || '|' || (agreed_at IS NOT NULL) FROM users WHERE id = '${id}'`);
  T("판과 때가 적힘", /^\d{4}-\d{2}-\d{2}\|(t|true)$/.test(row), row);

  console.log("\n[5] 약관 판이 바뀌면 다시 묻습니다");
  sql(`UPDATE users SET agreed_version = '2000-01-01' WHERE id = '${id}'`);
  r = await call("GET", "/api/auth/me", { token });
  T("옛 판이면 켜짐", r.data?.user?.needsConsent === true, r.data);
  await call("POST", "/api/auth/agree", { token, body: ALL });
  T("다시 동의하면 꺼짐", (await call("GET", "/api/auth/me", { token })).data?.user?.needsConsent === false);
  T("동의 기록이 감사 로그에", Number(sql(`SELECT count(*) FROM audit_log WHERE action = 'user.consent' AND user_id = '${id}'`)) >= 2);
} else {
  console.log("\n[4] 동의한 적 없는 사람은 건너뜀 (PSQL_DB 를 주면 봅니다)");
}

console.log(`\n${fail === 0 ? "모두 통과" : "실패 있음"} — ok ${pass}, fail ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
