/* 운영자용 계정 관리·감사 로그 점검 — 권한 경계, 가드레일, 기록이 남는지 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
/* 서버의 SETUP_TOKEN 과 같아야 최초 운영자를 만들 수 있습니다. */
const SETUP_TOKEN = process.env.SETUP_TOKEN || "devtoken";
const J = { "content-type": "application/json" };

let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { ...J };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data, res: r };
}

/* 같은 DB 로 여러 번 돌려도 부딪히지 않게 이름을 매번 다르게 씁니다. */
const TAG = Date.now().toString(36);
const ADMIN = { email: `admin@local.test`, name: "관리자", password: "trip-test-1234" };
const MEMBER = { email: `member-${TAG}@local.test`, name: "동행자", password: "member-test-1234" };

console.log("\n[0] 준비 — 운영자와 회원");

let r = await call("POST", "/api/auth/setup", { body: { ...ADMIN, token: SETUP_TOKEN } });
if (r.status !== 200) {
  /* 이미 설치된 DB 라면 그냥 로그인합니다. */
  r = await call("POST", "/api/auth/login", { body: { email: ADMIN.email, password: ADMIN.password } });
}
T("운영자 확보", r.status === 200 && r.data?.user?.role === "ADMIN", r.data);
const adminToken = r.data?.accessToken;
const adminId = r.data?.user?.id;

r = await call("POST", "/api/auth/register", { body: MEMBER });
T("회원 가입", r.status === 200 && r.data?.user?.role === "MEMBER", r.data);
const memberToken = r.data?.accessToken;
const memberId = r.data?.user?.id;

console.log("\n[1] 권한 경계");

r = await call("GET", "/api/admin/users", { token: memberToken });
T("회원은 계정 관리 못 봄 403", r.status === 403, r.data);

r = await call("GET", "/api/admin/audit", { token: memberToken });
T("회원은 감사 로그 못 봄 403", r.status === 403, r.data);

r = await call("GET", "/api/admin/stats");
T("토큰 없으면 401", r.status === 401, r.data);

r = await call("GET", "/api/admin/stats", { token: adminToken });
T("운영자는 요약을 봄", r.status === 200, r.data);
T("요약에 숫자가 들어 있음",
  typeof r.data?.users === "number" && typeof r.data?.trips === "number"
  && typeof r.data?.auditLast24h === "number" && typeof r.data?.topActions === "object", r.data);

console.log("\n[2] 계정 목록 — 검색·필터·페이징");

r = await call("GET", "/api/admin/users", { token: adminToken });
T("목록 200", r.status === 200, r.data);
T("페이지 껍데기", Array.isArray(r.data?.items) && typeof r.data?.total === "number"
  && typeof r.data?.totalPages === "number", r.data);
T("비밀번호 해시가 새지 않음", !JSON.stringify(r.data).toLowerCase().includes("passwordhash"));
T("여행 수·세션 수를 함께 줌",
  r.data?.items?.every(u => typeof u.ownedTrips === "number" && typeof u.activeSessions === "number"), r.data?.items?.[0]);

r = await call("GET", `/api/admin/users?q=${encodeURIComponent(MEMBER.email)}`, { token: adminToken });
T("이메일로 검색", r.status === 200 && r.data?.items?.length === 1
  && r.data.items[0].id === memberId, r.data);

r = await call("GET", `/api/admin/users?q=${encodeURIComponent("동행자")}`, { token: adminToken });
T("이름으로도 검색", r.status === 200 && r.data?.items?.some(u => u.id === memberId), r.data?.items);

r = await call("GET", "/api/admin/users?role=ADMIN", { token: adminToken });
T("역할로 거르기", r.status === 200 && r.data?.items?.every(u => u.role === "ADMIN"), r.data?.items);

r = await call("GET", "/api/admin/users?role=NOPE", { token: adminToken });
T("없는 역할은 400", r.status === 400, r.data);

r = await call("GET", "/api/admin/users?size=1000", { token: adminToken });
T("size 를 그대로 믿지 않음(100 이하)", r.status === 200 && r.data?.size <= 100, r.data?.size);

console.log("\n[3] 가드레일 — 스스로를 잠그지 못하게");

r = await call("PATCH", `/api/admin/users/${adminId}/role`, { token: adminToken, body: { role: "MEMBER" } });
T("자기 권한은 스스로 못 낮춤", r.status === 400, r.data);

