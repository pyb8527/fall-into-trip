/* 토큰 인증 점검 — 액세스/리프레시 분리, 회전, 재사용 감지 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
const J = { "content-type": "application/json" };

let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x) : ""));

/* 쿠키를 직접 다룬다 — 리프레시 토큰이 정말 쿠키로만 오가는지 봐야 하므로 */
function cookieOf(res, name) {
  for (const c of (res.headers.getSetCookie?.() ?? [])) {
    const [kv, ...attrs] = c.split(";");
    const [k, v] = [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)];
    if (k.trim() === name) return { value: v, raw: c, attrs: attrs.map(a => a.trim()) };
  }
  return null;
}
async function call(method, path, { body, token, cookie } = {}) {
  const headers = { ...J };
  if (token) headers.authorization = "Bearer " + token;
  if (cookie) headers.cookie = "fit_refresh=" + cookie;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data, res: r };
}

const A = { email: "Admin@Local.Test", name: "관리자", password: "trip-test-1234" };

console.log("\n[1] 최초 설치");
let r = await call("POST", "/api/auth/setup", { body: { ...A, token: "wrong" } });
T("잘못된 설치 토큰 거부", r.status === 403, r.data);

r = await call("POST", "/api/auth/setup", { body: { ...A, password: "short" , token: "devtoken" } });
T("짧은 비밀번호 거부", r.status === 400, r.data);

r = await call("POST", "/api/auth/setup", { body: { ...A, token: "devtoken" } });
T("관리자 생성", r.status === 200, r.data);
T("액세스 토큰 발급", typeof r.data?.accessToken === "string" && r.data.accessToken.split(".").length === 3);
T("만료 시간 안내", r.data?.expiresIn === 900, r.data?.expiresIn);
T("역할 ADMIN", r.data?.user?.role === "ADMIN", r.data?.user);
T("이메일 소문자로 정규화", r.data?.user?.email === "admin@local.test", r.data?.user?.email);

const setupCookie = cookieOf(r.res, "fit_refresh");
T("리프레시는 쿠키로만", !!setupCookie);
T("HttpOnly", setupCookie?.attrs.some(a => a.toLowerCase() === "httponly"));
T("SameSite=Lax", setupCookie?.attrs.some(a => a.toLowerCase() === "samesite=lax"));
T("경로를 /api/auth 로 좁힘", setupCookie?.attrs.some(a => a.toLowerCase() === "path=/api/auth"));
T("응답 본문에 리프레시 토큰 없음", !JSON.stringify(r.data).includes(setupCookie.value));

r = await call("POST", "/api/auth/setup", { body: { ...A, token: "devtoken" } });
T("설치는 한 번만", r.status === 403, r.data);

console.log("\n[2] 로그인");
r = await call("POST", "/api/auth/login", { body: { email: A.email, password: "틀린비밀번호" } });
T("틀린 비밀번호 401", r.status === 401, r.data);
r = await call("POST", "/api/auth/login", { body: { email: "없는@사람.com", password: A.password } });
T("없는 계정도 같은 401", r.status === 401 && /이메일 또는 비밀번호/.test(r.data?.error ?? ""), r.data);

r = await call("POST", "/api/auth/login", { body: { email: "ADMIN@LOCAL.TEST", password: A.password } });
T("대소문자 무관 로그인", r.status === 200, r.data);
let access = r.data.accessToken;
let refresh = cookieOf(r.res, "fit_refresh").value;

console.log("\n[3] 액세스 토큰으로 접근");
r = await call("GET", "/api/auth/me", { token: access });
T("내 정보 조회", r.status === 200 && r.data?.user?.email === "admin@local.test", r.data);
r = await call("GET", "/api/auth/me");
T("토큰 없으면 401", r.status === 401);
r = await call("GET", "/api/auth/me", { token: access.slice(0, -3) + "aaa" });
T("서명 틀리면 401", r.status === 401);
r = await call("GET", "/api/auth/me", { cookie: refresh });
T("리프레시 쿠키로는 API 접근 불가", r.status === 401, r.data);

console.log("\n[4] 재발급과 회전");
r = await call("POST", "/api/auth/refresh", { cookie: refresh });
T("재발급 성공", r.status === 200, r.data);
const access2 = r.data?.accessToken;
const refresh2 = cookieOf(r.res, "fit_refresh")?.value;
T("새 리프레시로 갈아끼움", !!refresh2 && refresh2 !== refresh);
T("새 액세스 토큰", !!access2);
r = await call("GET", "/api/auth/me", { token: access2 });
T("새 토큰으로 접근됨", r.status === 200);

console.log("\n[5] 탈취 감지 — 이미 쓴 리프레시를 다시 내밀면");
r = await call("POST", "/api/auth/refresh", { cookie: refresh });
T("옛 토큰은 거부", r.status === 401, r.data);
r = await call("POST", "/api/auth/refresh", { cookie: refresh2 });
T("같은 묶음이 통째로 끊김", r.status === 401, r.data);

console.log("\n[6] 로그아웃");
r = await call("POST", "/api/auth/login", { body: { email: A.email, password: A.password } });
const r3 = cookieOf(r.res, "fit_refresh").value;
const a3 = r.data.accessToken;
r = await call("POST", "/api/auth/logout", { cookie: r3 });
T("로그아웃", r.status === 200);
const cleared = cookieOf(r.res, "fit_refresh");
T("쿠키를 비움", cleared?.value === "" , cleared?.value);
r = await call("POST", "/api/auth/refresh", { cookie: r3 });
T("로그아웃 뒤 재발급 불가", r.status === 401, r.data);
r = await call("GET", "/api/auth/me", { token: a3 });
T("액세스 토큰은 만료까지 유효(설계상)", r.status === 200);

console.log("\n[7] 비밀번호 변경");
r = await call("POST", "/api/auth/login", { body: { email: A.email, password: A.password } });
const a4 = r.data.accessToken;
const c4 = cookieOf(r.res, "fit_refresh").value;
r = await call("POST", "/api/auth/password", { token: a4, body: { current: "틀림", next: "new-password-1234" } });
T("현재 비밀번호 틀리면 거부", r.status === 400, r.data);
r = await call("POST", "/api/auth/password", { token: a4, body: { current: A.password, next: "new-password-1234" } });
T("비밀번호 변경", r.status === 200, r.data);
const c5 = cookieOf(r.res, "fit_refresh")?.value;
T("이 기기는 새 세션을 받음", !!c5 && c5 !== c4);
r = await call("POST", "/api/auth/refresh", { cookie: c4 });
T("옛 기기는 끊김", r.status === 401, r.data);
r = await call("POST", "/api/auth/login", { body: { email: A.email, password: A.password } });
T("옛 비밀번호로 로그인 실패", r.status === 401);
r = await call("POST", "/api/auth/login", { body: { email: A.email, password: "new-password-1234" } });
T("새 비밀번호로 로그인", r.status === 200);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
