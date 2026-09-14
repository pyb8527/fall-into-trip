/*
  구글로 로그인하기 — 울타리 부분.

  구글이 서명한 토큰을 여기서 만들 수 없습니다. 그래서 "통과하는 길" 은 못
  봅니다 — 그건 클라이언트 ID 를 넣고 사람이 눌러 봐야 아는 일입니다.
  place·recommend 가 구글 키 없이 도는 방식과 같습니다.

  여기서 보는 것은 그 앞입니다. 무엇보다 이 작업은 password_hash 를 널 허용으로
  바꿉니다. 비밀번호로 들어오는 길이 그대로인지가 이 묶음에서 제일 중요합니다.
*/
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
const stamp = Date.now();
const reg = (who, name) => call("POST", "/api/auth/register",
  { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678" } });

console.log("\n[1] 사람");
let r = await reg("a", "가");
const a = r.data.accessToken;
T("가입", r.status === 200 && !!a, r.data);

console.log("\n[2] 무엇을 거절하는가");
r = await call("POST", "/api/auth/google", { body: {} });
T("토큰이 없으면 거절", r.status === 400, r.data);
r = await call("POST", "/api/auth/google", { body: { credential: "" } });
T("빈 토큰도 거절", r.status === 400, r.data);
r = await call("POST", "/api/auth/google", { body: { credential: "그냥.아무.글자" } });
T("엉터리 토큰 거절", r.status === 400, r.data);

/* 모양은 JWT 인데 서명이 우리 것이 아닙니다. 서명을 안 보면 이것이 통과하고,
   그러면 아무나 남의 이메일을 적어 넣어 그 계정으로 들어옵니다. */
const forged = [
  Buffer.from(JSON.stringify({ alg: "RS256", kid: "없는키" })).toString("base64url"),
  Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com",
    sub: "위조-" + stamp,
    email: `a-${stamp}@test.com`,
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url"),
  "서명자리",
].join(".");
r = await call("POST", "/api/auth/google", { body: { credential: forged } });
T("서명 없는 토큰으로는 못 들어온다", r.status === 400, r.data);
T("왜 틀렸는지는 안 알려 준다", !/서명|signature|aud|iss/i.test(r.data?.error ?? ""), r.data);

console.log("\n[3] 잇기·끊기는 로그인한 사람만");
r = await call("POST", "/api/auth/link/google", { body: { credential: forged } });
T("로그인 없이 잇기 거절", r.status === 401, r.data);
r = await call("DELETE", "/api/auth/link/google");
T("로그인 없이 끊기 거절", r.status === 401, r.data);

r = await call("DELETE", "/api/auth/link/google", { token: a });
T("이어 둔 것이 없으면 404", r.status === 404, r.data);

r = await call("POST", "/api/auth/link/google", { token: a, body: { credential: forged } });
T("로그인해도 엉터리 토큰은 거절", r.status === 400, r.data);

console.log("\n[4] 비밀번호로 들어오는 길이 그대로인가");
/* 이 작업이 password_hash 를 널 허용으로 바꿉니다. 여기가 깨지면 쓰던 사람이
   전부 못 들어옵니다. */
r = await call("POST", "/api/auth/login", { body: { email: `a-${stamp}@test.com`, password: "pw-12345678" } });
T("비밀번호 로그인 그대로", r.status === 200 && !!r.data.accessToken, r.data);
r = await call("POST", "/api/auth/login", { body: { email: `a-${stamp}@test.com`, password: "틀린비밀번호" } });
T("틀린 비밀번호는 그대로 거절", r.status === 401, r.data);

/* 빈 비밀번호가 빈 해시에 맞아떨어지면 안 됩니다. 널 허용으로 바꿀 때 가장
   무서운 자리입니다. */
r = await call("POST", "/api/auth/login", { body: { email: `a-${stamp}@test.com`, password: "" } });
/* 400 이든 401 이든 못 들어간 것이면 됩니다. 빈 값은 @Valid 가 먼저 막습니다. */
T("빈 비밀번호로는 못 들어온다", r.status === 400 || r.status === 401, r.data);
r = await call("POST", "/api/auth/login", { body: { email: `a-${stamp}@test.com`, password: null } });
T("비밀번호 없이도 못 들어온다", r.status === 400 || r.status === 401, r.data);

r = await call("POST", "/api/auth/password", { token: a, body: { current: "pw-12345678", next: "pw-87654321" } });
T("비밀번호 바꾸기 그대로", r.status === 200, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