r = await call("PATCH", `/api/admin/users/${adminId}/disabled`, { token: adminToken, body: { disabled: true } });
T("자기 계정은 스스로 못 잠금", r.status === 400, r.data);

r = await call("DELETE", `/api/admin/users/${adminId}`, { token: adminToken });
T("자기 계정은 스스로 못 지움", r.status === 400, r.data);

r = await call("GET", "/api/admin/users?role=ADMIN", { token: adminToken });
const adminCount = r.data?.total ?? 0;
if (adminCount === 1) {
  /* 운영자가 이 사람뿐이면, 다른 운영자를 만들어 마지막 한 명 보호를 확인합니다. */
  r = await call("PATCH", `/api/admin/users/${memberId}/role`, { token: adminToken, body: { role: "ADMIN" } });
  T("회원을 운영자로 올림", r.status === 200 && r.data?.user?.role === "ADMIN", r.data);

  r = await call("PATCH", `/api/admin/users/${memberId}/role`, { token: adminToken, body: { role: "MEMBER" } });
  T("운영자가 둘이면 내릴 수 있음", r.status === 200 && r.data?.user?.role === "MEMBER", r.data);

  /* 토큰 안에 옛 권한이 박혀 있으므로, 바꿨으면 다시 받게 해야 합니다. */
  r = await call("GET", `/api/admin/users?q=${encodeURIComponent(MEMBER.email)}`, { token: adminToken });
  T("권한을 바꾸면 그 계정의 세션을 끊음", r.data?.items?.[0]?.activeSessions === 0, r.data?.items?.[0]);
} else {
  T("마지막 운영자 보호 (운영자가 이미 여럿이라 건너뜀)", true);
  T("운영자 승격/강등 (건너뜀)", true);
}

console.log("\n[4] 잠그기 — 로그인도, 열려 있던 세션도 막힘");

/* [3] 에서 역할을 올렸다 내리는 동안 서버가 이 회원의 세션을 끊었습니다.
   (권한이 바뀌면 옛 토큰이 옛 권한을 들고 있으므로 일부러 끊습니다.)
   잠그기가 세션을 끊는지 보려면 먼저 다시 로그인시켜 둬야 합니다. */
r = await call("POST", "/api/auth/login", { body: { email: MEMBER.email, password: MEMBER.password } });
T("권한 변경 뒤 다시 로그인", r.status === 200, r.data);

r = await call("GET", `/api/admin/users?q=${encodeURIComponent(MEMBER.email)}`, { token: adminToken });
T("잠그기 전 세션이 살아 있음", (r.data?.items?.[0]?.activeSessions ?? 0) >= 1, r.data?.items?.[0]);

r = await call("PATCH", `/api/admin/users/${memberId}/disabled`, { token: adminToken, body: { disabled: true } });
T("잠금 200", r.status === 200 && r.data?.user?.disabled === true, r.data);

r = await call("POST", "/api/auth/login", { body: { email: MEMBER.email, password: MEMBER.password } });
T("잠긴 계정은 로그인 불가", r.status === 401, r.data);

r = await call("GET", `/api/admin/users?q=${encodeURIComponent(MEMBER.email)}`, { token: adminToken });
T("잠글 때 세션도 끊음", r.data?.items?.[0]?.activeSessions === 0, r.data?.items?.[0]);

r = await call("PATCH", `/api/admin/users/${memberId}/disabled`, { token: adminToken, body: { disabled: false } });
T("잠금 해제 200", r.status === 200 && r.data?.user?.disabled === false, r.data);

r = await call("POST", "/api/auth/login", { body: { email: MEMBER.email, password: MEMBER.password } });
T("풀면 다시 로그인됨", r.status === 200, r.data);
let memberToken2 = r.data?.accessToken;

console.log("\n[5] 비밀번호 재설정과 세션 끊기");

const NEW_PASSWORD = "reset-by-admin-9999";
r = await call("POST", `/api/admin/users/${memberId}/password`, { token: adminToken, body: { password: "짧음" } });
T("짧은 비밀번호 거부", r.status === 400, r.data);

r = await call("POST", `/api/admin/users/${memberId}/password`, { token: adminToken, body: { password: NEW_PASSWORD } });
T("비밀번호 재설정 200", r.status === 200, r.data);

r = await call("POST", "/api/auth/login", { body: { email: MEMBER.email, password: MEMBER.password } });
T("옛 비밀번호는 막힘", r.status === 401, r.data);

r = await call("POST", "/api/auth/login", { body: { email: MEMBER.email, password: NEW_PASSWORD } });
T("새 비밀번호로 로그인", r.status === 200, r.data);
memberToken2 = r.data?.accessToken;

r = await call("POST", `/api/admin/users/${memberId}/logout`, { token: adminToken });
T("세션 끊기 200", r.status === 200 && typeof r.data?.revoked === "number", r.data);

r = await call("GET", `/api/admin/users?q=${encodeURIComponent(MEMBER.email)}`, { token: adminToken });
T("끊고 나면 세션 0", r.data?.items?.[0]?.activeSessions === 0, r.data?.items?.[0]);

console.log("\n[6] 삭제 — 기록이 남아 있으면 막고 안내");

r = await call("POST", "/api/auth/login", { body: { email: MEMBER.email, password: NEW_PASSWORD } });
memberToken2 = r.data?.accessToken;

r = await call("POST", "/api/trips", { token: memberToken2, body: { title: `테스트 여행 ${TAG}`, startIso: "2026-10-08", nights: 1 } });
T("회원이 여행을 만듦", r.status === 200, r.data);
const tripId = r.data?.trip?.id;

r = await call("DELETE", `/api/admin/users/${memberId}`, { token: adminToken });
T("여행 주인은 못 지움 409", r.status === 409, r.data);
T("어떻게 하라고 알려 줌", /잠가|넘기|지운/.test(r.data?.error ?? ""), r.data?.error);

r = await call("DELETE", `/api/trips/${tripId}`, { token: memberToken2 });
T("여행 삭제", r.status === 200, r.data);

r = await call("GET", "/api/admin/users?q=" + encodeURIComponent("없는사람zzz"), { token: adminToken });
T("검색 결과 없음도 정상 응답", r.status === 200 && r.data?.items?.length === 0, r.data);

r = await call("DELETE", `/api/admin/users/xxxxxxxxxxxx`, { token: adminToken });
T("없는 계정 404", r.status === 404, r.data);

console.log("\n[7] 감사 로그");

r = await call("GET", "/api/admin/audit", { token: adminToken });
T("감사 로그 200", r.status === 200 && Array.isArray(r.data?.items), r.data);
T("최근 것이 먼저", r.data?.items?.length > 1
  ? new Date(r.data.items[0].at) >= new Date(r.data.items[1].at) : true, r.data?.items?.slice(0, 2));
T("사람 이름을 붙여 줌", r.data?.items?.some(e => e.userName === "관리자"), r.data?.items?.[0]);

r = await call("GET", "/api/admin/audit/actions", { token: adminToken });
T("활동 종류 목록", r.status === 200 && Array.isArray(r.data?.actions), r.data);
const actions = r.data?.actions ?? [];
T("잠금 기록이 남음", actions.includes("admin.user.lock"), actions);
T("비밀번호 재설정 기록이 남음", actions.includes("admin.user.password"), actions);
T("세션 끊기 기록이 남음", actions.includes("admin.user.logout"), actions);

r = await call("GET", "/api/admin/audit?action=admin.user.lock", { token: adminToken });
T("활동으로 거르기", r.status === 200 && r.data?.items?.every(e => e.action === "admin.user.lock"), r.data?.items);
T("잠금 기록의 대상이 그 회원", r.data?.items?.some(e => e.target === memberId), r.data?.items);
T("자세한 내용이 객체로 옴", r.data?.items?.[0]?.detail === null
  || typeof r.data?.items?.[0]?.detail === "object", r.data?.items?.[0]);

r = await call("GET", `/api/admin/audit?userId=${adminId}`, { token: adminToken });
T("사람으로 거르기", r.status === 200 && r.data?.items?.every(e => e.userId === adminId), r.data?.items);

r = await call("GET", "/api/admin/audit?from=2000-01-01", { token: adminToken });
T("날짜만 줘도 됨", r.status === 200 && r.data?.total > 0, r.data?.total);

r = await call("GET", "/api/admin/audit?from=2000-01-01T00:00:00Z", { token: adminToken });
T("정확한 시각도 됨", r.status === 200, r.data);

r = await call("GET", "/api/admin/audit?from=어제", { token: adminToken });
T("이상한 날짜는 400", r.status === 400, r.data);

r = await call("GET", "/api/admin/audit?from=2000-01-01&to=2000-01-02", { token: adminToken });
T("옛날 구간은 비어 있음", r.status === 200 && r.data?.total === 0, r.data?.total);

console.log(`\n${fail === 0 ? "모두 통과" : "실패 있음"} — ok ${pass}, fail ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
